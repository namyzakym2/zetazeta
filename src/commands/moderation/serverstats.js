const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { can } = require('../../utils/permissions');
const { t } = require('../../services/translationService');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverstats')
    .setDescription('عرض إحصائيات السيرفر / Show server statistics'),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const guild = interaction.guild;
    await interaction.deferReply();

    const members = await guild.members.fetch();
    const humans = members.filter((m) => !m.user.bot).size;
    const bots = members.filter((m) => m.user.bot).size;
    const online = members.filter((m) => m.presence && m.presence.status !== 'offline').size;

    const channels = guild.channels.cache;
    const textChannels = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter((c) => c.type === ChannelType.GuildCategory).size;

    const roles = guild.roles.cache.size - 1; // minus @everyone
    const boosts = guild.premiumSubscriptionCount || 0;
    const boostTier = guild.premiumTier || 0;

    const panel = buildV2Panel({
      title: `📊 إحصائيات ${guild.name}`,
      thumbnail: guild.iconURL(),
      color: '#5865F2',
      fields: [
        { name: '👥 الأعضاء', value: `${guild.memberCount}` },
        { name: '🧑 بشر', value: `${humans}` },
        { name: '🤖 بوتات', value: `${bots}` },
        { name: '🟢 متصل الآن', value: `${online}` },
        { name: '💬 قنوات نصية', value: `${textChannels}` },
        { name: '🔊 قنوات صوتية', value: `${voiceChannels}` },
        { name: '🗂️ تصنيفات', value: `${categories}` },
        { name: '🎭 رتب', value: `${roles}` },
        { name: '🚀 بوستات', value: `${boosts} (Tier ${boostTier})` },
        { name: '📅 تاريخ الإنشاء', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>` },
        { name: '👑 المالك', value: `<@${guild.ownerId}>` }
      ],
      timestamp: true
    });

    return interaction.editReply(panel);
  }
};
