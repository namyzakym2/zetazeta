const InviteRecord = require('../models/InviteRecord');
const logService = require('./logService');

// An invited account younger than this at the moment it joins doesn't count
// towards the inviter's total (alt/throwaway accounts farming invite rewards).
const MIN_ACCOUNT_AGE_MS = 60 * 24 * 60 * 60 * 1000; // ~2 months

/** Real (non-fake, still-in-server) invite count for a member. */
async function getInviteCount(guildId, userId) {
  return InviteRecord.countDocuments({ guildId, inviterId: userId, fake: false, left: false });
}

async function getInviteStats(guildId, userId) {
  const [real, fake, left] = await Promise.all([
    InviteRecord.countDocuments({ guildId, inviterId: userId, fake: false, left: false }),
    InviteRecord.countDocuments({ guildId, inviterId: userId, fake: true }),
    InviteRecord.countDocuments({ guildId, inviterId: userId, left: true, fake: false })
  ]);
  return { real, fake, left, total: real + fake + left };
}

/**
 * Called once per join from events/guildMemberAdd.js with the invite already
 * resolved (see autoRoleRules.resolveUsedInvite — never diff the invite
 * cache twice for the same join).
 */
async function recordJoin(member, usedInvite) {
  const guildId = member.guild.id;
  const userId = member.id;
  const inviterId = usedInvite?.inviterId || '';
  const code = usedInvite?.code || '';

  const accountAge = Date.now() - member.user.createdTimestamp;
  const fake = accountAge < MIN_ACCOUNT_AGE_MS;

  await InviteRecord.create({ guildId, userId, inviterId, code, fake });

  if (!inviterId) return; // vanity URL / oauth join / unresolved — nothing to attribute or log

  const stats = inviterId ? await getInviteCount(guildId, inviterId) : 0;

  await logService.log(member.client, guildId, fake ? 'inviteFake' : 'inviteJoin', {
    User: `<@${userId}>`,
    'Invited By': `<@${inviterId}>`,
    Code: code || '—',
    'Account Age': `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
    'Inviter Total': fake ? undefined : String(stats)
  });
}

/** Called from events/guildMemberRemove.js — marks the active record left, if any. */
async function recordLeave(member) {
  const guildId = member.guild.id;
  const userId = member.id;

  const record = await InviteRecord.findOneAndUpdate(
    { guildId, userId, left: false },
    { left: true, leftAt: new Date() }
  );
  if (!record || !record.inviterId) return;

  await logService.log(member.client, guildId, 'inviteLeave', {
    User: `${member.user.tag} (${userId})`,
    'Was Invited By': `<@${record.inviterId}>`,
    'Time In Server': `<t:${Math.floor(record.joinedAt.getTime() / 1000)}:R>`
  });
}

module.exports = { getInviteCount, getInviteStats, recordJoin, recordLeave, MIN_ACCOUNT_AGE_MS };
