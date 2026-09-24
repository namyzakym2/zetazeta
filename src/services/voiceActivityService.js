const User = require('../models/User');
const activityService = require('./activityService');

// Voice activity is tracked per server. One point = one full minute connected
// to a non-AFK voice channel. Sessions are kept in memory and flushed to MongoDB
// periodically so a user moving between channels does not create duplicate time.
const activeSessions = new Map();
const FLUSH_MS = 30_000;

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function isTrackableVoiceState(state) {
  if (!state?.guild || !state.channelId || state.member?.user?.bot) return false;
  const afkId = state.guild.afkChannelId;
  return !afkId || state.channelId !== afkId;
}

async function ensureUser(guildId, userId) {
  return User.findOneAndUpdate(
    { guildId, userId },
    {
      $setOnInsert: {
        guildId,
        userId,
        firstActiveAt: new Date(),
        lastActiveAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function flushSession(session, now = Date.now()) {
  if (!session) return;
  const elapsed = Math.max(0, now - session.startedAt);
  if (elapsed < 1000) return;

  // Keep the remainder in the session so we don't lose sub-minute time.
  const wholeSeconds = Math.floor(elapsed / 1000);
  session.startedAt += wholeSeconds * 1000;

  if (wholeSeconds <= 0) return;

  const guildId = session.guildId;
  const userId = session.userId;

  const totalSeconds = session.carriedSeconds + wholeSeconds;
  const wholeMinutes = Math.floor(totalSeconds / 60);

  await User.findOneAndUpdate(
    { guildId, userId },
    {
      $inc: {
        voiceSeconds: wholeSeconds,
        voicePoints: wholeMinutes
      },
      $set: { voiceLastActiveAt: new Date(now), lastActiveAt: new Date(now) },
      $setOnInsert: { guildId, userId, firstActiveAt: new Date(now) }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  if (wholeMinutes > 0) {
    await activityService.addVoiceXp(guildId, userId, wholeMinutes).catch(() => {});
  }

  // Carry only the seconds that did not make a full point.
  session.carriedSeconds = totalSeconds % 60;
}

async function startSession(state) {
  if (!isTrackableVoiceState(state)) return;
  const k = key(state.guild.id, state.id);
  const existing = activeSessions.get(k);
  if (existing) return;

  await ensureUser(state.guild.id, state.id).catch(() => {});
  activeSessions.set(k, {
    guildId: state.guild.id,
    userId: state.id,
    startedAt: Date.now(),
    carriedSeconds: 0
  });
}

async function endSession(guildId, userId) {
  const k = key(guildId, userId);
  const session = activeSessions.get(k);
  if (!session) return;

  await flushSession(session).catch((err) =>
    console.error('[voiceActivity] flush failed:', err.message)
  );
  activeSessions.delete(k);
}

async function handleVoiceStateUpdate(oldState, newState) {
  if (!oldState?.guild || !newState?.guild) return;
  if (newState.member?.user?.bot || oldState.member?.user?.bot) return;

  const guildId = newState.guild.id;
  const userId = newState.id;
  const oldTrackable = isTrackableVoiceState(oldState);
  const newTrackable = isTrackableVoiceState(newState);

  // Same trackable channel: no session change.
  if (oldTrackable && newTrackable && oldState.channelId === newState.channelId) return;

  if (oldTrackable) {
    await endSession(guildId, userId);
  }

  if (newTrackable) {
    await startSession(newState);
  }
}

async function flushAll() {
  const sessions = [...activeSessions.values()];
  for (const session of sessions) {
    await flushSession(session).catch((err) =>
      console.error('[voiceActivity] periodic flush failed:', err.message)
    );
  }
}

function startAutoFlush() {
  if (startAutoFlush.started) return;
  startAutoFlush.started = true;
  setInterval(() => {
    flushAll().catch((err) => console.error('[voiceActivity] flush loop failed:', err.message));
  }, FLUSH_MS);
}

function formatDuration(seconds = 0) {
  const totalMinutes = Math.floor(Number(seconds) / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}ي ${hours}س ${minutes}د`;
  if (hours) return `${hours}س ${minutes}د`;
  return `${minutes}د`;
}

async function getVoiceLeaderboard(guildId, limit = 10) {
  return User.find({ guildId, voiceSeconds: { $gt: 0 } })
    .sort({ voicePoints: -1, voiceSeconds: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  handleVoiceStateUpdate,
  startAutoFlush,
  flushAll,
  getVoiceLeaderboard,
  formatDuration
};
