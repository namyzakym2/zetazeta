const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function msUntil(target) {
  return Math.max(0, target - Date.now());
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function daysBetween(a, b) {
  return Math.floor(Math.abs(b - a) / DAY);
}

module.exports = { HOUR, DAY, msUntil, formatDuration, daysBetween };
