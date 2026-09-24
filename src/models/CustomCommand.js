const { Schema, model } = require('../db/mysqlCompat');
const CustomCommandSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  response: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  createdBy: { type: String, default: '' }
}, { timestamps: true });
CustomCommandSchema.index({ guildId: 1, name: 1 }, { unique: true });
module.exports = model('CustomCommand', CustomCommandSchema);
