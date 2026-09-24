const { AuditLogEvent } = require('discord.js');
const logService = require('../services/logService');
const recentBotActions = require('../utils/recentBotActions');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban) {
    const guildId = ban.guild.id;
    if (recentBotActions.consume(guildId, ban.user.id, 'unban')) return;

    let moderator = null;
    try {
      if (ban.guild.members?.me?.permissions.has('ViewAuditLog')) {
        const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 5 });
        const entry = logs.entries.find((e) => e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 10000);
        if (entry?.executor) moderator = `<@${entry.executor.id}>`;
      }
    } catch { /* no perms / rate limited */ }

    await logService.log(ban.client, guildId, 'unban', {
      User: `${ban.user.tag} (${ban.user.id})`,
      Moderator: moderator
    });
  }
};
