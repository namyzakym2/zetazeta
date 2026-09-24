const { Schema, model } = require('../db/mysqlCompat');

const TicketSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    ownerId: { type: String, required: true, index: true },
    buttonId: { type: String, default: '' },
    // أي بانل تذاكر أنشأ هذه التذكرة: 'main' يعني Guild.ticketSettings، وأي قيمة
    // ثانية هي _id لعنصر داخل Guild.ticketPanels — يُستخدم عند الإغلاق لمعرفة
    // إعدادات هذا البانل بالذات (روم النسخة/التقييم...) بدل الإعدادات الرئيسية دايمًا.
    panelId: { type: String, default: 'main' },
    claimedBy: { type: String, default: '' },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    transcriptUrl: { type: String, default: '' },

    // Extra buttons added INSIDE an already-open ticket via /ticket-button-add (e.g.
    // "Escalate", "Send Payment Info") — separate from the panel-level buttons in
    // Guild.ticketSettings.buttons, which only control opening NEW tickets.
    customButtons: {
      type: [
        new Schema(
          {
            label: { type: String, required: true },
            style: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Secondary' },
            emoji: { type: String, default: '' },
            response: { type: String, required: true },
            addedBy: { type: String, required: true }
          },
          { _id: true, timestamps: true }
        )
      ],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = model('Ticket', TicketSchema);
