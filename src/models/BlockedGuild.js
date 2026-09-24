const { Schema, model } = require('../db/mysqlCompat');

/**
 * BlockedGuild — servers ZETA is not allowed to be a member of. Checked in
 * src/events/guildCreate.js on every join; if a joined guild's ID is in here, the bot
 * immediately leaves again. Managed exclusively from the ZetaBot Panel
 * (dashboard/routes/devilPanel.js), which is gated on ensureDevilRole.
 */
const BlockedGuildSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    reason: { type: String, default: '' },
    blockedBy: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = model('BlockedGuild', BlockedGuildSchema);
