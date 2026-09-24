const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const StaffApplication = require('../models/StaffApplication');
const { setEmojiSafe } = require('../utils/emoji');
const { buildV2Panel } = require('../utils/componentsV2');

const MAX_QUESTIONS = 5; // قيد الديسكورد: 5 حقول كحد أقصى بكل مودال

/**
 * يرجع بانل تقديم معين من guildDoc.applicationPanels حسب الـ _id.
 */
function resolvePanel(guildDoc, panelId) {
  return guildDoc?.applicationPanels?.id(panelId) || null;
}

/**
 * رسالة البانل الرئيسية (زر "تقديم الآن") — تُرسل بأمر /application-panel.
 */
function buildPanelPayload(guild, panel) {
  const button = new ButtonBuilder()
    .setCustomId(`application_open_${panel._id}`)
    .setLabel((panel.buttonLabel || 'تقديم الآن').slice(0, 80))
    .setStyle(ButtonStyle[panel.buttonStyle] || ButtonStyle.Primary);
  setEmojiSafe(button, panel.buttonEmoji, '📋');

  return buildV2Panel({
    title: panel.panelTitle || guild.name,
    description: panel.panelDescription || 'اضغط الزر بالأسفل للتقديم.',
    image: panel.panelImage || null,
    thumbnail: panel.panelThumbnail || null,
    color: panel.panelColor,
    footer: panel.panelFooter || guild.name,
    rows: [new ActionRowBuilder().addComponents(button)]
  });
}

/**
 * مودال الأسئلة اللي يفتح بعد الضغط على "تقديم الآن".
 */
