const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can, canModerate } = require('../../utils/permissions');
const logService = require('../../services/logService');
const recentBotActions = require('../../utils/recentBotActions');
const staffPointsService = require('../../services/staffPointsService');
const { t } = require('../../services/translationService');
const { getZetaBotEmoji } = require('../../utils/zetaEmojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('حظر عضو / Ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('السبب').setRequired(false))
    .addIntegerOption((opt) => opt.setName('delete_days').setDescription('حذف رسائل آخر X يوم').setMinValue(0).setMaxValue(7)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    // Real Discord permission check — never rely on hiding the command only.
    if (!can.ban(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const hierarchyCheck = canModerate(interaction, member);
    if (!hierarchyCheck.ok) return interaction.reply({ content: hierarchyCheck.reason, ephemeral: true });
    if (member && !member.bannable) {
      return interaction.reply({ content: '❌ لا أستطيع حظر هذا العضو (صلاحياته أعلى مني أو مني).', ephemeral: true });
    }

    recentBotActions.mark(interaction.guild.id, target.id, 'ban');
    await interaction.guild.members.ban(target.id, { reason, deleteMessageSeconds: deleteDays * 86400 });

    await logService.log(interaction.client, interaction.guild.id, 'ban', {
      User: `${target.tag} (${target.id})`,
      Moderator: `<@${interaction.user.id}>`,
      Reason: reason
    });

    await staffPointsService
      .awardCommandPoints(interaction.client, interaction.guild.id, interaction.user.id, 'ban')
      .catch(() => {});

    return interaction.reply(`${getZetaBotEmoji('ban') || '🔨'} تم حظر **${target.tag}**\nالسبب: ${reason}`);
  }
};
