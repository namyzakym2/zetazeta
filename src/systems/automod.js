const GuildModel = require('../models/Guild');
const logService = require('../services/logService');

// In-memory trackers for flood/spam/duplicate detection (per guild+user)
const recentMessages = new Map(); // key: guildId:userId -> [{content, ts}]
const FLOOD_WINDOW_MS = 6000;
const FLOOD_MAX_MESSAGES = 5;
const URL_REGEX = /(https?:\/\/[^\s]+)/i;

function pushRecent(key, entry) {
  const arr = recentMessages.get(key) || [];
  arr.push(entry);
  const cutoff = Date.now() - FLOOD_WINDOW_MS;
  const trimmed = arr.filter((e) => e.ts >= cutoff);
  recentMessages.set(key, trimmed);
  return trimmed;
}

async function moderate(message) {
  if (message.author.bot || !message.guild) return false;

  const guildDoc = await GuildModel.findOne({ guildId: message.guild.id });
  if (!guildDoc?.automod?.enabled) return false;

  // The seller room (src/systems/sellerRoom.js, configured via /set-room) has its own
  // moderation rules and runs AFTER this in messageCreate's pipeline. Without this
  // exemption, automod (especially "Links protection") would delete a verified
  // seller's listing — links, prices, contact info are exactly what sellers post —
  // before sellerRoom.handleMessage() ever got a chance to repost it as a listing.
  // That made the seller room look broken any time automod was also enabled.
  if (guildDoc.sellerRoom?.enabled && guildDoc.sellerRoom.channelId === message.channel.id) return false;

  const settings = guildDoc.automod;
  const key = `${message.guild.id}:${message.author.id}`;
  let violated = null;

  // Banned words
  if (settings.bannedWords?.length) {
    const lower = message.content.toLowerCase();
    if (settings.bannedWords.some((w) => lower.includes(w.toLowerCase()))) {
      violated = 'Banned word';
    }
  }

  // Links protection
  if (!violated && settings.linksProtection && URL_REGEX.test(message.content)) {
    violated = 'Link posted';
  }

  // Mention spam
  if (!violated && message.mentions.users.size >= (settings.mentionSpamLimit || 5)) {
    violated = 'Mention spam';
  }

  // Flood / spam protection
  const recent = pushRecent(key, { content: message.content, ts: Date.now() });
  if (!violated && settings.floodProtection && recent.length > FLOOD_MAX_MESSAGES) {
    violated = 'Flood protection';
  }

  // Duplicate messages
  if (!violated && settings.duplicateMessageProtection) {
    const duplicates = recent.filter((e) => e.content === message.content);
    if (duplicates.length >= 3) violated = 'Duplicate messages';
  }

  if (violated) {
    await message.delete().catch(() => {});
    await logService.log(message.client, message.guild.id, 'automod', {
      User: `<@${message.author.id}>`,
      Reason: violated,
      Channel: `<#${message.channel.id}>`
    });
    return true;
  }

  return false;
}

module.exports = { moderate };
