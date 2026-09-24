const mongoose = require('../db/mysqlCompat');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { setEmojiSafe } = require('../utils/emoji');
const Suggestion = require('../models/Suggestion');
const GuildModel = require('../models/Guild');
const { can } = require('../utils/permissions');
const { buildV2Panel } = require('../utils/componentsV2');

function getProgressBar(upvotes, downvotes) {
  const total = upvotes + downvotes;
  if (total === 0) return '░░░░░░░░░░ 0%';
  const upPercent = Math.round((upvotes / total) * 10);
  const bar = '█'.repeat(upPercent) + '░'.repeat(10 - upPercent);
  return `${bar} ${Math.round((upvotes / total) * 100)}%`;
}

/**
 * يبني صف أزرار التصويت/القرار من الصفر بالاعتماد على القيم الحالية فقط —
 * بدون قراءة/تعديل صف أزرار قديم من الرسالة.
 */
function buildSuggestionRow(sugId, upCount, downCount) {
  const up = new ButtonBuilder().setCustomId(`sug_up_${sugId}`).setLabel(String(upCount)).setStyle(ButtonStyle.Secondary);
  const down = new ButtonBuilder().setCustomId(`sug_down_${sugId}`).setLabel(String(downCount)).setStyle(ButtonStyle.Secondary);
  const accept = new ButtonBuilder().setCustomId(`sug_accept_${sugId}`).setLabel('قبول').setStyle(ButtonStyle.Success);
  const reject = new ButtonBuilder().setCustomId(`sug_reject_${sugId}`).setLabel('رفض').setStyle(ButtonStyle.Danger);
  setEmojiSafe(up, '👍', 'like');
  setEmojiSafe(down, '👎', 'dislike');
  setEmojiSafe(accept, '✅', 'yes');
  setEmojiSafe(reject, '❌', 'no');
  return new ActionRowBuilder().addComponents(up, down, accept, reject);
}

/**
 * يبني لوحة الاقتراح كاملة (Components v2) من بيانات الداتابيز مباشرة —
 * بدل قراءة/تعديل إمبد قديم من الرسالة.
 */
function buildSuggestionPanel(guild, authorUser, suggestion, { rows = [] } = {}) {
  const upCount = suggestion.upvotes.length;
  const downCount = suggestion.downvotes.length;

  const statusValue =
    suggestion.status === 'accepted' ? '`✅ تم القبول`' :
    suggestion.status === 'rejected' ? '`❌ تم الرفض`' :
    '`⏳ قيد الدراسة`';

  const fields = [
    { name: '📊 نسبة التأييد', value: `\`\`\`${getProgressBar(upCount, downCount)}\`\`\`` },
    { name: '👍 المؤيدون', value: `\`${upCount}\`` },
    { name: '👎 المعارضون', value: `\`${downCount}\`` },
    { name: '📌 الحالة', value: statusValue }
  ];

  if (suggestion.status !== 'pending' && suggestion.adminReason) {
    fields.push({
      name: suggestion.status === 'accepted' ? '💬 ملاحظة الإدارة (القبول)' : '💬 سبب الرفض',
      value: `\`\`\`${suggestion.adminReason}\`\`\``
    });
  }

  const color = suggestion.status === 'accepted' ? '#57F287' : suggestion.status === 'rejected' ? '#ED4245' : '#2B2D31';
  const authorTag = authorUser ? authorUser.tag : 'Unknown User';

  return buildV2Panel({
    title: '💡 اقتراح جديد',
    description: `**${authorTag}**\n>>> ${suggestion.content}`,
    fields,
    color,
    thumbnail: guild.iconURL({ dynamic: true }),
    footer: `المُقترح: ${suggestion.userId}`,
    timestamp: true,
    rows
  });
}

async function postSuggestion(message) {
  const guildDoc = await GuildModel.findOne({ guildId: message.guild.id });
  if (!guildDoc?.suggestions?.enabled || guildDoc.suggestions.channelId !== message.channel.id) return false;
  if (message.author.bot) return false;

  const content = message.content.trim();
  if (!content) return false;

  // حذف رسالة العضو
  await message.delete().catch(() => {});

  // 1. توليد ID مسبق للمستند لربط الأزرار به فوراً
  const sugId = new mongoose.Types.ObjectId();

  // 2. تجهيز الأزرار مسبقاً
  const row = buildSuggestionRow(sugId, 0, 0);

  // 3. الحفظ المبدئي في المونجو بنفس الـ ID (قبل الإرسال حتى نبني اللوحة من نفس الشكل)
  const suggestion = new Suggestion({
    _id: sugId,
    guildId: message.guild.id,
    userId: message.author.id,
    messageId: '0',
    content: content,
    upvotes: [],
    downvotes: [],
    status: 'pending'
  });

  // 4. بناء اللوحة وإرسالها مع الأزرار دفعة واحدة
  const panel = buildSuggestionPanel(message.guild, message.author, suggestion, { rows: [row] });
  const sent = await message.channel.send(panel);

  suggestion.messageId = sent.id;
  await suggestion.save();

  return true;
}

