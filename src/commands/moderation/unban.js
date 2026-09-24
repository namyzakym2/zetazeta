const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const recentBotActions = require('../../utils/recentBotActions');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('فك حظر عضو / Unban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((opt) => opt.setName('user_id').setDescription('معرف المستخدم (ID)').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('السبب').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.ban(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const userId = interaction.options.getString('user_id', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const bans = await interaction.guild.bans.fetch();
    const ban = bans.get(userId);
    if (!ban) return interaction.reply({ content: '❌ هذا المستخدم غير محظور.', ephemeral: true });

    recentBotActions.mark(interaction.guild.id, userId, 'unban');
    await interaction.guild.members.unban(userId, reason);

    await logService.log(interaction.client, interaction.guild.id, 'unban', {
      User: `${ban.user.tag} (${userId})`,
      Moderator: `<@${interaction.user.id}>`,
      Reason: reason
    });

    return interaction.reply(`🔓 تم فك حظر **${ban.user.tag}**\nالسبب: ${reason}`);
  }
};