function buildQuestionModal(panel) {
  const modal = new ModalBuilder()
    .setCustomId(`application_modal_${panel._id}`)
    .setTitle((panel.name || 'تقديم الإدارة').slice(0, 45));

  const questions = (panel.questions || []).slice(0, MAX_QUESTIONS);
  for (const q of questions) {
    const input = new TextInputBuilder()
      .setCustomId(String(q._id))
      .setLabel(String(q.text).slice(0, 45))
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

/**
 * هل عند هذا العضو تقديم "قيد المراجعة" بنفس البانل؟ (يمنع التكرار/السبام
 * إذا preventDuplicatePending مفعّلة بإعدادات البانل).
 */
async function hasPendingApplication(guildId, panelId, applicantId) {
  const existing = await StaffApplication.findOne({ guildId, panelId, applicantId, status: 'pending' });
  return !!existing;
}

/**
 * ينشئ تكت خاص لهذا التقديم (بدل الإرسال لروم ثابت) — المتقدم يشوف القناة
 * ويقدر يتواصل مع الإدارة داخلها، ورتبة المراجعة (إذا محددة) تشوفها وترد فيها.
 */
async function createApplicationTicketChannel(guild, member, panel) {
  const safeName = `تقديم-${member.user.username}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .slice(0, 90) || `application-${member.id}`;

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
  ];
  if (panel.reviewPingRoleId) {
    overwrites.push({
      id: panel.reviewPingRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  return guild.channels.create({
    name: safeName,
    type: ChannelType.GuildText,
    parent: panel.ticketCategoryId || undefined,
    permissionOverwrites: overwrites
  });
}

/**
 * ينشئ التقديم في الداتابيز، ثم يرسله لمكان المراجعة:
 * - إذا createTicketOnSubmit مفعّلة: يفتح تكت خاص بهذا التقديم ويحط فيه
 *   البانل بالأزرار (والمتقدم نفسه يشوف القناة ويقدر يتواصل مع الإدارة).
 * - غير كذا: يرسل البانل بأزرار قبول/رفض لروم المراجعة الثابت كالمعتاد.
 * يرجّع {application} — أي خطأ إرسال (صلاحيات ناقصة، ما فيه روم محدد...) يُرمى
 * ليتعامل معه الكولر، مع application مرفقة بالخطأ (application.application).
 */
async function submitApplication(guild, member, panel, answers) {
  const application = await StaffApplication.create({
    guildId: guild.id,
    panelId: String(panel._id),
    applicantId: member.id,
    answers
  });

  const fields = answers.map((a, i) => ({ name: `${i + 1}. ${a.question}`, value: a.answer || '—' }));

  const acceptBtn = new ButtonBuilder()
    .setCustomId(`application_accept_${application._id}`)
    .setLabel('قبول')
    .setStyle(ButtonStyle.Success);
  setEmojiSafe(acceptBtn, '✅');

  const rejectBtn = new ButtonBuilder()
    .setCustomId(`application_reject_${application._id}`)
    .setLabel('رفض')
    .setStyle(ButtonStyle.Danger);
  setEmojiSafe(rejectBtn, '❌');

  let targetChannel;
  let pingContent;

  if (panel.createTicketOnSubmit) {
    try {
      targetChannel = await createApplicationTicketChannel(guild, member, panel);
    } catch (err) {
      err.message = 'TICKET_CREATE_FAILED';
      err.application = application;
      throw err;
    }
    pingContent = `<@${member.id}>` + (panel.reviewPingRoleId ? ` <@&${panel.reviewPingRoleId}>` : '');
  } else {
    targetChannel = panel.reviewChannelId ? guild.channels.cache.get(panel.reviewChannelId) : null;
    if (!targetChannel?.isTextBased()) {
      const err = new Error('NO_REVIEW_CHANNEL');
      err.application = application;
      throw err;
    }
    pingContent = panel.reviewPingRoleId ? `<@&${panel.reviewPingRoleId}>` : undefined;
  }

  const payload = buildV2Panel({
    pingContent,
    title: `📋 تقديم جديد — ${panel.name || 'الإدارة'}`,
    description: `👤 **المتقدم:** <@${member.id}> (${member.user.tag})`,
    fields,
    color: panel.panelColor,
    footer: `Application ID: ${application._id}`,
    timestamp: true,
    rows: [new ActionRowBuilder().addComponents(acceptBtn, rejectBtn)]
  });

  const message = await targetChannel.send(payload);
  application.reviewChannelId = targetChannel.id;
  application.reviewMessageId = message.id;
  await application.save();

  return application;
}

/**
 * يقفل رسالة المراجعة الأصلية (يشيل الأزرار، يضيف سطر يوضح القرار) بدل تركها
 * قابلة للضغط عليها مرة ثانية.
 */
async function lockReviewMessage(guild, application, resultLine) {
  if (!application.reviewChannelId || !application.reviewMessageId) return;
  try {
    const channel = guild.channels.cache.get(application.reviewChannelId);
    const message = await channel?.messages?.fetch(application.reviewMessageId);
    if (message) {
      await message.edit({ content: resultLine, components: [] }).catch(() => {});
    }
  } catch {
    // تجاهل — القرار محفوظ أصلًا بالداتابيز حتى لو ما قدرنا نعدّل الرسالة.
  }
}

function renderTemplate(str, vars) {
  let out = String(str || '');
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

/**
 * قبول تقديم: يحدّث الحالة، يمنح رتبة القبول إذا محددة، ويرسل خاص للمتقدم.
 */
async function acceptApplication(guild, application, panel, moderator) {
  application.status = 'accepted';
  application.reviewedBy = moderator.id;
  application.reviewedAt = new Date();
  await application.save();

  if (panel?.acceptRoleId) {
    const member = await guild.members.fetch(application.applicantId).catch(() => null);
    if (member) await member.roles.add(panel.acceptRoleId).catch(() => {});
  }

  const applicant = await guild.client.users.fetch(application.applicantId).catch(() => null);
  if (applicant) {
    const msg = renderTemplate(panel?.acceptMessage, { guild: guild.name });
    await applicant.send(buildV2Panel({ description: msg, color: '#2ecc71' })).catch(() => {});
  }

  await lockReviewMessage(
    guild,
    application,
    `✅ تم قبول هذا التقديم من طرف <@${moderator.id}>.`
  );
}

/**
 * رفض تقديم: يحدّث الحالة مع ملاحظة اختيارية، ويرسل خاص للمتقدم.
 */
async function rejectApplication(guild, application, panel, moderator, note = '') {
  application.status = 'rejected';
  application.reviewedBy = moderator.id;
  application.reviewedAt = new Date();
  application.reviewNote = note;
  await application.save();

  const applicant = await guild.client.users.fetch(application.applicantId).catch(() => null);
  if (applicant) {
    let msg = renderTemplate(panel?.rejectMessage, { guild: guild.name });
    if (note) msg += `\n\n📝 **السبب:** ${note}`;
    await applicant.send(buildV2Panel({ description: msg, color: '#e74c3c' })).catch(() => {});
  }

  await lockReviewMessage(
    guild,
    application,
    `❌ تم رفض هذا التقديم من طرف <@${moderator.id}>${note ? ` — السبب: ${note}` : ''}.`
  );
}

module.exports = {
  MAX_QUESTIONS,
  resolvePanel,
  buildPanelPayload,
  buildQuestionModal,
  hasPendingApplication,
  submitApplication,
  acceptApplication,
  rejectApplication
};
