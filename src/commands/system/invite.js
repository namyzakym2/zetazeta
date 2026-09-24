const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { t } = require('../../services/translationService');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('الحصول على رابط دعوة البوت / سيرفر الدعم / Get the invite link'),

  async execute(interaction) {
    // ضع الرابط هنا (سيرفر الدعم مثلًا)، أو خله فاضي عشان يستخدم رابط دعوة البوت تلقائيًا
    const customLink = process.env.INVITE_LINK || '';

    // رابط دعوة البوت الافتراضي (يحتاج CLIENT_ID في ملف .env)
    const botInviteLink = process.env.CLIENT_ID
      ? `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`
      : null;

    const link = customLink || botInviteLink;

    if (!link) {
      return interaction.reply({
        content: '❌ لم يتم ضبط رابط الدعوة بعد، تواصل مع مطوّر البوت.',
        ephemeral: true
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('اضغط هنا').setStyle(ButtonStyle.Link).setURL(link)
    );

    const panel = buildV2Panel({
      title: '📩 دعوة',
      description: 'اضغط على الزر بالأسفل للانضمام / إضافة البوت.',
      color: '#5865F2',
      timestamp: true,
      rows: [row]
    });

    return interaction.reply(panel);
  }
};
