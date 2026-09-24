const { AuditLogEvent } = require('discord.js');
const logService = require('../services/logService');
const recentBotActions = require('../utils/recentBotActions');
const antiNuke = require('../systems/antiNuke');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    antiNuke.onBan(ban).catch(() => {});
    const guildId = ban.guild.id;
    if (recentBotActions.consume(guildId, ban.user.id, 'ban')) return;

    let moderator = null;
    let reason = ban.reason || null;
    try {
      if (ban.guild.members?.me?.permissions.has('ViewAuditLog')) {
        const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 });
        const entry = logs.entries.find((e) => e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 10000);
        if (entry?.executor) moderator = `<@${entry.executor.id}>`;
        if (entry?.reason) reason = entry.reason;
      }
    } catch { /* no perms / rate limited — log without moderator context */ }

    await logService.log(ban.client, guildId, 'ban', {
      User: `${ban.user.tag} (${ban.user.id})`,
      Moderator: moderator,
      Reason: reason
    });
  }
};
