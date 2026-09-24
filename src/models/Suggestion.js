const { Schema, model } = require('../db/mysqlCompat');

const SuggestionSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    messageId: { type: String, required: true },
    content: { type: String, required: true },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'closed'], default: 'pending' }
  },
  { timestamps: true }
);

module.exports = model('Suggestion', SuggestionSchema);
