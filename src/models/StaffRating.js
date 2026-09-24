const { Schema, model } = require('../db/mysqlCompat');

// تقييم الإدارة: يرسله صاحب التذكرة (1-5 نجوم) بعد إغلاق تذكرته للإداري
// اللي تولى أمرها، تُستخدم لحساب متوسط تقييم كل إداري.
const StaffRatingSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    staffId: { type: String, required: true, index: true },
    raterId: { type: String, required: true },
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' }
  },
  { timestamps: true }
);

// تقييم واحد فقط لكل تذكرة (يمنع تكرار الضغط على نفس رسالة التقييم).
StaffRatingSchema.index({ ticketId: 1 }, { unique: true });

module.exports = model('StaffRating', StaffRatingSchema);
