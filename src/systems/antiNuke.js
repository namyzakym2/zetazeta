const { ChannelType, AuditLogEvent, PermissionsBitField } = require('discord.js');
const shield = require('../services/shieldService');

/**
 * Anti-Nuke — watches the audit log for mass channel/role create+delete, mass bans/kicks and
 * webhook floods. The executor of a burst is punished (quarantine by default) and — when
 * "revert" is on — everything they deleted is re-created.
 */

const recentDeleted = new Map(); // `${guild}:${user}` -> [{ kind, snapshot, at }]
const punished = new Map();      // `${guild}:${user}` -> timestamp (recently punished → auto-revert further damage)
const PUNISHED_MS = 5 * 60 * 1000;

function bufferKey(guildId, userId) { return `${guildId}:${userId}`; }
function pushDeleted(guildId, userId, kind, snapshot) {
  const k = bufferKey(guildId, userId);
  const arr = (recentDeleted.get(k) || []).filter((e) => Date.now() - e.at < 3 * 60_000);
  arr.push({ kind, snapshot, at: Date.now() });
  recentDeleted.set(k, arr.slice(-60));
}

async function trip(guild, userId, kindLabel, cfg) {
  const key = bufferKey(guild.id, userId);
  if (punished.has(key) && Date.now() - punished.get(key) < PUNISHED_MS) return false;
  punished.set(key, Date.now());
  const result = await shield.punish(guild, userId, cfg.antiNuke.punishment, `Anti-Nuke: ${kindLabel}`);
  await shield.record(guild.client, guild.id, 'nuke', { userId, action: result, reason: kindLabel });
  if (cfg.antiNuke.panicOnTrigger) await shield.panicOn(guild, `Anti-Nuke triggered by ${userId}`).catch(() => {});
  if (cfg.antiNuke.revert) await restoreDeleted(guild, userId).catch(() => {});
  return true;
}

/* ------------------------------------------------------------------ revert */

function snapshotChannel(ch) {
  return {
    name: ch.name, type: ch.type, parentId: ch.parentId || null, topic: ch.topic || undefined, nsfw: ch.nsfw || false,
    rateLimitPerUser: ch.rateLimitPerUser || 0, position: ch.rawPosition,
    bitrate: ch.bitrate, userLimit: ch.userLimit,
    overwrites: ch.permissionOverwrites?.cache.map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() })) || []
  };
}
function snapshotRole(r) {
  return { name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield.toString(), position: r.position };
}

async function recreateChannel(guild, s) {
  if (![ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildStageVoice].includes(s.type)) return false;
  const opts = {
    name: s.name, type: s.type, topic: s.topic, nsfw: s.nsfw, rateLimitPerUser: s.rateLimitPerUser,
    parent: s.parentId && guild.channels.cache.has(s.parentId) ? s.parentId : undefined,
    permissionOverwrites: s.overwrites.filter((o) => guild.roles.cache.has(o.id) || guild.members.cache.has(o.id))
      .map((o) => ({ id: o.id, type: o.type, allow: BigInt(o.allow), deny: BigInt(o.deny) })),
    reason: 'ZETA Shield: restored after Anti-Nuke'
  };
  if (s.type === ChannelType.GuildVoice) { opts.bitrate = s.bitrate; opts.userLimit = s.userLimit; }
  const ch = await guild.channels.create(opts).catch(() => null);
  if (ch && s.position != null) await ch.setPosition(s.position).catch(() => {});
  return Boolean(ch);
}
async function recreateRole(guild, s) {
  const role = await guild.roles.create({
    name: s.name, color: s.color, hoist: s.hoist, mentionable: s.mentionable,
    permissions: new PermissionsBitField(BigInt(s.permissions)), reason: 'ZETA Shield: restored after Anti-Nuke'
  }).catch(() => null);
  return Boolean(role);
}

async function restoreDeleted(guild, userId) {
  const k = bufferKey(guild.id, userId);
  const items = recentDeleted.get(k) || [];
  recentDeleted.set(k, []);
  let restored = 0;
  // Categories first so their children can re-attach.
  items.sort((a, b) => (a.snapshot.type === ChannelType.GuildCategory ? -1 : 0) - (b.snapshot.type === ChannelType.GuildCategory ? -1 : 0));
  for (const it of items) {
    const ok = it.kind === 'channel' ? await recreateChannel(guild, it.snapshot) : await recreateRole(guild, it.snapshot);
    if (ok) restored++;
  }
  if (restored) await shield.record(guild.client, guild.id, 'revert', { userId, action: `Restored ${restored} deleted item(s)`, reason: 'Anti-Nuke revert' });
  return restored;
}

/* ---------------------------------------------------------------- handlers */

async function handleCounted(guild, auditType, targetId, key, label, snapshotFn = null, kind = null) {
  const cfg = await shield.getConfig(guild.id);
  if (!cfg.antiNuke.enabled || !cfg.antiNuke[key]?.enabled) return;
  const found = await shield.findExecutor(guild, auditType, targetId);
  const executor = found?.executor;
  if (!executor || await shield.isTrusted(guild, executor.id, cfg)) return;

  if (snapshotFn && kind) pushDeleted(guild.id, executor.id, kind, snapshotFn());

  const already = punished.has(bufferKey(guild.id, executor.id)) && Date.now() - punished.get(bufferKey(guild.id, executor.id)) < PUNISHED_MS;
  if (already) {
    // Executor was already punished but is still running: undo the damage right away.
    if (cfg.antiNuke.revert && kind) await restoreDeleted(guild, executor.id).catch(() => {});
    return;
  }
  const { limit, windowSec } = cfg.antiNuke[key];
  const count = shield.track(guild.id, executor.id, key, windowSec);
  if (count > limit) await trip(guild, executor.id, `${label} (${count} in ${windowSec}s)`, cfg);
}

