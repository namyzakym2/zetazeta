const BlockedGuild = require('../models/BlockedGuild');
const BotGuild = require('../models/BotGuild');

/**
 * guildBlockService — ZetaBot Panel only (dashboard/routes/devilPanel.js). Blocking a
 * guild means ZETA immediately leaves it (if currently in it) and refuses to stay
 * if re-invited (src/events/guildCreate.js checks isBlocked() on every join).
 */

async function isBlocked(guildId) {
  return Boolean(await BlockedGuild.exists({ guildId }));
}

async function block(guildId, reason, adminUserId) {
  return BlockedGuild.findOneAndUpdate(
    { guildId },
    { guildId, reason: reason || '', blockedBy: adminUserId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function unblock(guildId) {
  await BlockedGuild.deleteOne({ guildId });
}

async function listBlocked() {
  return BlockedGuild.find({}).sort({ createdAt: -1 });
}

/**
 * Actually removes the bot from a guild it's currently in, and drops the BotGuild
 * record so the dashboard server-picker stops showing it. Safe no-op if the bot
 * isn't in that guild (already left, or was never in it).
 */
async function leaveGuildIfPresent(discordClient, guildId) {
  const guild = discordClient?.guilds.cache.get(guildId);
  if (guild) {
    await guild.leave().catch(() => {});
  }
  await BotGuild.deleteOne({ guildId });
}

module.exports = { isBlocked, block, unblock, listBlocked, leaveGuildIfPresent };
