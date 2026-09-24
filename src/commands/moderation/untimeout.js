const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const translationService = require('../../services/translationService');
const logService = require('../../services/logService');
const recentBotActions = require('../../utils/recentBotActions');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove timeout from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('target')
        .setDescription('The user to remove timeout from')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for removing timeout')),

  async execute(interaction) {
    const lang = await translationService.getGuildLanguage(interaction.guild.id);
    const target = interaction.options.getMember('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) {
      return interaction.reply({
        content: lang === 'ar' ? '❌ تعذر العثور على العضو في السيرفر.' : '❌ Member not found in this guild.',
        ephemeral: true
      });
    }

    if (!target.isCommunicationDisabled()) {
      return interaction.reply({
        content: lang === 'ar' ? '⚠️ هذا العضو ليس في حالة تايم أوت (العزل).' : '⚠️ This member is not timed out.',
        ephemeral: true
      });
    }

    try {
      recentBotActions.mark(interaction.guild.id, target.id, 'untimeout');
      await target.timeout(null, reason);

      await logService.log(interaction.client, interaction.guild.id, 'untimeout', {
        User: `${target.user.tag} (${target.id})`,
        Moderator: `<@${interaction.user.id}>`,
        Reason: reason
      });

      const panel = buildV2Panel({
        color: '#2ecc71',
        title: lang === 'ar' ? '✅ تم إزالة التايم أوت' : '✅ Timeout Removed',
        fields: [
          { name: lang === 'ar' ? 'المستخدم' : 'User', value: `${target.user.tag} (${target.id})` },
          { name: lang === 'ar' ? 'بواسطة' : 'By', value: `${interaction.user.tag}` },
          { name: lang === 'ar' ? 'السبب' : 'Reason', value: reason }
        ],
        timestamp: true
      });

      return interaction.reply(panel);
    } catch (error) {
      console.error(error);
      return interaction.reply({
        content: lang === 'ar' ? '❌ حدث خطأ أثناء إزالة التايم أوت.' : '❌ Failed to remove timeout.',
        ephemeral: true
      });
    }
  }
};