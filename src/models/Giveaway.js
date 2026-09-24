const { Schema, model } = require('../db/mysqlCompat');

const GiveawaySchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, index: true },
    hostId: { type: String, required: true },
    prize: { type: String, required: true },
    winnersCount: { type: Number, required: true, min: 1, default: 1 },
    endsAt: { type: Date, required: true, index: true },
    ended: { type: Boolean, default: false },
    reaction: { type: String, default: 'party' },
    roleId: { type: String, default: null },
    participants: { type: [String], default: [] },
    winners: { type: [String], default: [] }
  },
  { timestamps: true }
);

module.exports = model('Giveaway', GiveawaySchema);
