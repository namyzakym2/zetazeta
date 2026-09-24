const GuildModel = require('../models/Guild');
const { t } = require('../services/translationService');
const { buildV2Panel } = require('../utils/componentsV2');

async function handleMemberRemove(member) {
  const guildDoc = await GuildModel.findOne({ guildId: member.guild.id });
  if (!guildDoc || !guildDoc.leave?.enabled || !guildDoc.leave.channelId) return;

  const channel = member.guild.channels.cache.get(guildDoc.leave.channelId);
  if (!channel?.isTextBased()) return;

  const rawMessage = guildDoc.leave.message || '';
  const message = rawMessage
    .replaceAll('{user}', member.user.username)
    .replaceAll('{mention}', member.user.username)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));

  const panel = buildV2Panel({
    title: t(guildDoc.locale, 'leave.title'),
    description: message,
    color: '#0f2158',
    thumbnail: member.user.displayAvatarURL()
  });

  await channel.send(panel).catch(() => {});
}

module.exports = { handleMemberRemove };
