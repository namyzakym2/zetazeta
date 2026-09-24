const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economyService = require('../../services/economyService');
const voteService = require('../../services/voteService');
const { formatMoney } = require('../../utils/formatMoney');
const { t } = require('../../services/translationService');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder().setName('vote').setDescription('صوّت للبوت / Vote for the bot'),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });

    const guildDoc = await economyService.getGuildSettings(interaction.guild.id);
    const locale = guildDoc.locale || 'ar';

    // IMPORTANT: this command NEVER grants VC. Reward only happens via voteService.handleIncomingVote
    // when the vote provider (Voite.gg) confirms the vote through its webhook/API.
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel(t(locale, 'vote.button')).setStyle(ButtonStyle.Link).setURL(voteService.getVoteUrl())
    );

    const panel = buildV2Panel({
      title: t(locale, 'vote.title'),
      color: '#0f2158',
      description: `${t(locale, 'vote.description')}\n\n💰 +${formatMoney(guildDoc.voteReward)}`,
      rows: [row]
    });

    return interaction.reply(panel);
  }
};
