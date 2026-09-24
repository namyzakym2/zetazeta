const { Schema, model } = require('../db/mysqlCompat');

const VoteSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    voteId: { type: String, required: true, unique: true },
    provider: { type: String, default: 'voite.gg' },
    rewarded: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = model('Vote', VoteSchema);
