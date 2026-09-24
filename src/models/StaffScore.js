const { Schema, model } = require('../db/mysqlCompat');

// One document per (guildId, userId) — a staff member's running point total plus a
// short history log, used to power the "نقاط التذاكر" leaderboard and role rewards.
const StaffScoreHistorySchema = new Schema(
  {
    delta: { type: Number, required: true },
    reason: { type: String, default: '' },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const StaffScoreSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    points: { type: Number, default: 0 },
    history: { type: [StaffScoreHistorySchema], default: [] },
    // Anti-abuse dedupe map: key -> ISO date string of when it last fired,
    // e.g. "claim_<ticketId>" so the same ticket can't be claimed for points twice.
    lastActions: { type: Map, of: String, default: () => new Map() }
  },
  { timestamps: true }
);

StaffScoreSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('StaffScore', StaffScoreSchema);
