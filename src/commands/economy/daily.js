const { SlashCommandBuilder } = require('discord.js');
const economyService = require('../../services/economyService');
const logService = require('../../services/logService');
const { formatMoney } = require('../../utils/formatMoney');
const { formatDuration, msUntil } = require('../../utils/time');
const { t } = require('../../services/translationService');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder().setName('daily').setDescription('استلم مكافأتك اليومية / Claim your daily reward'),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });

    const guildDoc = await economyService.getGuildSettings(interaction.guild.id);
    const locale = guildDoc.locale || 'ar';

    try {
      const result = await economyService.claimDaily(interaction.guild.id, interaction.user.id);

      const panel = buildV2Panel({
        title: t(locale, 'daily.title'),
        color: '#0f2158',
        description: `${t(locale, 'daily.received')}:\n💰 +${formatMoney(result.amount)}`,
        fields: [
          { name: t(locale, 'daily.streak'), value: `${result.streak} Days` },
          { name: t(locale, 'daily.balance'), value: formatMoney(result.balance) }
        ]
      });

      await logService.log(interaction.client, interaction.guild.id, 'dailyClaim', {
        User: `<@${interaction.user.id}>`,
        Amount: formatMoney(result.amount),
        Streak: result.streak
      });

      return interaction.reply(panel);
    } catch (err) {
      if (err.message === 'ALREADY_CLAIMED') {
        const remaining = msUntil(err.nextAvailableAt);
        return interaction.reply({ content: t(locale, 'daily.alreadyClaimed', { time: formatDuration(remaining) }), ephemeral: true });
      }
      throw err;
    }
  }
};
