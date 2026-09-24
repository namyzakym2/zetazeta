const { Schema, model } = require('../db/mysqlCompat');

const TempBanSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, default: 'No reason provided' },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

module.exports = model('TempBan', TempBanSchema);
