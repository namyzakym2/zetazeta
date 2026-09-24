// Command handlers call mark() right before performing a member action they'll
// log themselves (nickname/timeout/mute/unmute/role add-remove). The global
// guildMemberUpdate listener calls consume() and skips its own log if a
// matching mark was made in the last few seconds — this lets the command's
// log entry (which has accurate Moderator/Reason context) win, while manual
// changes made straight from the Discord UI still get logged by the listener.

const TTL_MS = 5000;
const marks = new Map(); // key -> expiresAt

function key(guildId, userId, type) {
  return `${guildId}:${userId}:${type}`;
}

function mark(guildId, userId, type) {
  marks.set(key(guildId, userId, type), Date.now() + TTL_MS);
}

function consume(guildId, userId, type) {
  const k = key(guildId, userId, type);
  const expires = marks.get(k);
  if (!expires) return false;
  marks.delete(k);
  return expires > Date.now();
}

module.exports = { mark, consume };
