const { ChannelType, PermissionsBitField, OverwriteType } = require('discord.js');
const ServerBackup = require('../models/ServerBackup');

/** Structure-only backups (roles + channels + category layout + role overwrites), Wick style. */

const MAX_BACKUPS = 5;
const KEEP_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildStageVoice]);

async function createBackup(guild, by = '', name = '') {
  await guild.roles.fetch().catch(() => {});
  await guild.channels.fetch().catch(() => {});
  const roles = guild.roles.cache
    .filter((r) => r.id !== guild.id && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield.toString(), position: r.position }));
  const channels = guild.channels.cache
    .filter((c) => KEEP_TYPES.has(c.type))
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({
      name: c.name, type: c.type, parentName: c.parent?.name || null, topic: c.topic || undefined, nsfw: Boolean(c.nsfw),
      rateLimitPerUser: c.rateLimitPerUser || 0, bitrate: c.bitrate, userLimit: c.userLimit, position: c.rawPosition,
      overwrites: c.permissionOverwrites.cache.filter((o) => o.type === OverwriteType.Role).map((o) => ({
        role: o.id === guild.id ? '@everyone' : guild.roles.cache.get(o.id)?.name, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString()
      })).filter((o) => o.role)
    }));

  const doc = await ServerBackup.create({
    guildId: guild.id, createdBy: by,
    name: name || `${guild.name} — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    roles, channels
  });
  const all = await ServerBackup.find({ guildId: guild.id }).sort({ createdAt: -1 });
  for (const old of all.slice(MAX_BACKUPS)) await ServerBackup.deleteOne({ _id: old._id });
  return doc;
}

async function listBackups(guildId) {
  const list = await ServerBackup.find({ guildId }).sort({ createdAt: -1 });
  return list.map((b) => ({ id: b._id, name: b.name, createdAt: b.createdAt, roles: b.roles.length, channels: b.channels.length, createdBy: b.createdBy }));
}

async function deleteBackup(guildId, id) {
  const doc = await ServerBackup.findOne({ _id: id, guildId });
  if (!doc) return false;
  await ServerBackup.deleteOne({ _id: doc._id });
  return true;
}

/** Non-destructive: only re-creates roles / channels that are missing (matched by name). */
async function restoreBackup(guild, id) {
  const doc = await ServerBackup.findOne({ _id: id, guildId: guild.id });
  if (!doc) return { ok: false, error: 'not_found' };
  await guild.roles.fetch().catch(() => {});
  await guild.channels.fetch().catch(() => {});
  let rolesMade = 0, channelsMade = 0;

  for (const r of doc.roles) {
    if (guild.roles.cache.some((x) => x.name === r.name)) continue;
    const role = await guild.roles.create({
      name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable,
      permissions: new PermissionsBitField(BigInt(r.permissions)), reason: 'ZETA backup restore'
    }).catch(() => null);
    if (role) rolesMade++;
  }

  const roleId = (name) => (name === '@everyone' ? guild.id : guild.roles.cache.find((x) => x.name === name)?.id);
  const overwritesFor = (c) => c.overwrites.map((o) => ({ id: roleId(o.role), allow: BigInt(o.allow), deny: BigInt(o.deny) })).filter((o) => o.id);
  const cats = doc.channels.filter((c) => c.type === ChannelType.GuildCategory);
  const rest = doc.channels.filter((c) => c.type !== ChannelType.GuildCategory);

  for (const c of cats) {
    if (guild.channels.cache.some((x) => x.type === ChannelType.GuildCategory && x.name === c.name)) continue;
    const ch = await guild.channels.create({ name: c.name, type: c.type, permissionOverwrites: overwritesFor(c), reason: 'ZETA backup restore' }).catch(() => null);
    if (ch) channelsMade++;
  }
  for (const c of rest) {
    const parent = c.parentName ? guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === c.parentName) : null;
    if (guild.channels.cache.some((x) => x.type === c.type && x.name === c.name && (x.parent?.name || null) === (c.parentName || null))) continue;
    const opts = { name: c.name, type: c.type, topic: c.topic, nsfw: c.nsfw, rateLimitPerUser: c.rateLimitPerUser, parent: parent?.id, permissionOverwrites: overwritesFor(c), reason: 'ZETA backup restore' };
    if (c.type === ChannelType.GuildVoice) { opts.bitrate = c.bitrate; opts.userLimit = c.userLimit; }
    const ch = await guild.channels.create(opts).catch(() => null);
    if (ch) channelsMade++;
  }
  return { ok: true, rolesMade, channelsMade, name: doc.name };
}

module.exports = { createBackup, listBackups, deleteBackup, restoreBackup, MAX_BACKUPS };
