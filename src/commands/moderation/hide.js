const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hide')
    .setDescription('إخفاء القناة الحالية عن الأعضاء / Hide the current channel from everyone')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageChannels(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });

    await logService.log(interaction.client, interaction.guild.id, 'hide', {
      Channel: `<#${interaction.channel.id}>`,
      By: `<@${interaction.user.id}>`
    });

    return interaction.reply('🙈 تم إخفاء هذه القناة عن الأعضاء.');
  }
};
