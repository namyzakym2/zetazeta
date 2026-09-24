const {
  AuditLogEvent, PermissionFlagsBits, PermissionsBitField, ChannelType, OverwriteType
} = require('discord.js');
const Shield = require('../models/Shield');
const ShieldCase = require('../models/ShieldCase');
const logService = require('./logService');

/**
 * shieldService — shared engine behind ZETA Shield (anti-nuke / anti-raid / anti-spam /
 * quarantine / panic). Everything here is guild-scoped and defensive: a failure to punish or
 * revert must never crash the event handler that called us.
 */

/* ------------------------------------------------------------------ config */

const cache = new Map(); // guildId -> { at, doc }
const CACHE_MS = 15_000;

async function getConfig(guildId, { fresh = false } = {}) {
  const hit = cache.get(guildId);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.doc;
  let doc = await Shield.findOne({ guildId });
  if (!doc) doc = await Shield.create({ guildId });
  cache.set(guildId, { at: Date.now(), doc });
  return doc;
}
function invalidate(guildId) { cache.delete(guildId); }
async function saveConfig(doc) {
  await doc.save();
  cache.set(doc.guildId, { at: Date.now(), doc });
  return doc;
}

/* ---------------------------------------------------------------- whitelist */

const DANGEROUS = [
  PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ManageWebhooks, PermissionFlagsBits.MentionEveryone, PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageGuildExpressions
];

function dangerousBits(perms) {
  const bits = new PermissionsBitField(perms);
  return DANGEROUS.filter((f) => bits.has(f, false)); // ignore the Administrator shortcut so each flag is explicit
}

/** Owner, the bot itself, whitelisted users/roles and trusted admins are never punished. */
async function isTrusted(guild, userId, cfg) {
  if (!userId) return false;
  if (userId === guild.ownerId || userId === guild.client.user.id) return true;
  if (cfg.whitelist.userIds.includes(userId) || cfg.trustedAdminIds.includes(userId)) return true;
  if (cfg.whitelist.roleIds.length) {
    const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
    if (member && member.roles.cache.some((r) => cfg.whitelist.roleIds.includes(r.id))) return true;
  }
  return false;
}

/* --------------------------------------------------------------- rate limits */

const buckets = new Map(); // `${guild}:${user}:${key}` -> number[] timestamps
function track(guildId, userId, key, windowSec) {
  const k = `${guildId}:${userId}:${key}`;
  const now = Date.now();
  const arr = (buckets.get(k) || []).filter((t) => now - t < windowSec * 1000);
  arr.push(now);
  buckets.set(k, arr);
  if (buckets.size > 5000) for (const [bk, v] of buckets) if (!v.length || now - v[v.length - 1] > 120_000) buckets.delete(bk);
  return arr.length;
}

/* -------------------------------------------------------------- audit lookup */

async function findExecutor(guild, type, targetId = null, maxAgeMs = 8000) {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;
  const logs = await guild.fetchAuditLogs({ type, limit: 8 }).catch(() => null);
  const entry = logs?.entries.find((e) => (!targetId || e.target?.id === targetId) && Date.now() - e.createdTimestamp < maxAgeMs);
  return entry ? { executor: entry.executor, entry } : null;
}

/* ------------------------------------------------------------------- logging */

async function record(client, guildId, kind, { userId = '', action = '', reason = '' } = {}) {
  await ShieldCase.create({ guildId, kind, userId, action, reason }).catch(() => {});
  const cfg = await getConfig(guildId).catch(() => null);
  const titles = { nuke: '🛡️ Shield — Anti-Nuke', raid: '🚨 Shield — Anti-Raid', spam: '🔥 Shield — Anti-Spam', quarantine: '🔒 Shield — Quarantine', panic: '🚨 Shield — Panic Mode', gate: '🚪 Shield — Join Gate', revert: '♻️ Shield — Reverted' };
  const fields = { User: userId ? `<@${userId}> (${userId})` : null, Action: action, Reason: reason };
  // Dedicated alert channel first (falls back to the regular log routing below).
  const guild = client.guilds.cache.get(guildId);
  const alertChannel = cfg?.logChannelId ? guild?.channels.cache.get(cfg.logChannelId) : null;
  if (alertChannel?.isTextBased?.()) {
    const { buildV2Panel } = require('../utils/componentsV2');
    const list = Object.entries(fields).filter(([, v]) => v).map(([name, value]) => ({ name, value: String(value) }));
    await alertChannel.send(buildV2Panel({ title: titles[kind] || '🛡️ Shield', color: '#ed4245', fields: list, timestamp: true })).catch(() => {});
    return;
  }
  await logService.log(client, guildId, 'shield', { Type: titles[kind] || kind, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) });
}

