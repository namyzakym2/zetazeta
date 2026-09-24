const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can, canModerate } = require('../../utils/permissions');
const logService = require('../../services/logService');
const staffPointsService = require('../../services/staffPointsService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('طرد عضو / Kick a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('السبب').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.kick(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ العضو غير موجود في السيرفر.', ephemeral: true });
    const hierarchyCheck = canModerate(interaction, member);
    if (!hierarchyCheck.ok) return interaction.reply({ content: hierarchyCheck.reason, ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: '❌ لا أستطيع طرد هذا العضو.', ephemeral: true });

    await member.kick(reason);

    await logService.log(interaction.client, interaction.guild.id, 'kick', {
      User: `${target.tag} (${target.id})`,
      Moderator: `<@${interaction.user.id}>`,
      Reason: reason
    });

    await staffPointsService
      .awardCommandPoints(interaction.client, interaction.guild.id, interaction.user.id, 'kick')
      .catch(() => {});

    return interaction.reply(`👢 تم طرد **${target.tag}**\nالسبب: ${reason}`);
  }
};
