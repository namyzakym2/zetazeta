const StaffRating = require('../models/StaffRating');

/**
 * يحفظ تقييم إداري لتذكرة معينة (مرة وحدة فقط لكل تذكرة).
 */
async function rate(guildId, staffId, raterId, ticketId, score, comment = '') {
  const clampedScore = Math.max(1, Math.min(5, Math.round(Number(score) || 0)));

  try {
    return await StaffRating.create({
      guildId,
      staffId,
      raterId,
      ticketId,
      score: clampedScore,
      comment: comment ? String(comment).slice(0, 500) : ''
    });
  } catch (err) {
    if (err.code === 11000) {
      // فهرس unique على ticketId — يعني تم تقييم هذه التذكرة من قبل بالفعل.
      const err2 = new Error('ALREADY_RATED');
      throw err2;
    }
    throw err;
  }
}

/**
 * متوسط تقييم إداري واحد + عدد التقييمات، ضمن سيرفر معين.
 */
async function getStaffAverage(guildId, staffId) {
  const ratings = await StaffRating.find({ guildId, staffId });
  if (!ratings.length) return { average: 0, count: 0 };

  const total = ratings.reduce((sum, r) => sum + r.score, 0);
  return { average: Math.round((total / ratings.length) * 10) / 10, count: ratings.length };
}

/**
 * ترتيب كل الإداريين في سيرفر معين حسب متوسط التقييم (تنازليًا)، يُستخدم في
 * لوحة "تقييم الإدارة" على الداشبورد وبأمر /staff-ratings.
 */
async function getLeaderboard(guildId, limit = 10) {
  const ratings = await StaffRating.find({ guildId });
  const byStaff = new Map();

  for (const r of ratings) {
    const entry = byStaff.get(r.staffId) || { staffId: r.staffId, total: 0, count: 0 };
    entry.total += r.score;
    entry.count += 1;
    byStaff.set(r.staffId, entry);
  }

  return [...byStaff.values()]
    .map((e) => ({ staffId: e.staffId, average: Math.round((e.total / e.count) * 10) / 10, count: e.count }))
    .sort((a, b) => b.average - a.average || b.count - a.count)
    .slice(0, limit);
}

module.exports = { rate, getStaffAverage, getLeaderboard };
