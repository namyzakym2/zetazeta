const User = require('../models/User');
const GuildModel = require('../models/Guild');

/**
 * activityService — tracks XP / level / messages.
 * Settings are server-specific and are cached briefly so normal chat does not
 * perform a database read for every message.
 */
const XP_PER_MESSAGE = 1;
const XP_PER_LEVEL = 200;
const MESSAGE_COOLDOWN_MS = 60 * 1000;
const SETTINGS_TTL_MS = 30 * 1000;
const settingsCache = new Map();
const lastXpGain = new Map();

function xpForLevel(level) {
  return (level + 1) * XP_PER_LEVEL;
}

async function getLevelSettings(guildId) {
  const cached = settingsCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const guild = await GuildModel.findOne({ guildId }).lean().catch(() => null);
  const value = {
    enabled: guild?.levelSettings?.enabled !== false,
    xpPerMessage: Number.isFinite(Number(guild?.levelSettings?.xpPerMessage))
      ? Math.max(0, Math.min(100, Number(guild.levelSettings.xpPerMessage)))
      : XP_PER_MESSAGE,
    messageCooldownSeconds: Number.isFinite(Number(guild?.levelSettings?.messageCooldownSeconds))
      ? Math.max(0, Math.min(3600, Number(guild.levelSettings.messageCooldownSeconds)))
      : 60,
    xpPerVoiceMinute: Number.isFinite(Number(guild?.levelSettings?.xpPerVoiceMinute))
      ? Math.max(0, Math.min(100, Number(guild.levelSettings.xpPerVoiceMinute)))
      : 0,
    resetOnLeave: guild?.levelSettings?.resetOnLeave === true,
    disabledChannelIds: Array.isArray(guild?.levelSettings?.disabledChannelIds) ? guild.levelSettings.disabledChannelIds : [],
    disabledRoleIds: Array.isArray(guild?.levelSettings?.disabledRoleIds) ? guild.levelSettings.disabledRoleIds : [],
    roleMultipliers: Array.isArray(guild?.levelSettings?.roleMultipliers) ? guild.levelSettings.roleMultipliers : [],
    channelMultipliers: Array.isArray(guild?.levelSettings?.channelMultipliers) ? guild.levelSettings.channelMultipliers : []
  };
  settingsCache.set(guildId, { value, expiresAt: Date.now() + SETTINGS_TTL_MS });
  return value;
}

function clearSettingsCache(guildId) {
  if (guildId) settingsCache.delete(guildId);
}

function multiplierFor(settings, message) {
  if (!message) return 1;
  if (settings.disabledChannelIds.includes(message.channel?.id)) return 0;
  const roles = message.member?.roles?.cache;
  if (roles && settings.disabledRoleIds.some((id) => roles.has(id))) return 0;

  let multiplier = 1;
  for (const row of settings.channelMultipliers) {
    if (row?.channelId === message.channel?.id) multiplier = Math.max(multiplier, Number(row.multiplier) || 1);
  }
  if (roles) {
    for (const row of settings.roleMultipliers) {
      if (row?.roleId && roles.has(row.roleId)) multiplier = Math.max(multiplier, Number(row.multiplier) || 1);
    }
  }
  return Math.max(0, Math.min(10, multiplier));
}

async function registerMessage(guildId, userId, message = null) {
  const settings = await getLevelSettings(guildId);
  const key = `${guildId}:${userId}`;
  const now = Date.now();

  await User.findOneAndUpdate(
    { guildId, userId },
    { $setOnInsert: { guildId, userId, firstActiveAt: new Date(now), lastActiveAt: new Date(now) } },
    { upsert: true, setDefaultsOnInsert: true }
  );

  const mult = settings.enabled ? multiplierFor(settings, message) : 0;
  const lastGain = lastXpGain.get(key) || 0;
  const cooldownMs = Math.max(0, settings.messageCooldownSeconds) * 1000;
  const shouldGrantXp = mult > 0 && (cooldownMs === 0 || now - lastGain >= cooldownMs);

  const update = { $inc: { messages: 1 }, $set: { lastActiveAt: new Date(now) } };
  if (shouldGrantXp) {
    update.$inc.xp = Math.round(settings.xpPerMessage * mult);
    lastXpGain.set(key, now);
  }

  const updated = await User.findOneAndUpdate({ guildId, userId }, update, { new: true });
  let leveledUp = false;
  while (updated.xp >= xpForLevel(updated.level)) {
    updated.level += 1;
    leveledUp = true;
  }
  if (leveledUp) await updated.save();

  return { user: updated, leveledUp };
}

async function addVoiceXp(guildId, userId, wholeMinutes) {
  const settings = await getLevelSettings(guildId);
  const amount = Math.max(0, Math.floor(Number(wholeMinutes) || 0) * settings.xpPerVoiceMinute);
  if (!settings.enabled || amount <= 0) return { leveledUp: false, xp: 0 };

  const updated = await User.findOneAndUpdate(
    { guildId, userId },
    { $inc: { xp: amount }, $set: { lastActiveAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  let leveledUp = false;
  while (updated.xp >= xpForLevel(updated.level)) {
    updated.level += 1;
    leveledUp = true;
  }
  if (leveledUp) await updated.save();
  return { leveledUp, xp: amount, user: updated };
}

async function resetUser(guildId, userId) {
  await User.findOneAndUpdate(
    { guildId, userId },
    { $set: { xp: 0, level: 0, messages: 0 } }
  ).catch(() => {});
  lastXpGain.delete(`${guildId}:${userId}`);
}

async function getActivity(guildId, userId) {
  return User.findOne({ guildId, userId });
}

async function getRank(guildId, userId) {
  const all = await User.find({ guildId }).sort({ xp: -1 }).select('userId');
  const idx = all.findIndex((u) => u.userId === userId);
  return idx === -1 ? null : idx + 1;
}

async function getLeaderboard(guildId, type = 'text', period = 'alltime', limit = 10) {
  try {
    if (typeof type === 'number') {
      limit = type; type = 'text'; period = 'alltime';
    } else if (typeof period === 'number') {
      limit = period; period = 'alltime';
    }
    const sort = type === 'voice'
      ? { voicePoints: -1, voiceSeconds: -1 }
      : { xp: -1, level: -1, messages: -1 };
    const filter = { guildId };
    if (type === 'voice') filter.voiceSeconds = { $gt: 0 };
    return (await User.find(filter).sort(sort).limit(limit).lean()) || [];
  } catch (error) {
    console.error('Error fetching leaderboard in activityService:', error);
    return [];
  }
}

module.exports = {
  registerMessage, addVoiceXp, resetUser, getActivity, getRank,
  getLeaderboard, xpForLevel, getLevelSettings, clearSettingsCache
};
