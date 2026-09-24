const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('ضبط الوضع البطيء للقناة الحالية / Set slowmode on the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((opt) => opt.setName('seconds').setDescription('عدد الثواني (0 لإيقاف)').setRequired(true).setMinValue(0).setMaxValue(21600)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageChannels(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const seconds = interaction.options.getInteger('seconds', true);
    await interaction.channel.setRateLimitPerUser(seconds);

    await logService.log(interaction.client, interaction.guild.id, 'slowmode', {
      Channel: `<#${interaction.channel.id}>`,
      Seconds: seconds,
      Moderator: `<@${interaction.user.id}>`
    });

    return interaction.reply(seconds === 0 ? '🐌 تم إيقاف الوضع البطيء.' : `🐌 تم ضبط الوضع البطيء على ${seconds} ثانية.`);
  }
};
