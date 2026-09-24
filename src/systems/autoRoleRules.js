const GuildModel = require('../models/Guild');
const logService = require('../services/logService');

/**
 * Auto Rules — richer auto-role engine ported from Next Generation's
 * systems/auto_role.js and adapted to ZETA's architecture (Mongoose
 * instead of per-guild JSON files, event-dispatch instead of ad-hoc
 * client.on registration).
 *
 * This runs ADDITIVELY alongside the legacy single `guildDoc.autoRoleId`
 * already handled in src/systems/welcome.js — nothing here removes or
 * replaces that behavior, it only adds:
 *   - multiple member roles
 *   - a separate role set for bots
 *   - invite-code -> role mapping (which invite a member used decides an
 *     extra role they get, e.g. a "partner" server's invite)
 *
 * Wiring:
 *   - handleMemberAdd(member)   called from src/events/guildMemberAdd.js
 *   - cacheGuildInvites(guild)  called from src/events/ready.js (every guild
 *                               on boot) and src/events/guildCreate.js
 *   - trackInviteCreate/Delete  called from src/events/inviteCreate.js and
 *                               src/events/inviteDelete.js
 *
 * Requires the GuildInvites intent (added in src/bot.js) and the
 * "Manage Server" permission on the bot to read invite use-counts — if
 * either is missing, invite-based rules are silently skipped (member/bot
 * role rules still work fine without it).
 */

// guildId -> Map(inviteCode -> { uses, inviterId })
const invitesCache = new Map();

async function cacheGuildInvites(guild) {
  try {
    if (!guild || !guild.members?.me) return;
    if (!guild.members.me.permissions.has('ManageGuild')) return;

    const invites = await guild.invites.fetch();
    const map = new Map();
    invites.forEach((inv) => map.set(inv.code, { uses: inv.uses || 0, inviterId: inv.inviter?.id || '' }));
    invitesCache.set(guild.id, map);
  } catch {
    // No permission, API hiccup, etc. — invite-based rules just won't fire.
  }
}

function trackInviteCreate(invite) {
  const guildId = invite.guild?.id;
  if (!guildId || !invite.code) return;
  const cached = invitesCache.get(guildId) || new Map();
  cached.set(invite.code, { uses: invite.uses || 0, inviterId: invite.inviter?.id || '' });
  invitesCache.set(guildId, cached);
}

function trackInviteDelete(invite) {
  const guildId = invite.guild?.id;
  if (!guildId || !invite.code) return;
  const cached = invitesCache.get(guildId);
  if (!cached) return;
  cached.delete(invite.code);
  invitesCache.set(guildId, cached);
}

/**
 * Diff current vs. cached invite use-counts to guess which invite a new
 * member used. Returns { code, inviterId } or null (vanity URL joins,
 * oauth2 joins, or missing Manage Server permission all resolve to null).
 * Updates the cache as a side effect — call this ONCE per join and share
 * the result with anything else that needs it (see events/guildMemberAdd.js).
 */
async function resolveUsedInvite(guild) {
  try {
    if (!guild || !guild.members?.me) return null;
    if (!guild.members.me.permissions.has('ManageGuild')) return null;

    const previous = invitesCache.get(guild.id) || new Map();
    const currentInvites = await guild.invites.fetch();
    const current = new Map();
    currentInvites.forEach((inv) => current.set(inv.code, { uses: inv.uses || 0, inviterId: inv.inviter?.id || '' }));

    let result = null;
    let deltaMax = 0;
    for (const [code, entry] of current.entries()) {
      const delta = entry.uses - (previous.get(code)?.uses || 0);
      if (delta > deltaMax) {
        deltaMax = delta;
        result = { code, inviterId: entry.inviterId };
      }
    }

    invitesCache.set(guild.id, current);
    return result;
  } catch {
    return null;
  }
}

/** Add every role in roleIds the member doesn't already have, skipping ones above the bot's own top role. */
async function addRolesSafely(member, roleIds) {
  if (!Array.isArray(roleIds) || !roleIds.length) return [];

  const guild = member.guild;
  const botMember = guild.members.me;
  if (!botMember) return [];

  const botTop = botMember.roles.highest;
  const added = [];

  for (const roleId of roleIds) {
    try {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;
      if (role.position >= botTop.position) continue; // role hierarchy — never attempt, would 403 anyway
      if (member.roles.cache.has(role.id)) continue;

      await member.roles.add(role, 'Auto Rules');
      added.push(role.id);
    } catch {
      // Missing permission on this one role, deleted mid-flight, etc. — keep going with the rest.
    }
  }

  return added;
}

/** @param {{code: string, inviterId: string} | null} usedInvite pre-resolved by events/guildMemberAdd.js */
async function handleMemberAdd(member, usedInvite = null) {
  const guildDoc = await GuildModel.findOne({ guildId: member.guild.id });
  const rules = guildDoc?.autoRoleRules;
  if (!rules || rules.enabled === false) return;

  const isBot = member.user.bot;
  const roleSet = new Set(isBot ? rules.botRoleIds : rules.memberRoleIds);

  if (!isBot && rules.inviteRoles?.length && usedInvite?.code) {
    const match = rules.inviteRoles.find((r) => r.invite === usedInvite.code);
    if (match?.roleId) roleSet.add(match.roleId);
  }

  if (!roleSet.size) return;

  const added = await addRolesSafely(member, Array.from(roleSet));
  if (added.length) {
    await logService.log(member.client, member.guild.id, 'autoRoleAssign', {
      User: `<@${member.id}>`,
      Roles: added.map((id) => `<@&${id}>`).join(', ')
    });
  }
}

module.exports = {
  handleMemberAdd,
  cacheGuildInvites,
  trackInviteCreate,
  trackInviteDelete,
  resolveUsedInvite,
  addRolesSafely
};
