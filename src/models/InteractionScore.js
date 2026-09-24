const { Schema, model } = require('../db/mysqlCompat');

// One document per (guildId, userId) — a member's running "نقاط التفاعل" total,
// used to power the interaction-points leaderboard and role rewards (ترقيات).
// Separate from StaffScore (which is for staff/تذاكر points) and never touches VC.
const InteractionScoreSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    points: { type: Number, default: 0 }
  },
  { timestamps: true }
);

InteractionScoreSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('InteractionScore', InteractionScoreSchema);
