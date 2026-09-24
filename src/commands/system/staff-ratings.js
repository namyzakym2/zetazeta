const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const staffRatingService = require('../../services/staffRatingService');
const { buildV2Panel } = require('../../utils/componentsV2');

/**
 * /staff-ratings — تقييم الإدارة: يعرض متوسط تقييم إداري معين، أو قائمة
 * أفضل الإداريين تقييمًا بالسيرفر إذا ما تم تحديد أحد.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-ratings')
    .setDescription('تقييم الإدارة / Staff ratings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((o) => o.setName('staff').setDescription('إداري معين (اختياري)').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'هذا الأمر يشتغل داخل سيرفر بس.', ephemeral: true });

    const target = interaction.options.getUser('staff');

    if (target) {
      const { average, count } = await staffRatingService.getStaffAverage(interaction.guild.id, target.id);
      const panel = buildV2Panel({
        title: `⭐ تقييم <@${target.id}>`,
        color: '#F1C40F',
        thumbnail: target.displayAvatarURL(),
        description: count
          ? `**المتوسط:** ${average} / 5 ⭐\n**عدد التقييمات:** ${count}`
          : 'لا يوجد تقييمات بعد لهذا الإداري.'
      });
      return interaction.reply(panel);
    }

    const leaderboard = await staffRatingService.getLeaderboard(interaction.guild.id, 10);
    const description = leaderboard.length
      ? leaderboard
          .map((e, i) => `**#${i + 1}** <@${e.staffId}> — ${e.average} / 5 ⭐ (${e.count} تقييم)`)
          .join('\n')
      : 'لا يوجد أي تقييمات بعد.';

    const panel = buildV2Panel({
      title: '🏆 أفضل الإداريين تقييمًا',
      color: '#F1C40F',
      description
    });

    return interaction.reply(panel);
  }
};
