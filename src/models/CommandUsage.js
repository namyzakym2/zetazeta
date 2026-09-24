const { Schema, model } = require('../db/mysqlCompat');

/**
 * CommandUsage — per guild / per day / per command counter. Powers the dashboard's
 * "commands executed" number, the usage chart and the "most used commands" list.
 */
const CommandUsageSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    day: { type: String, required: true },      // YYYY-MM-DD (UTC)
    command: { type: String, required: true },
    count: { type: Number, default: 0 }
  },
  { timestamps: true }
);

CommandUsageSchema.statics = {};
const Model = model('CommandUsage', CommandUsageSchema);

// Fire-and-forget: a failed counter must never break a command.
Model.record = (guildId, command) => {
  if (!guildId || !command) return Promise.resolve();
  const day = new Date().toISOString().slice(0, 10);
  return Model.updateOne(
    { guildId, day, command },
    { $inc: { count: 1 }, $setOnInsert: { guildId, day, command } },
    { upsert: true }
  ).catch(() => {});
};

module.exports = Model;
