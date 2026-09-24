const { Schema, model } = require('../db/mysqlCompat');

/** ShieldCase — an audit trail of everything the Shield did (shown on the dashboard). */
const ShieldCaseSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    kind: { type: String, default: 'nuke' },      // nuke | raid | spam | quarantine | panic | gate | revert
    userId: { type: String, default: '' },        // who triggered it
    action: { type: String, default: '' },        // what ZETA did about it
    reason: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = model('ShieldCase', ShieldCaseSchema);
