const { Schema, model } = require('../db/mysqlCompat');

/** ServerBackup — snapshot of a server's roles + channels (structure only, no messages). */
const ServerBackupSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, default: 'backup' },
    createdBy: { type: String, default: '' },
    roles: { type: Array, default: () => [] },
    channels: { type: Array, default: () => [] }
  },
  { timestamps: true }
);

module.exports = model('ServerBackup', ServerBackupSchema);
