const { Schema, model } = require('../db/mysqlCompat');

/**
 * User — per-SERVER data only: activity (XP/level/messages) and warning count.
 * VC economy data (balance, streak, lastDaily, lastVote) lives in the global Wallet
 * model instead (src/models/Wallet.js) — one balance per person, shared across every
 * server, which is what keeps this collection scoped strictly to per-guild activity.
 */
const UserSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },

    // Activity (fully separate from economy — always has been, and now literally
    // lives in a different collection than the economy data too)
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
    // Voice activity — total time/points spent in voice channels per server.
    voiceSeconds: { type: Number, default: 0 },
    voicePoints: { type: Number, default: 0 },
    voiceLastActiveAt: { type: Date, default: null },
    firstActiveAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },

    // Moderation (per-server, correctly — a warning in one server shouldn't follow
    // you to another)
    warnings: { type: Number, default: 0 }
  },
  { timestamps: true }
);

UserSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('User', UserSchema);
