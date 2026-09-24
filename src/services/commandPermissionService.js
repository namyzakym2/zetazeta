const { PermissionFlagsBits } = require('discord.js');
const GuildModel = require('../models/Guild');

/**
 * commandPermissionService — lets server admins grant or block specific ROLES from
 * using specific slash commands, on top of Discord's own permission system. Managed
 * via /command-permission (allow / deny / reset / list).
 *
 * Rules, per (command, role):
 *   1. Guild owner and members with Administrator always pass — this system can never
 *      lock the owner/admins out of their own server.
 *   2. If no rule exists for the command at all → unrestricted, falls through to the
 *      command's own normal permission checks (unchanged behaviour).
 *   3. An explicit "deny" rule matching one of the member's roles always wins.
 *   4. If any "allow" rules exist for the command (whitelist mode), the member needs
 *      at least one role on that whitelist — everyone else is blocked.
 *   5. Otherwise (only "deny" rules exist for the command, none matching this member)
 *      → allowed.
 */

async function isCommandAllowed(guildId, commandName, member) {
  if (!member) return true;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.guild?.ownerId === member.id) return true;

  const guildDoc = await GuildModel.findOne({ guildId }, { commandPermissions: 1 });
  const rules = guildDoc?.commandPermissions?.filter((r) => r.command === commandName) || [];
  if (!rules.length) return true;

  const memberRoleIds = new Set(member.roles?.cache ? [...member.roles.cache.keys()] : []);

  const isDenied = rules.some((r) => r.allowed === false && memberRoleIds.has(r.roleId));
  if (isDenied) return false;

  const allowRules = rules.filter((r) => r.allowed !== false);
  if (!allowRules.length) return true;

  return allowRules.some((r) => memberRoleIds.has(r.roleId));
}

async function setPermission(guildId, command, roleId, allowed) {
  const guildDoc = await GuildModel.findOne({ guildId }) || await GuildModel.create({ guildId });
  const existing = guildDoc.commandPermissions.find((r) => r.command === command && r.roleId === roleId);
  if (existing) {
    existing.allowed = allowed;
  } else {
    guildDoc.commandPermissions.push({ command, roleId, allowed });
  }
  await guildDoc.save();
  return guildDoc.commandPermissions;
}

async function resetPermission(guildId, command, roleId) {
  const guildDoc = await GuildModel.findOne({ guildId });
  if (!guildDoc) return;
  guildDoc.commandPermissions = guildDoc.commandPermissions.filter(
    (r) => !(r.command === command && r.roleId === roleId)
  );
  await guildDoc.save();
}

async function listPermissions(guildId, command) {
  const guildDoc = await GuildModel.findOne({ guildId }, { commandPermissions: 1 });
  const rules = guildDoc?.commandPermissions || [];
  return command ? rules.filter((r) => r.command === command) : rules;
}

module.exports = { isCommandAllowed, setPermission, resetPermission, listPermissions };
