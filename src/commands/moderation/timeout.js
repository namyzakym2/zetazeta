const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const recentBotActions = require('../../utils/recentBotActions');
const staffPointsService = require('../../services/staffPointsService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('إسكات مؤقت لعضو / Timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true))
    .addIntegerOption((opt) => opt.setName('minutes').setDescription('المدة بالدقائق').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((opt) => opt.setName('reason').setDescription('السبب').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.timeout(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ العضو غير موجود في السيرفر.', ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: '❌ لا أستطيع إسكات هذا العضو.', ephemeral: true });

    recentBotActions.mark(interaction.guild.id, target.id, 'timeout');
    await member.timeout(minutes * 60 * 1000, reason);

    await logService.log(interaction.client, interaction.guild.id, 'timeout', {
      User: `${target.tag} (${target.id})`,
      Moderator: `<@${interaction.user.id}>`,
      Duration: `${minutes}m`,
      Reason: reason
    });

    await staffPointsService
      .awardCommandPoints(interaction.client, interaction.guild.id, interaction.user.id, 'timeout')
      .catch(() => {});

    return interaction.reply(`⏱️ تم إسكات **${target.tag}** لمدة ${minutes} دقيقة\nالسبب: ${reason}`);
  }
};
