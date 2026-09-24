const { PermissionFlagsBits } = require('discord.js');

/**
 * Real Discord permission checks — never rely on hiding the command only.
 * Each helper returns true/false. Commands must check before executing.
 */
function memberHas(interactionOrMember, flag) {
  const member = interactionOrMember.member ?? interactionOrMember;
  if (!member || !member.permissions) return false;
  return member.permissions.has(flag);
}

/**
 * canModerate — role-hierarchy guard for moderation actions (ban/kick/mute/warn/etc).
 * Prevents a staff member from acting on the server owner, or on anyone whose
 * highest role is equal to or higher than their own — the same rule Discord's own
 * built-in role hierarchy enforces in the UI, but our commands weren't checking it
 * (only `member.bannable` was, which only compares the BOT's role to the target,
 * not the moderator's). Applies identically whether the command came from a slash
 * command or a prefix shortcut, since both build the same `interaction`-shaped
 * object and this only reads `guild`/`member`/`user` off of it.
 *
 * The guild owner is always exempt (can moderate anyone below them, per Discord's
 * own rule), and someone acting on themselves is a separate case commands should
 * still block explicitly if that's undesired.
 *
 * @param {object} interaction - has .guild, .user, and (for the actor) .member
 * @param {GuildMember} targetMember - the member being acted on (already fetched)
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function canModerate(interaction, targetMember) {
  const guild = interaction.guild;
  const actorId = interaction.user.id;

  if (!targetMember) return { ok: true }; // target isn't in the server (e.g. ban-by-ID) — nothing to compare

  if (targetMember.id === guild.ownerId) {
    return { ok: false, reason: '❌ ما تقدر تحرر صاحب السيرفر.' };
  }

  if (actorId === guild.ownerId) return { ok: true }; // owner can moderate anyone else

  const actorMember = interaction.member;
  const actorTop = actorMember?.roles?.highest?.position ?? 0;
  const targetTop = targetMember.roles?.highest?.position ?? 0;

  if (targetTop >= actorTop) {
    return { ok: false, reason: '❌ ما تقدر تحرر عضو برتبة مساوية أو أعلى من رتبتك.' };
  }

  return { ok: true };
}

module.exports = {
  memberHas,
  canModerate,
  can: {
    ban: (i) => memberHas(i, PermissionFlagsBits.BanMembers),
    kick: (i) => memberHas(i, PermissionFlagsBits.KickMembers),
    timeout: (i) => memberHas(i, PermissionFlagsBits.ModerateMembers),
    // Warn "inherits" from timeout, but also from kick/ban — someone who can kick or
    // ban but for some reason wasn't given the Timeout Members permission should
    // still be able to warn (it's a lighter action than either of those).
    warn: (i) =>
      memberHas(i, PermissionFlagsBits.ModerateMembers) ||
      memberHas(i, PermissionFlagsBits.KickMembers) ||
      memberHas(i, PermissionFlagsBits.BanMembers),
    manageMessages: (i) => memberHas(i, PermissionFlagsBits.ManageMessages),
    manageChannels: (i) => memberHas(i, PermissionFlagsBits.ManageChannels),
    manageGuild: (i) => memberHas(i, PermissionFlagsBits.ManageGuild),
    administrator: (i) => memberHas(i, PermissionFlagsBits.Administrator),
    isOwner: (i) => i.guild && i.guild.ownerId === i.user.id,

    manageNicknames: (i) => memberHas(i, PermissionFlagsBits.ManageNicknames),
    manageRoles: (i) => memberHas(i, PermissionFlagsBits.ManageRoles),
    moveMembers: (i) => memberHas(i, PermissionFlagsBits.MoveMembers),
    muteMembers: (i) => memberHas(i, PermissionFlagsBits.MuteMembers),
    mentionEveryone: (i) => memberHas(i, PermissionFlagsBits.MentionEveryone)
  }
};