const onChannelCreate = (ch) => ch.guild && handleCounted(ch.guild, AuditLogEvent.ChannelCreate, ch.id, 'channelCreate', 'Mass channel creation');
const onChannelDelete = (ch) => ch.guild && handleCounted(ch.guild, AuditLogEvent.ChannelDelete, ch.id, 'channelDelete', 'Mass channel deletion', () => snapshotChannel(ch), 'channel');
const onRoleCreate = (r) => handleCounted(r.guild, AuditLogEvent.RoleCreate, r.id, 'roleCreate', 'Mass role creation');
const onRoleDelete = (r) => handleCounted(r.guild, AuditLogEvent.RoleDelete, r.id, 'roleDelete', 'Mass role deletion', () => snapshotRole(r), 'role');
const onBan = (ban) => handleCounted(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id, 'ban', 'Mass banning');
async function onMemberRemove(member) {
  // Only kicks matter here — a plain leave has no audit entry.
  if (!member.guild) return;
  const cfg = await shield.getConfig(member.guild.id);
  if (!cfg.antiNuke.enabled || !cfg.antiNuke.kick?.enabled) return;
  return handleCounted(member.guild, AuditLogEvent.MemberKick, member.id, 'kick', 'Mass kicking');
}

async function onWebhooksUpdate(channel) {
  const guild = channel.guild;
  if (!guild) return;
  const cfg = await shield.getConfig(guild.id);
  if (!cfg.antiNuke.enabled || !cfg.antiNuke.webhookCreate?.enabled) return;
  const found = await shield.findExecutor(guild, AuditLogEvent.WebhookCreate, null, 6000);
  const executor = found?.executor;
  if (!executor || await shield.isTrusted(guild, executor.id, cfg)) return;
  const { limit, windowSec } = cfg.antiNuke.webhookCreate;
  const count = shield.track(guild.id, executor.id, 'webhookCreate', windowSec);
  if (count > limit) {
    // Delete the webhooks this executor just made, then punish.
    const hooks = await channel.fetchWebhooks().catch(() => null);
    if (hooks) for (const h of hooks.values()) if (h.owner?.id === executor.id) await h.delete('ZETA Shield: webhook flood').catch(() => {});
    await trip(guild, executor.id, `Mass webhook creation (${count} in ${windowSec}s)`, cfg);
  }
}

/** Bots added by non-whitelisted members are kicked (when enabled). */
async function onMemberAdd(member) {
  if (!member.user.bot) return;
  const guild = member.guild;
  const cfg = await shield.getConfig(guild.id);
  if (!cfg.antiNuke.enabled || !cfg.antiNuke.blockBotAdd) return;
  const found = await shield.findExecutor(guild, AuditLogEvent.BotAdd, member.id, 10_000);
  const executor = found?.executor;
  if (!executor || await shield.isTrusted(guild, executor.id, cfg) || await shield.isTrusted(guild, member.id, cfg)) return;
  await member.kick('ZETA Shield: bot added by a non-whitelisted member').catch(() => {});
  await shield.record(guild.client, guild.id, 'nuke', { userId: executor.id, action: `Kicked bot ${member.user.tag}`, reason: 'Unauthorized bot add' });
}

/** Dangerous permissions handed to @everyone (or, in strict mode, any role) are reverted. */
async function onRoleUpdate(oldRole, newRole) {
  const guild = newRole.guild;
  const cfg = await shield.getConfig(guild.id);
  if (!cfg.antiNuke.enabled) return;
  const isEveryone = newRole.id === guild.id;
  if (!(isEveryone ? cfg.antiNuke.protectEveryone : cfg.antiNuke.strictRoles)) return;
  const before = new Set(shield.dangerousBits(oldRole.permissions.bitfield));
  const added = shield.dangerousBits(newRole.permissions.bitfield).filter((f) => !before.has(f));
  if (!added.length) return;
  const found = await shield.findExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id, 8000);
  const executor = found?.executor;
  if (executor && await shield.isTrusted(guild, executor.id, cfg)) return;
  await newRole.setPermissions(oldRole.permissions, 'ZETA Shield: dangerous permission reverted').catch(() => {});
  let action = 'Permissions reverted';
  if (executor) action += ` · ${await shield.punish(guild, executor.id, cfg.antiNuke.punishment, `Dangerous permission on ${newRole.name}`)}`;
  await shield.record(guild.client, guild.id, 'nuke', { userId: executor?.id || '', action, reason: `Dangerous permission added to ${isEveryone ? '@everyone' : newRole.name}` });
}

module.exports = { onChannelCreate, onChannelDelete, onRoleCreate, onRoleDelete, onBan, onMemberRemove, onWebhooksUpdate, onMemberAdd, onRoleUpdate };
