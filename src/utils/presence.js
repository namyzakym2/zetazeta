const { ActivityType } = require('discord.js');

/**
 * presence — keeps the bot's Discord status/activity showing "Developer: <owner> |
 * N servers", refreshed every time the guild count actually changes (join/leave),
 * plus once on startup. The owner's username is fetched once and cached (it doesn't
 * change at runtime); only the server count is re-read live from the client's guild
 * cache on every call, so it's always accurate the moment a guildCreate/guildDelete
 * event fires — no polling needed.
 */

let cachedOwnerTag = null;

async function getOwnerTag(client) {
  if (cachedOwnerTag) return cachedOwnerTag;

  const ownerId = process.env.OWNER_ID;
  if (!ownerId) {
    cachedOwnerTag = 'Unknown';
    return cachedOwnerTag;
  }

  try {
    const owner = await client.users.fetch(ownerId);
    cachedOwnerTag = owner.username;
  } catch (err) {
    console.error('⚠️ Could not fetch OWNER_ID user for presence status:', err.message);
    cachedOwnerTag = 'Unknown';
  }

  return cachedOwnerTag;
}

async function updatePresence(client) {
  const ownerTag = await getOwnerTag(client);
  const guildCount = client.guilds.cache.size;

  client.user.setActivity(`Developer: ${ownerTag} | ${guildCount} servers`, { type: ActivityType.Watching });
}

module.exports = { updatePresence };
