const { PermissionFlagsBits } = require('discord.js');
const shield = require('../services/shieldService');

/**
 * Heat-based anti-spam (Wick style). Every message adds "heat" to its author: a base amount
 * plus extra for mentions, links/invites, attachments, duplicates and very long text. Heat
 * cools off over time; crossing the threshold times the member out. Regular chatters never
 * accumulate enough heat, spammers/raiders do within a couple of seconds.
 */

const COOL_PER_SEC = 9;
const heat = new Map();       // `${guild}:${user}` -> { value, at, last }
const trips = new Map();      // guildId -> [timestamps]
const flagged = new Map();    // guildId -> Map(userId -> ts)
const panicUntil = new Map(); // guildId -> ts

const LINK = /(https?:\/\/|discord\.gg\/|discord(?:app)?\.com\/invite)/gi;

function messageHeat(message, prev) {
  let h = 10;
  h += message.mentions.users.size * 9 + message.mentions.roles.size * 12;
  if (message.mentions.everyone) h += 35;
  h += (message.content.match(LINK) || []).length * 14;
  h += Math.min(message.attachments.size, 5) * 6;
  if (message.content.length > 400) h += 8;
  if (prev && prev.text && prev.text === message.content && message.content.length > 3) h += 18;
  return h;
}

async function handleMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const cfg = await shield.getConfig(message.guild.id);
  const s = cfg.antiSpam;
  if (!s.enabled) return false;
  if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return false;
  if (await shield.isTrusted(message.guild, message.author.id, cfg)) return false;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const prev = heat.get(key);
  const cooled = prev ? Math.max(0, prev.value - ((now - prev.at) / 1000) * COOL_PER_SEC) : 0;
  const value = cooled + messageHeat(message, prev);
  heat.set(key, { value, at: now, text: message.content });
  if (heat.size > 8000) for (const [k, v] of heat) if (now - v.at > 60_000) heat.delete(k);

  // Panic window: anyone already flagged as a raider is timed out for ANY message.
  const inPanic = (panicUntil.get(message.guild.id) || 0) > now;
  const wasFlagged = flagged.get(message.guild.id)?.has(message.author.id);
  if (!(value >= s.threshold) && !(inPanic && wasFlagged)) return false;

  heat.set(key, { value: s.threshold * 0.4, at: now, text: message.content });
  if (s.deleteMessages) await message.delete().catch(() => {});
  const ok = await message.member?.timeout(Math.max(1, s.timeoutMinutes) * 60_000, 'ZETA Shield: spam / heat limit').then(() => true).catch(() => false);
  await shield.record(message.client, message.guild.id, 'spam', {
    userId: message.author.id, action: ok ? `Timed out ${s.timeoutMinutes}m` : 'Could not time out (hierarchy)', reason: `Heat ${Math.round(value)}/${s.threshold} in #${message.channel.name}`
  });

  // 3 spammers in a minute → 10 minute panic window
  const t = (trips.get(message.guild.id) || []).filter((x) => now - x < 60_000);
  t.push(now); trips.set(message.guild.id, t);
  if (!flagged.has(message.guild.id)) flagged.set(message.guild.id, new Map());
  flagged.get(message.guild.id).set(message.author.id, now);
  if (t.length >= 3 && !inPanic) {
    panicUntil.set(message.guild.id, now + 10 * 60_000);
    await shield.record(message.client, message.guild.id, 'panic', { action: 'Spam panic: flagged members are timed out for 10 minutes', reason: `${t.length} spammers in 60s` });
  }
  return true;
}

module.exports = { handleMessage };