/* ---------------------------------------------------------------- quarantine */

async function ensureQuarantineRole(guild, cfg) {
  let role = cfg.quarantineRoleId && guild.roles.cache.get(cfg.quarantineRoleId);
  if (role) return role;
  role = guild.roles.cache.find((r) => r.name === 'Quarantine');
  if (!role) {
    role = await guild.roles.create({ name: 'Quarantine', color: 0x6b7280, permissions: [], reason: 'ZETA Shield quarantine role' }).catch(() => null);
    if (role) {
      // Hide everything from the role in the background (rate-limit friendly, capped).
      (async () => {
        let n = 0;
        for (const ch of guild.channels.cache.values()) {
          if (n++ > 150) break;
          if (ch.isThread?.()) continue;
          await ch.permissionOverwrites.edit(role, { ViewChannel: false, SendMessages: false, Connect: false, AddReactions: false }, { reason: 'ZETA Shield' }).catch(() => {});
        }
      })();
    }
  }
  if (role) { cfg.quarantineRoleId = role.id; await saveConfig(cfg); }
  return role;
}

async function quarantineMember(guild, userId, reason = 'Shield', by = 'ZETA') {
  const cfg = await getConfig(guild.id, { fresh: true });
  if (userId === guild.ownerId || userId === guild.client.user.id) return { ok: false, error: 'protected' };
  if (cfg.quarantined.some((q) => q.userId === userId)) return { ok: true, already: true };
  const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
  if (!member) return { ok: false, error: 'not_in_server' };
  const role = await ensureQuarantineRole(guild, cfg);
  const removable = member.roles.cache.filter((r) => r.id !== guild.id && !r.managed);
  const kept = member.roles.cache.filter((r) => r.managed && r.id !== guild.id).map((r) => r.id);
  const ok = await member.roles.set([...kept, ...(role ? [role.id] : [])], `ZETA Shield quarantine: ${reason}`).then(() => true).catch(() => false);
  if (!ok) return { ok: false, error: 'hierarchy' };
  await member.timeout(28 * 24 * 3600 * 1000, 'ZETA Shield quarantine').catch(() => {});
  cfg.quarantined.push({ userId, roleIds: removable.map((r) => r.id), reason, by, at: Date.now() });
  await saveConfig(cfg);
  await record(guild.client, guild.id, 'quarantine', { userId, action: 'Quarantined', reason });
  return { ok: true };
}

async function releaseMember(guild, userId, by = 'ZETA') {
  const cfg = await getConfig(guild.id, { fresh: true });
  const entry = cfg.quarantined.find((q) => q.userId === userId);
  if (!entry) return { ok: false, error: 'not_quarantined' };
  const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
  if (member) {
    const restore = entry.roleIds.filter((id) => guild.roles.cache.has(id));
    const keep = member.roles.cache.filter((r) => r.managed && r.id !== guild.id).map((r) => r.id);
    await member.roles.set([...keep, ...restore], `ZETA Shield release by ${by}`).catch(() => {});
    await member.timeout(null, 'ZETA Shield release').catch(() => {});
  }
  cfg.quarantined = cfg.quarantined.filter((q) => q.userId !== userId);
  await saveConfig(cfg);
  await record(guild.client, guild.id, 'quarantine', { userId, action: 'Released', reason: `By ${by}` });
  return { ok: true };
}

/* ------------------------------------------------------------------- punish */

