const { Schema, model } = require('../db/mysqlCompat');

/**
 * BotGuild — a lightweight record of every server ZETA is currently a member of.
 * The dashboard runs as a separate process from the bot and has no live access to
 * client.guilds.cache, so the bot keeps this collection in sync (on ready + guildCreate
 * + guildDelete) and the dashboard reads from it to know which of the logged-in user's
 * Discord servers actually have the bot installed — this is what powers the server
 * picker / "no servers show up" fix.
 */
const BotGuildSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    icon: { type: String, default: '' },
    memberCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = model('BotGuild', BotGuildSchema);
