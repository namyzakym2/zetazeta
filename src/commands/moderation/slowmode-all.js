const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode-all')
    .setDescription('ضبط السلو-مود على كل القنوات النصية / Set slowmode on every text channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) =>
      opt.setName('seconds')
        .setDescription('عدد الثواني (0 لإلغاء السلو-مود)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const seconds = interaction.options.getInteger('seconds', true);

    await interaction.deferReply();

    const channels = interaction.guild.channels.cache.filter(
      (ch) => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement
    );

    let success = 0;
    let failed = 0;

    for (const channel of channels.values()) {
      try {
        await channel.setRateLimitPerUser(seconds);
        success++;
      } catch {
        failed++;
      }
    }

    await logService.log(interaction.client, interaction.guild.id, 'slowmode', {
      Scope: 'All Channels',
      Seconds: `${seconds}`,
      By: `<@${interaction.user.id}>`
    });

    return interaction.editReply(
      `🐌 تم ضبط السلو-مود (${seconds} ثانية) على ${success} قناة${failed ? `، فشل بـ ${failed} قناة` : ''}.`
    );
  }
};