/** Punish an untrusted member/bot. `mode` is one of quarantine | kick | ban | strip | timeout. */
async function punish(guild, userId, mode, reason) {
  const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
  try {
    if (mode === 'ban') { await guild.members.ban(userId, { reason: `ZETA Shield: ${reason}`, deleteMessageSeconds: 0 }); return 'Banned'; }
    if (!member) return 'Skipped (not in server)';
    if (mode === 'kick') { await member.kick(`ZETA Shield: ${reason}`); return 'Kicked'; }
    if (mode === 'timeout') { await member.timeout(60 * 60 * 1000, `ZETA Shield: ${reason}`); return 'Timed out (1h)'; }
    if (mode === 'strip') {
      await member.roles.set(member.roles.cache.filter((r) => r.managed && r.id !== guild.id).map((r) => r.id), `ZETA Shield: ${reason}`);
      return 'Roles stripped';
    }
    const res = await quarantineMember(guild, userId, reason);
    return res.ok ? 'Quarantined' : `Quarantine failed (${res.error})`;
  } catch (err) {
    return `Failed: ${err.message}`;
  }
}

/* -------------------------------------------------------------- panic / raid */

async function panicOn(guild, reason = 'Panic mode') {
  const cfg = await getConfig(guild.id, { fresh: true });
  if (cfg.panic.active) return { ok: true, already: true, locked: cfg.panic.lockedChannelIds.length };
  const everyone = guild.roles.everyone;
  const locked = [];
  for (const ch of guild.channels.cache.values()) {
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(ch.type)) continue;
    const ow = ch.permissionOverwrites.cache.get(everyone.id);
    if (ow?.deny?.has(PermissionFlagsBits.SendMessages)) continue;
    const ok = await ch.permissionOverwrites.edit(everyone, { SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false, AddReactions: false }, { reason: `ZETA Shield panic: ${reason}` }).then(() => true).catch(() => false);
    if (ok) locked.push(ch.id);
  }
  cfg.panic.active = true; cfg.panic.since = Date.now(); cfg.panic.lockedChannelIds = locked;
  await saveConfig(cfg);
  await record(guild.client, guild.id, 'panic', { action: `Panic ON — ${locked.length} channels locked`, reason });
  return { ok: true, locked: locked.length };
}

async function panicOff(guild, by = 'ZETA') {
  const cfg = await getConfig(guild.id, { fresh: true });
  const everyone = guild.roles.everyone;
  let unlocked = 0;
  for (const id of cfg.panic.lockedChannelIds) {
    const ch = guild.channels.cache.get(id);
    if (!ch) continue;
    const ok = await ch.permissionOverwrites.edit(everyone, { SendMessages: null, SendMessagesInThreads: null, CreatePublicThreads: null, AddReactions: null }, { reason: `ZETA Shield panic off (${by})` }).then(() => true).catch(() => false);
    if (ok) unlocked++;
  }
  cfg.panic.active = false; cfg.panic.since = 0; cfg.panic.lockedChannelIds = [];
  await saveConfig(cfg);
  await record(guild.client, guild.id, 'panic', { action: `Panic OFF — ${unlocked} channels unlocked`, reason: `By ${by}` });
  return { ok: true, unlocked };
}

async function raidModeSet(guild, active, by = 'ZETA') {
  const cfg = await getConfig(guild.id, { fresh: true });
  cfg.antiRaid.raidActive = Boolean(active);
  cfg.antiRaid.raidUntil = active ? Date.now() + Math.max(1, cfg.antiRaid.raidModeMinutes) * 60_000 : 0;
  await saveConfig(cfg);
  await record(guild.client, guild.id, 'raid', { action: active ? 'Raid mode ON' : 'Raid mode OFF', reason: `By ${by}` });
  return cfg;
}

/** Runs every 30s from ready.js: expires raid mode. */
async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    const cfg = await Shield.findOne({ guildId: guild.id }).catch(() => null);
    if (cfg?.antiRaid?.raidActive && cfg.antiRaid.raidUntil && Date.now() > cfg.antiRaid.raidUntil) {
      await raidModeSet(guild, false, 'auto-expire').catch(() => {});
    }
  }
}

/* ------------------------------------------------------------------- status */

async function status(guildId) {
  const cfg = await getConfig(guildId, { fresh: true });
  const cases = await ShieldCase.find({ guildId }).sort({ createdAt: -1 }).limit(10);
  return { cfg, cases };
}

module.exports = {
  getConfig, saveConfig, invalidate, isTrusted, dangerousBits, DANGEROUS, track, findExecutor, record,
  ensureQuarantineRole, quarantineMember, releaseMember, punish, panicOn, panicOff, raidModeSet, tick, status,
  AuditLogEvent, OverwriteType
};
