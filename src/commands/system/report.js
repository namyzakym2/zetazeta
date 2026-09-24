const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GuildModel = require('../../models/Guild');
const Report = require('../../models/Report');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('تقديم بلاغ للإدارة عن عضو / Submit a report to the admin team')
    .addUserOption((opt) => opt.setName('user').setDescription('العضو المُبلَّغ عنه').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('سبب البلاغ').setRequired(true)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });

    const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id }) || await GuildModel.create({ guildId: interaction.guild.id });

    if (!guildDoc.reports?.enabled || !guildDoc.reports.channelId) {
      return interaction.reply({ content: '❌ نظام البلاغات غير مفعّل في هذا السيرفر حاليًا.', ephemeral: true });
    }

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '❌ لا يمكنك الإبلاغ عن نفسك.', ephemeral: true });
    }
    if (target.bot) {
      return interaction.reply({ content: '❌ لا يمكن الإبلاغ عن بوت.', ephemeral: true });
    }

    const reportsChannel = interaction.guild.channels.cache.get(guildDoc.reports.channelId);
    if (!reportsChannel?.isTextBased()) {
      return interaction.reply({ content: '❌ قناة البلاغات غير موجودة، تواصل مع الإدارة.', ephemeral: true });
    }

    const report = await Report.create({
      guildId: interaction.guild.id,
      reporterId: interaction.user.id,
      targetId: target.id,
      reason,
      channelId: interaction.channel.id
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`report_review_${report._id}`).setLabel('Mark Reviewed').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`report_dismiss_${report._id}`).setLabel('Dismiss').setStyle(ButtonStyle.Secondary)
    );

    const panel = buildV2Panel({
      title: '🚨 New Report',
      color: '#faa61a',
      fields: [
        { name: 'Reported User', value: `<@${target.id}> (${target.id})` },
        { name: 'Reported By', value: `<@${interaction.user.id}>` },
        { name: 'Reason', value: reason },
        { name: 'Source Channel', value: `<#${interaction.channel.id}>` }
      ],
      footer: `Report ID: ${report._id}`,
      timestamp: true,
      rows: [row]
    });

    await reportsChannel.send(panel);

    await logService.log(interaction.client, interaction.guild.id, 'reportSubmitted', {
      Target: `<@${target.id}>`,
      Reporter: `<@${interaction.user.id}>`
    });

    return interaction.reply({ content: '✅ تم إرسال بلاغك إلى الإدارة، شكرًا لك.', ephemeral: true });
  }
};
