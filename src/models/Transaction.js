const { Schema, model } = require('../db/mysqlCompat');

const TransactionSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    fromUserId: { type: String, default: null },
    toUserId: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['daily', 'vote', 'transfer', 'admin', 'salary'], required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = model('Transaction', TransactionSchema);
