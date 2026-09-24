const GuildModel = require('../models/Guild');

/**
 * levelup — sends the (fully customizable) level-up announcement when a member's
 * level increases. Configured via /system levelup-channel and /system levelup-message.
 */
async function handleLevelUp(message, user) {
  const guildDoc = await GuildModel.findOne({ guildId: message.guild.id });
  if (!guildDoc?.levelUp?.enabled) return;

  // Empty channelId means "announce right where the user leveled up".
  const channel = guildDoc.levelUp.channelId
    ? message.guild.channels.cache.get(guildDoc.levelUp.channelId)
    : message.channel;
  if (!channel?.isTextBased()) return;

  const text = (guildDoc.levelUp.message || '🎉 {mention} اترقي مستواك ووصل الي مرحلة ثانية ليصل الي    **{level}**! استكمل مشوارك في التفاعل لكي تصبح اقوي')
    .replaceAll('{mention}', `<@${message.author.id}>`)
    .replaceAll('{username}', message.author.username)
    .replaceAll('{level}', String(user.level))
    .replaceAll('{server}', message.guild.name);

  await channel.send({ content: text }).catch(() => {});
}

module.exports = { handleLevelUp };
