const { Schema, model } = require('../db/mysqlCompat');

// One document per rank-purchase attempt. Created when a member opens a purchase
// room (src/services/rankShopService.js#createOrderRoom), and updated as the buyer
// marks the transfer done / staff confirms or cancels. See src/systems/rankShop.js
// for the button handlers and src/commands/system/rank-shop.js for the admin
// commands (including the manual /rank-shop confirm path that doesn't need a room).
const RankOrderSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    buyerId: { type: String, required: true, index: true },
    // Snapshot of the rank at purchase time — kept even if the admin later edits/
    // removes the shop entry, so old rooms/logs still make sense.
    rankId: { type: String, default: '' },
    roleId: { type: String, required: true },
    rankName: { type: String, required: true },
    price: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending', index: true },
    markedPaidAt: { type: Date, default: null },
    confirmedBy: { type: String, default: '' },
    confirmedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = model('RankOrder', RankOrderSchema);
