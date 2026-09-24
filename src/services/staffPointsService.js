const GuildModel = require('../models/Guild');
const StaffScore = require('../models/StaffScore');
const { buildV2Panel } = require('../utils/componentsV2');

/**
 * staffPointsService — "نقاط التذاكر" (Staff Points).
 * Awards points to staff for claiming/closing tickets and (optionally) for running
 * specific moderation commands, with anti-abuse guards and role rewards at
 * point thresholds. Ported from next-generation's systems/points_tickets.js and
 * adapted to ZETA's Mongoose models (Guild.staffPoints for config, a dedicated
 * StaffScore collection for the actual running totals/history).
 */

async function getConfig(guildId) {
  const guildDoc = await GuildModel.findOne({ guildId });
  return guildDoc?.staffPoints || null;
}

async function getScore(guildId, userId) {
  return (
    (await StaffScore.findOne({ guildId, userId })) ||
    (await StaffScore.create({ guildId, userId }))
  );
}

async function getLeaderboard(guildId, limit = 25) {
  return StaffScore.find({ guildId }).sort({ points: -1 }).limit(limit);
}

/**
 * Award (or deduct, if delta < 0) points to a staff member. Handles the log
 * channel post and role-reward threshold checks.
 */
async function awardPoints(client, guildId, staffId, delta, reason) {
  const config = await getConfig(guildId);
  if (!config || !config.enabled) return null;

  const score = await getScore(guildId, staffId);
  score.points = (score.points || 0) + delta;
  score.history.push({ delta, reason, at: new Date() });
  if (score.history.length > 100) score.history = score.history.slice(-100);
  await score.save();

  if (client) {
    await _sendLog(client, guildId, staffId, delta, reason, score.points, config).catch(() => {});
    if (config.rewards?.enabled && (config.rewards.list || []).length) {
      await _checkRewards(client, guildId, staffId, score.points, config).catch(() => {});
    }
  }

  return score;
}

/**
 * Ticket claim/close hook — called from src/services/ticketService.js.
 * @param {'claim'|'close'} action
 */
async function awardTicketPoints(client, guildId, staffId, action, ticketId, openerId = null) {
  const config = await getConfig(guildId);
  if (!config?.enabled || !config.ticketPoints?.enabled) return;

  const actionCfg = config.ticketPoints[action];
  if (!actionCfg?.enabled) return;

  if (action === 'claim' && config.antiAbuse?.enabled && config.antiAbuse?.noSelfClaim && openerId && openerId === staffId) {
    return; // no farming points by claiming your own ticket
  }

  const dedupeKey = `${action}_${ticketId}`;
  if (config.antiAbuse?.enabled && config.antiAbuse?.noDuplicatePoints) {
    const score = await getScore(guildId, staffId);
    if (score.lastActions?.get(dedupeKey)) return;
    score.lastActions.set(dedupeKey, new Date().toISOString());
    await score.save();
  }

  const delta = Number(actionCfg.points) || (action === 'claim' ? 5 : 3);
  const reason = action === 'claim' ? 'استلام تذكرة' : 'إغلاق تذكرة';
  await awardPoints(client, guildId, staffId, delta, reason);
}

/**
 * Moderation-command hook — call from any slash command whose invoker should earn
 * points when it runs (e.g. ban/kick/mute/warn). Silently no-ops unless the admin
 * has actually listed that command name under "نقاط الأوامر" in the dashboard.
 */
async function awardCommandPoints(client, guildId, staffId, commandName) {
  const config = await getConfig(guildId);
  if (!config?.enabled || !config.commandPoints?.enabled) return;

  const cmd = (config.commandPoints.commands || []).find((c) => c.name === commandName);
  if (!cmd) return;

  // Commands aren't deduped per-target — only rate-limited via the cooldown below.
  if (config.antiAbuse?.enabled && config.antiAbuse?.cooldownMinutes > 0) {
    const score = await getScore(guildId, staffId);
    const lastKey = `cmd_${commandName}_last`;
    const last = score.lastActions?.get(lastKey);
    if (last) {
      const elapsedMin = (Date.now() - new Date(last).getTime()) / 60000;
      if (elapsedMin < config.antiAbuse.cooldownMinutes) return;
    }
    score.lastActions.set(lastKey, new Date().toISOString());
    await score.save();
  }

  const delta = Number(cmd.points) || 1;
  await awardPoints(client, guildId, staffId, delta, `أمر إداري: /${commandName}`);
}

async function _sendLog(client, guildId, staffId, delta, reason, totalPoints, config) {
  if (!config.logsChannelId) return;
  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(config.logsChannelId);
  if (!channel || !channel.isTextBased()) return;

  const isPos = delta >= 0;
  const panel = buildV2Panel({
    title: isPos ? '📈 تحديث نقاط الإدارة' : '📉 تحديث نقاط الإدارة',
    color: isPos ? 0x57f287 : 0xed4245,
    description: `<@${staffId}> — **${isPos ? '+' : ''}${delta} نقطة**\n${reason} • الرصيد الكلي: **${totalPoints} نقطة**`,
    timestamp: true
  });

  await channel.send(panel).catch(() => {});
}

async function _checkRewards(client, guildId, staffId, totalPoints, config) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const member = await guild.members.fetch(staffId).catch(() => null);
  if (!member) return;

  for (const reward of config.rewards.list || []) {
    if (!reward.points || totalPoints < reward.points) continue;
    if (reward.roleId) {
      const role = guild.roles.cache.get(reward.roleId);
      if (role && !member.roles.cache.has(reward.roleId)) {
        await member.roles.add(role).catch(() => {});
      }
    }
  }
}

module.exports = {
  getConfig,
  getScore,
  getLeaderboard,
  awardPoints,
  awardTicketPoints,
  awardCommandPoints
};
