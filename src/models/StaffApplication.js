const { Schema, model } = require('../db/mysqlCompat');

// تقديم إداري: يرسله عضو عبر مودال (أسئلة محددة من الإعدادات)، يوصل لروم
// المراجعة المحدد بأزرار قبول/رفض، والنتيجة توصل للمتقدم بالخاص (DM).
const AnswerSchema = new Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, default: '' }
  },
  { _id: false }
);

const StaffApplicationSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    // _id لعنصر guildDoc.applicationPanels اللي جاء منه هذا التقديم.
    panelId: { type: String, required: true, index: true },
    applicantId: { type: String, required: true, index: true },
    answers: { type: [AnswerSchema], default: [] },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    reviewedBy: { type: String, default: '' },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    // رسالة المراجعة داخل روم المراجعة (عشان نقدر نعدلها بعد القرار).
    reviewChannelId: { type: String, default: '' },
    reviewMessageId: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = model('StaffApplication', StaffApplicationSchema);
