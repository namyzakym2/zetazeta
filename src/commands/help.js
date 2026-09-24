'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('عرض قائمة أوامر ZETA ومعلومات المساعدة');

const { setEmojiSafe } = require('../utils/emoji');

function commandLine(name, description) {
  return `**/${name}** — ${description}`;
}

async function execute(interaction) {
  const client = interaction.client;
  const supportInvite = process.env.ZETA_SUPPORT_INVITE;
  const dashboardUrl = process.env.DASHBOARD_URL;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: `${client.user.username} • مركز المساعدة`,
      iconURL: client.user.displayAvatarURL({ size: 128 })
    })
    .setTitle('مساعدة ZETA')
    .setDescription(
      'كل أوامر البوت الأساسية في مكان واحد. استخدم الأوامر مباشرة أو افتح لوحة التحكم لإدارة السيرفر بسهولة.'
    )
    .addFields(
      {
        name: '🛡️ الإدارة والحماية',
        value: [
          commandLine('ban', 'حظر عضو'),
          commandLine('kick', 'طرد عضو'),
          commandLine('mute', 'كتم عضو'),
          commandLine('timeout', 'تقييد عضو مؤقتًا'),
          commandLine('warn', 'إعطاء تحذير'),
          commandLine('clear', 'حذف الرسائل')
        ].join('\n'),
        inline: true
      },
      {
        name: '🎫 السيرفر والأنظمة',
        value: [
          commandLine('ticket-panel', 'لوحة التذاكر'),
          commandLine('greet', 'إعداد الترحيب'),
          commandLine('giveaway', 'إدارة المسابقات'),
          commandLine('system', 'إعدادات الأنظمة'),
          commandLine('report', 'البلاغات'),
          commandLine('language', 'تغيير لغة البوت')
        ].join('\n'),
        inline: true
      },
      {
        name: '💰 الاقتصاد والمجتمع',
        value: [
          commandLine('zeta', 'المحفظة'),
          commandLine('daily', 'المكافأة اليومية'),
          commandLine('salary', 'الراتب'),
          commandLine('vote', 'التصويت'),
          commandLine('profile', 'الملف الشخصي'),
          commandLine('top', 'المتصدرين')
        ].join('\n'),
        inline: true
      },
      {
        name: '⚙️ أدوات ZETA',
        value: [
          commandLine('botprofile', 'تخصيص اسم وصورة البوت لهذا السيرفر'),
          commandLine('serverstats', 'إحصائيات السيرفر'),
          commandLine('invite', 'رابط دعوة البوت'),
        ].join('\n'),
        inline: true
      }
    )
    .setFooter({ text: `ZETA • ${client.commands?.size || 0} أمر متاح` })
    .setTimestamp();

  const components = [];
  const row = new ActionRowBuilder();

  if (dashboardUrl && /^https?:\/\//i.test(dashboardUrl)) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('لوحة التحكم')
        .setStyle(ButtonStyle.Link)
        .setURL(dashboardUrl)
    );
  }

  if (supportInvite) {
    const inviteUrl = /^https?:\/\//i.test(supportInvite)
      ? supportInvite
      : `https://discord.gg/${supportInvite.replace(/^\//, '')}`;
    const supportButton = new ButtonBuilder()
      .setLabel('سيرفر الدعم')
      .setStyle(ButtonStyle.Link)
      .setURL(inviteUrl);
    setEmojiSafe(supportButton, 'discord', 'discord');
    row.addComponents(supportButton);
  }

  if (row.components.length) components.push(row);

  return interaction.reply({ embeds: [embed], components });
}

module.exports = { data, execute };
