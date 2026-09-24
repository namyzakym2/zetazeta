const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unhide')
    .setDescription('إظهار القناة الحالية للأعضاء / Show the current channel to everyone')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageChannels(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null });

    await logService.log(interaction.client, interaction.guild.id, 'unhide', {
      Channel: `<#${interaction.channel.id}>`,
      By: `<@${interaction.user.id}>`
    });

    return interaction.reply('👁️ تم إظهار هذه القناة للأعضاء.');
  }
};
