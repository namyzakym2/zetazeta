const axios = require('axios');
const { PermissionsBitField } = require('discord.js');
const BotGuild = require('../src/models/BotGuild');

function wantsJson(req) {
  return req.path.startsWith('/api/') || req.path.startsWith('/user/') || req.path.startsWith('/admin/') || req.path.startsWith('/devil-panel/') || req.accepts('json') === 'json';
}

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) return next();
  if (wantsJson(req)) return res.status(401).json({ success: false, error: 'يجب تسجيل الدخول أولاً.' });
  return res.redirect('/?login=required');
}

function getUserGuild(user, guildId) {
  return (user?.guilds || []).find((g) => g.id === guildId) || null;
}

async function botIsInGuild(req, guildId) {
  const client = req.app.get('discordClient');
  if (client?.guilds?.cache?.has(guildId)) return true;

  try {
    const record = await BotGuild.findOne({ guildId });
    if (record) return true;
  } catch (err) {
    console.warn('BotGuild lookup failed:', err.message);
  }
  return false;
}

async function ensureGuildAdmin(req, res, next) {
  const guildId = String(req.params.guildId || '').trim();
  if (!guildId || !/^\d{15,25}$/.test(guildId)) {
    return res.status(400).json({ success: false, error: 'معرّف السيرفر غير صالح.' });
  }

  const guild = getUserGuild(req.user, guildId);
  if (!guild) return res.status(403).json({ success: false, error: 'أنت لست عضوًا في هذا السيرفر.' });

  const isOwner = Boolean(guild.owner);
  let isAdmin = false;
  try {
    const perms = new PermissionsBitField(BigInt(guild.permissions || 0));
    isAdmin = perms.has(PermissionsBitField.Flags.Administrator) || perms.has(PermissionsBitField.Flags.ManageGuild);
  } catch (_) {}

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, error: 'تحتاج صلاحية Administrator أو Manage Server.' });
  }

  if (!(await botIsInGuild(req, guildId))) {
    return res.status(409).json({ success: false, error: 'البوت غير موجود في هذا السيرفر. أضف ZETA أولاً.' });
  }

  req.dashboardGuild = guild;
  next();
}

function ensureBotOwner(req, res, next) {
  const ownerId = String(process.env.OWNER_ID || '').trim();
  if (!ownerId || req.user?.id !== ownerId) {
    return res.status(403).json({ success: false, error: 'هذا الإجراء متاح لمالك البوت فقط.' });
  }
  next();
}

async function memberHasDevilRole(req, guildId, userId, roleId) {
  const client = req.app.get('discordClient');
  const guild = client?.guilds?.cache?.get(guildId);
  if (guild) {
    try {
      const member = await guild.members.fetch(userId);
      return Boolean(member?.roles?.cache?.has(roleId));
    } catch (_) {
      return false;
    }
  }

  if (!process.env.DISCORD_TOKEN) return false;
  try {
    const result = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
      timeout: 10000
    });
    return Array.isArray(result.data?.roles) && result.data.roles.includes(roleId);
  } catch (_) {
    return false;
  }
}

async function ensureDevilRole(req, res, next) {
  const ownerId = String(process.env.OWNER_ID || '').trim();
  if (ownerId && req.user?.id === ownerId) return next();

  const guildId = String(process.env.DEVIL_PANEL_GUILD_ID || '').trim();
  const roleId = String(process.env.DEVIL_PANEL_ROLE_ID || '').trim();
  if (!guildId || !roleId || !req.user?.id) {
    return res.status(403).json({ success: false, error: 'لوحة ZetaBot Panel غير مهيأة.' });
  }

  const allowed = await memberHasDevilRole(req, guildId, req.user.id, roleId);
  if (!allowed) return res.status(403).json({ success: false, error: 'ليس لديك رتبة الوصول إلى ZetaBot Panel.' });
  next();
}

module.exports = { ensureAuth, ensureGuildAdmin, ensureBotOwner, ensureDevilRole };
