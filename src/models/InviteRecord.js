const { Schema, model } = require('../db/mysqlCompat');

/**
 * InviteRecord — one row per member join, used to attribute joins to the
 * invite/inviter that brought them in and to decide whether that join
 * counts as a "real" invite:
 *
 *   - fake:  the joining account was created less than MIN_ACCOUNT_AGE_MS
 *            before joining (throwaway/alt accounts farming invite rewards)
 *   - left:  the member later left the server — a join that leaves again
 *            no longer counts towards the inviter's total either
 *
 * A member can only have one *active* (non-left) record per guild — if they
 * rejoin, a fresh record is created and counted again from scratch.
 */
const InviteRecordSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true }, // the member who joined
    inviterId: { type: String, default: '' }, // '' when unknown (vanity URL, oauth, unresolved)
    code: { type: String, default: '' },

    fake: { type: Boolean, default: false },
    left: { type: Boolean, default: false },

    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null }
  },
  { timestamps: true }
);

InviteRecordSchema.index({ guildId: 1, inviterId: 1 });
InviteRecordSchema.index({ guildId: 1, userId: 1, left: 1 });

module.exports = model('InviteRecord', InviteRecordSchema);
