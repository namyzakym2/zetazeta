const GuildModel = require('../models/Guild');

async function getStates(guildId) {
  const guild = await GuildModel.findOne({ guildId }).lean();
  return guild?.commandStates || [];
}

async function isEnabled(guildId, command) {
  const guild = await GuildModel.findOne({ guildId }).lean();
  const state = (guild?.commandStates || []).find((s) => s.command === command);
  return state ? state.enabled !== false : true;
}

async function setEnabled(guildId, command, enabled) {
  const guild = await GuildModel.findOne({ guildId });
  if (!guild) throw new Error('GUILD_NOT_FOUND');
  const name = String(command).trim().toLowerCase();
  const existing = guild.commandStates.find((s) => s.command === name);
  if (existing) existing.enabled = Boolean(enabled);
  else guild.commandStates.push({ command: name, enabled: Boolean(enabled) });
  await guild.save();
  return guild.commandStates;
}

module.exports = { getStates, isEnabled, setEnabled };
