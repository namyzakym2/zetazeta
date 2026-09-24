const GuildModel = require('../models/Guild');
const InteractionScore = require('../models/InteractionScore');

/**
 * interactionPointsService — "نقاط التفاعل" (Interaction Points).
 * Awards points to regular members for being active (currently: qualifying
 * messages) and grants ROLE rewards ("ترقيات") once a member crosses a configured
 * point threshold. This system never touches VC/economy — it's purely a role
 * promotion ladder. Running totals live in their own collection
 * (src/models/InteractionScore.js); Guild.interactionPoints is config only.
 */

const lastGain = new Map(); // key: guildId:userId -> timestamp (in-memory cooldown)

async function getConfig(guildId) {
  const guildDoc = await GuildModel.findOne({ guildId });
  return guildDoc?.interactionPoints || null;
}

async function getScore(guildId, userId) {
  return (
    (await InteractionScore.findOne({ guildId, userId })) ||
    (await InteractionScore.create({ guildId, userId }))
  );
}

async function getLeaderboard(guildId, limit = 25) {
  return InteractionScore.find({ guildId }).sort({ points: -1 }).limit(limit);
}

async function registerMessage(message) {
  const guildId = message.guild.id;
  const userId = message.author.id;

  const cfg = await getConfig(guildId);
  if (!cfg?.enabled || !cfg.pointsPerMessage || cfg.pointsPerMessage <= 0) return null;

  if ((cfg.excludedChannelIds || []).includes(message.channel.id)) return null;

  const content = (message.content || '').trim();
  if (content.length < (cfg.minMessageLength || 1)) return null;

  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const cooldownMs = Math.max(0, (cfg.cooldownSeconds ?? 60) * 1000);
  const last = lastGain.get(key) || 0;
  if (now - last < cooldownMs) return null;
  lastGain.set(key, now);

  const score = await getScore(guildId, userId);
  score.points = (score.points || 0) + cfg.pointsPerMessage;
  await score.save();

  if (cfg.rewards?.length) {
    await _checkRewards(message, score.points, cfg).catch(() => {});
  }

  return score.points;
}

async function _checkRewards(message, totalPoints, cfg) {
  const member = message.member;
  if (!member) return;

  for (const reward of cfg.rewards || []) {
    if (!reward.points || totalPoints < reward.points || !reward.roleId) continue;
    if (member.roles.cache.has(reward.roleId)) continue;

    const role = message.guild.roles.cache.get(reward.roleId);
    if (!role) continue;

    await member.roles.add(role).catch(() => {});
    await _sendLog(message, member, role, totalPoints, cfg).catch(() => {});
  }
}

async function _sendLog(message, member, role, totalPoints, cfg) {
  if (!cfg.logsChannelId) return;
  const channel = message.guild.channels.cache.get(cfg.logsChannelId);
  if (!channel?.isTextBased()) return;

  await channel
    .send({ content: `🎖️ <@${member.id}> ترقّى لرتبة <@&${role.id}> بعد ما وصل لـ **${totalPoints}** نقطة تفاعل!` })
    .catch(() => {});
}

module.exports = { getConfig, getScore, getLeaderboard, registerMessage };
