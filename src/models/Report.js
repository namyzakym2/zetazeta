const { Schema, model } = require('../db/mysqlCompat');

const ReportSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    reporterId: { type: String, required: true },
    targetId: { type: String, required: true },
    reason: { type: String, required: true },
    messageId: { type: String, default: '' },
    channelId: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' },
    reviewedBy: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = model('Report', ReportSchema);
