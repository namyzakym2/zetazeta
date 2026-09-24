const { Schema, model } = require('../db/mysqlCompat');

const WarningSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, default: 'No reason provided' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = model('Warning', WarningSchema);