async function handleButton(interaction) {
  const customId = interaction.customId;
  if (!customId.startsWith('sug_')) return false;

  if (interaction.isModalSubmit() && customId.startsWith('sug_modal_')) {
    return handleModalSubmit(interaction);
  }

  if (!interaction.isButton()) return false;

  const parts = customId.split('_');
  const action = parts[1];
  const sugId = parts[2];

  const suggestion = await Suggestion.findById(sugId);
  if (!suggestion) {
    return interaction.reply({ content: '❌ لم يتم العثور على هذا الاقتراح.', ephemeral: true });
  }

  if (suggestion.status !== 'pending') {
    return interaction.reply({ content: '🔒 هذا الاقتراح مغلق ومحسوم بالفعل.', ephemeral: true });
  }

  const userId = interaction.user.id;

  if (!Array.isArray(suggestion.upvotes)) suggestion.upvotes = [];
  if (!Array.isArray(suggestion.downvotes)) suggestion.downvotes = [];

  if (action === 'up' || action === 'down') {
    const isUp = action === 'up';
    const currentList = isUp ? suggestion.upvotes : suggestion.downvotes;
    const oppositeList = isUp ? suggestion.downvotes : suggestion.upvotes;

    if (currentList.includes(userId)) {
      currentList.splice(currentList.indexOf(userId), 1);
    } else {
      if (oppositeList.includes(userId)) {
        oppositeList.splice(oppositeList.indexOf(userId), 1);
      }
      currentList.push(userId);
    }

    await suggestion.save();

    const upCount = suggestion.upvotes.length;
    const downCount = suggestion.downvotes.length;

    const row = buildSuggestionRow(sugId, upCount, downCount);

    const authorUser = await interaction.client.users.fetch(suggestion.userId).catch(() => null);
    const panel = buildSuggestionPanel(interaction.guild, authorUser, suggestion, { rows: [row] });

    await interaction.update(panel);
    return true;
  }

  if (action === 'accept' || action === 'reject') {
    if (!can.manageGuild(interaction)) {
      return interaction.reply({ content: '❌ لا تملك صلاحية إدارة الاقتراحات.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`sug_modal_${action}_${sugId}`)
      .setTitle(action === 'accept' ? 'قبول الاقتراح' : 'رفض الاقتراح');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('سبب القرار')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('اكتب سبب القرار هنا (اختياري)...')
      .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
    return true;
  }

  return false;
}

async function handleModalSubmit(interaction) {
  const parts = interaction.customId.split('_');
  const action = parts[2];
  const sugId = parts[3];

  const suggestion = await Suggestion.findById(sugId);
  if (!suggestion) return interaction.reply({ content: '❌ الاقتراح غير موجود.', ephemeral: true });

  const reason = interaction.fields.getTextInputValue('reason') || 'لم يتم تحديد سبب.';
  const isAccept = action === 'accept';

  suggestion.status = isAccept ? 'accepted' : 'rejected';
  suggestion.adminReason = reason;
  await suggestion.save();

  const message = interaction.message || await interaction.channel.messages.fetch(suggestion.messageId).catch(() => null);
  if (!message) return interaction.reply({ content: '✅ تم تحديث حالة الاقتراح.', ephemeral: true });

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('disabled_1')
      .setLabel(`👍 ${suggestion.upvotes.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('disabled_2')
      .setLabel(`👎 ${suggestion.downvotes.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('disabled_3')
      .setLabel(isAccept ? 'مقبول' : 'مرفوض')
      .setStyle(isAccept ? ButtonStyle.Success : ButtonStyle.Danger)
      .setDisabled(true)
  );

  const authorUser = await interaction.client.users.fetch(suggestion.userId).catch(() => null);
  const panel = buildSuggestionPanel(interaction.guild, authorUser, suggestion, { rows: [disabledRow] });

  await interaction.update(panel);
  return true;
}

module.exports = { postSuggestion, handleButton };
