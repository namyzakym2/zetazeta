const TempBan = require('../models/TempBan');
const logService = require('../services/logService');

/**
 * tempBanSystem — polls for expired temp bans and auto-unbans, same
 * interval-driven pattern as giveaways.js / voteReminder.js. Called on
 * an interval from src/events/ready.js.
 */
async function checkExpired(client) {
  const due = await TempBan.find({ expiresAt: { $lte: new Date() } }).lean();
  if (!due.length) return;

  for (const entry of due) {
    try {
      const guild = client.guilds.cache.get(entry.guildId);
      if (guild) {
        await guild.members.unban(entry.userId, 'Temp ban expired').catch(() => {});
        await logService.log(client, entry.guildId, 'unban', {
          User: `<@${entry.userId}>`,
          Moderator: 'ZETA (auto)',
          Reason: 'انتهت مدة الحظر المؤقت'
        }).catch(() => {});
      }
    } finally {
      await TempBan.deleteOne({ _id: entry._id }).catch(() => {});
    }
  }
}

module.exports = { checkExpired };
