const { AuditLogEvent } = require('discord.js');
const logService = require('../services/logService');
const recentBotActions = require('../utils/recentBotActions');

/** Best-effort: who did this? Falls back silently — missing View Audit Log perms, rate limits, etc. */
async function findModerator(guild, targetId, auditType) {
  try {
    if (!guild.members?.me?.permissions.has('ViewAuditLog')) return null;
    const logs = await guild.fetchAuditLogs({ type: auditType, limit: 5 });
    const entry = logs.entries.find((e) => e.target?.id === targetId && Date.now() - e.createdTimestamp < 10000);
    return entry?.executor ? `<@${entry.executor.id}>` : null;
  } catch {
    return null;
  }
}

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const client = newMember.client;
    const guildId = newMember.guild.id;

    // Nickname
    if (oldMember.nickname !== newMember.nickname && !recentBotActions.consume(guildId, newMember.id, 'nickChange')) {
      const moderator = await findModerator(newMember.guild, newMember.id, AuditLogEvent.MemberUpdate);
      await logService.log(client, guildId, 'nickChange', {
        User: `<@${newMember.id}>`,
        Before: oldMember.nickname || oldMember.user.username,
        After: newMember.nickname || newMember.user.username,
        Moderator: moderator
      });
    }

    // Timeout applied / lifted (communicationDisabledUntil)
    const oldUntil = oldMember.communicationDisabledUntilTimestamp;
    const newUntil = newMember.communicationDisabledUntilTimestamp;
    const isActive = (ts) => ts && ts > Date.now();
    if (isActive(newUntil) && !isActive(oldUntil) && !recentBotActions.consume(guildId, newMember.id, 'timeout')) {
      const moderator = await findModerator(newMember.guild, newMember.id, AuditLogEvent.MemberUpdate);
      await logService.log(client, guildId, 'timeout', {
        User: `<@${newMember.id}>`,
        Until: `<t:${Math.floor(newUntil / 1000)}:F>`,
        Moderator: moderator
      });
    } else if (isActive(oldUntil) && !isActive(newUntil) && !recentBotActions.consume(guildId, newMember.id, 'untimeout')) {
      const moderator = await findModerator(newMember.guild, newMember.id, AuditLogEvent.MemberUpdate);
      await logService.log(client, guildId, 'untimeout', {
        User: `<@${newMember.id}>`,
        Moderator: moderator
      });
    }

    // Role add/remove — single source of truth for this log type; bot commands
    // (role.js, prefixHandler) no longer log it themselves to avoid duplicates.
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const added = newRoles.filter((r) => !oldRoles.has(r.id));
    const removed = oldRoles.filter((r) => !newRoles.has(r.id));

    if (added.size && !recentBotActions.consume(guildId, newMember.id, 'roleAdd')) {
      const moderator = await findModerator(newMember.guild, newMember.id, AuditLogEvent.MemberRoleUpdate);
      await logService.log(client, guildId, 'roleAdd', {
        User: `<@${newMember.id}>`,
        Roles: added.map((r) => `<@&${r.id}>`).join(', '),
        Moderator: moderator
      });
    }
    if (removed.size && !recentBotActions.consume(guildId, newMember.id, 'roleRemove')) {
      const moderator = await findModerator(newMember.guild, newMember.id, AuditLogEvent.MemberRoleUpdate);
      await logService.log(client, guildId, 'roleRemove', {
        User: `<@${newMember.id}>`,
        Roles: removed.map((r) => `<@&${r.id}>`).join(', '),
        Moderator: moderator
      });
    }
  }
};
