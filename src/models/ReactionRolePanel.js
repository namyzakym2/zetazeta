const { Schema, model } = require('../db/mysqlCompat');
const ItemSchema = new Schema({ roleId: { type: String, required: true }, label: { type: String, required: true }, emoji: { type: String, default: '' }, style: { type: String, default: 'Primary' } }, { _id: false });
const ReactionRolePanelSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  messageId: { type: String, default: '' },
  title: { type: String, default: 'اختر رتبك' },
  description: { type: String, default: 'اضغط على الزر لإضافة/إزالة الرتبة.' },
  items: { type: [ItemSchema], default: [] },
  enabled: { type: Boolean, default: true }
}, { timestamps: true });
module.exports = model('ReactionRolePanel', ReactionRolePanelSchema);
