const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can, canModerate } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('حظر مؤقت لحذف رسائل العضو ثم فك الحظر فورًا / Softban (purge messages, no permanent ban)')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true))
    .addIntegerOption((opt) => opt.setName('delete_days').setDescription('حذف رسائل آخر X يوم').setMinValue(1).setMaxValue(7))
    .addStringOption((opt) => opt.setName('reason').setDescription('السبب').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.ban(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const deleteDays = interaction.options.getInteger('delete_days') || 1;
    const reason = interaction.options.getString('reason') || 'Softban';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const hierarchyCheck = canModerate(interaction, member);
    if (!hierarchyCheck.ok) return interaction.reply({ content: hierarchyCheck.reason, ephemeral: true });
    if (member && !member.bannable) {
      return interaction.reply({ content: '❌ لا أستطيع تنفيذ هذا الإجراء على هذا العضو.', ephemeral: true });
    }

    await interaction.guild.members.ban(target.id, { reason, deleteMessageSeconds: deleteDays * 86400 });
    await interaction.guild.members.unban(target.id, 'Softban auto-unban');

    await logService.log(interaction.client, interaction.guild.id, 'softban', {
      User: `${target.tag} (${target.id})`,
      Moderator: `<@${interaction.user.id}>`,
      Reason: reason
    });

    return interaction.reply(`🔨 تم عمل Softban لـ **${target.tag}** (تم حذف رسائله وفك الحظر تلقائيًا)\nالسبب: ${reason}`);
  }
};
