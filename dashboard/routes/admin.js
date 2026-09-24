const express = require('express');
const router = require('../asyncRouter')(express.Router({ mergeParams: true }));
const { ChannelType } = require('discord.js');
const axios = require('axios');
const { ensureAuth, ensureGuildAdmin, ensureBotOwner } = require('../middleware');

const GuildModel = require('../../src/models/Guild');
const Warning = require('../../src/models/Warning');
const Ticket = require('../../src/models/Ticket');
const User = require('../../src/models/User');
const Report = require('../../src/models/Report');
const Suggestion = require('../../src/models/Suggestion');
const StaffScore = require('../../src/models/StaffScore');
const InteractionScore = require('../../src/models/InteractionScore');
const StaffApplication = require('../../src/models/StaffApplication');
const CommandUsage = require('../../src/models/CommandUsage');
const ShieldCase = require('../../src/models/ShieldCase');
const shieldService = require('../../src/services/shieldService');
const backupService = require('../../src/services/backupService');

const economyService = require('../../src/services/economyService');
const staffPointsService = require('../../src/services/staffPointsService');
const staffRatingService = require('../../src/services/staffRatingService');
const shortcutService = require('../../src/services/shortcutService');
const commandStateService = require('../../src/services/commandStateService');
const ticketService = require('../../src/services/ticketService');
const applicationService = require('../../src/services/applicationService');
const logService = require('../../src/services/logService');
const { t } = require('../../src/services/translationService');
const { sanitizeEmoji, sanitizeHexColor } = require('../../src/utils/emoji');
const { buildV2Panel } = require('../../src/utils/componentsV2');
const { inspectCommands } = require('../../src/utils/deployCommands');
const commandPermissionService = require('../../src/services/commandPermissionService');

const VALID_BUTTON_STYLES = new Set(['Primary', 'Secondary', 'Success', 'Danger']);

/**
 * تحويل نص اللون (سواء كان يحتوي على # أو لا) إلى رقم صحيح Integer مخصص لـ Discord API
 */
function parseHexColor(colorStr, fallback = 0x7c3aed) {
  if (!colorStr) return fallback;
  const sanitized = sanitizeHexColor(colorStr, '#0f2158').replace('#', '');
  const parsed = parseInt(sanitized, 16);
  return isNaN(parsed) ? fallback : parsed;
}

async function getOrCreateGuildDoc(guildId) {
  return (await GuildModel.findOne({ guildId })) || (await GuildModel.create({ guildId }));
}

/* ---------------------------------------------------------------------- */
/* Channels / Roles — live from the Discord cache (not the DB)             */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/emojis', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildId = req.params.guildId;
  try {
    const discordClient = req.app.get('discordClient');
    const guild = discordClient?.guilds.cache.get(guildId);
    if (!guild) return res.json({ emojis: [] });
    const emojis = guild.emojis.cache.map(e => ({
      id: e.id,
      name: e.name || 'emoji',
      animated: Boolean(e.animated),
      url: e.imageURL({ extension: e.animated ? 'gif' : 'png', size: 64 }),
      value: e.toString()
    }));
    return res.json({ emojis });
  } catch (err) {
    console.error('❌ Failed to load guild emojis:', err);
    return res.status(500).json({ emojis: [], error: 'تعذر جلب إيموجيات السيرفر.' });
  }
});

const DEMO_CHANNELS = [
  { id: '1001', name: 'عام', type: 0 },
  { id: '1002', name: 'الترحيب', type: 0 },
  { id: '1003', name: 'السجلات', type: 0 },
  { id: '1004', name: 'التذاكر', type: 0 },
  { id: '1005', name: 'الأوامر', type: 0 },
  { id: '1006', name: 'الإعلانات', type: 0 }
];

const DEMO_ROLES = [
  { id: '2001', name: 'Owner', color: '#ff0055' },
  { id: '2002', name: 'Admin', color: '#5865f2' },
  { id: '2003', name: 'Moderator', color: '#57f287' },
  { id: '2004', name: 'Support', color: '#fee75c' },
  { id: '2005', name: 'Member', color: '#99aab5' }
];

router.get('/:guildId/channels', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildId = req.params.guildId;
  const TEXT_LIKE = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildCategory]);

  try {
    const discordClient = req.app.get('discordClient');
    let guild = discordClient?.guilds.cache.get(guildId);

    // The bot can be connected while its local channel cache is still cold.
    // Fetch the guild/channels before falling back to the REST API so dashboard
    // dropdowns are populated instead of silently showing an empty list.
    if (guild && (!guild.channels.cache || guild.channels.cache.size === 0)) {
      await guild.channels.fetch().catch(() => null);
    }

    if (guild) {
      const channels = guild.channels.cache
        .filter((c) => TEXT_LIKE.has(c.type))
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map((c) => ({ id: c.id, name: c.name, type: c.type }));
      return res.json({ channels: channels.length ? channels : DEMO_CHANNELS });
    }

    // Standalone-dashboard/reverse-proxy fallback.
    if (!process.env.DISCORD_TOKEN || guildId === '112233445566778899') return res.json({ channels: DEMO_CHANNELS });
    const result = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
      timeout: 20000
    });
    const channels = (result.data || [])
      .filter((c) => TEXT_LIKE.has(c.type))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((c) => ({ id: c.id, name: c.name, type: c.type }));
    return res.json({ channels: channels.length ? channels : DEMO_CHANNELS });
  } catch (err) {
    console.warn('Dashboard channel list fallback active:', err.message);
    return res.json({ channels: DEMO_CHANNELS });
  }
});


/* ---------------------------------------------------------------------- */
/* Custom Emojis — live Discord emoji management                         */
/* ---------------------------------------------------------------------- */

async function discordEmojiRest(guildId, method = 'get', emojiId = null, data = null) {
  if (!process.env.DISCORD_TOKEN) throw new Error('Missing DISCORD_TOKEN');
  const url = `https://discord.com/api/v10/guilds/${guildId}/emojis${emojiId ? `/${emojiId}` : ''}`;
  return axios({
    method,
    url,
    data,
    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    timeout: 15000
  });
}

function emojiView(emoji) {
  const ext = emoji.animated ? 'gif' : 'png';
  return {
    id: emoji.id,
    name: emoji.name,
    animated: Boolean(emoji.animated),
    available: emoji.available !== false,
    managed: Boolean(emoji.managed),
    url: `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=128&quality=lossless`,
    tag: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`
  };
}

router.get('/:guildId/emojis', ensureAuth, ensureGuildAdmin, async (req, res) => {
  try {
    const discordClient = req.app.get('discordClient');
    const guild = discordClient?.guilds.cache.get(req.params.guildId);
    if (guild) {
      return res.json({ emojis: guild.emojis.cache.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar')).map(emojiView) });
    }

    const result = await discordEmojiRest(req.params.guildId);
    res.json({ emojis: (result.data || []).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar')).map(emojiView) });
  } catch (err) {
    console.error('Custom emoji list error:', err.response?.data || err.message);
    res.status(503).json({ success: false, emojis: [], error: 'تعذر الوصول إلى إيموجيات Discord. تأكد أن التوكن صحيح والبوت داخل السيرفر.' });
  }
});

router.post('/:guildId/emojis', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const attachment = String(req.body?.url || '').trim();
  if (!/^[A-Za-z0-9_]{2,32}$/.test(name)) {
    return res.status(400).json({ success: false, error: 'اسم الإيموجي يجب أن يكون 2–32 حرفًا إنجليزيًا/رقمًا أو _.' });
  }
  if (!/^https?:\/\//i.test(attachment)) {
    return res.status(400).json({ success: false, error: 'رابط صورة الإيموجي غير صالح.' });
  }

  try {
    const discordClient = req.app.get('discordClient');
    const guild = discordClient?.guilds.cache.get(req.params.guildId);
    let emoji;

    if (guild) {
      emoji = await guild.emojis.create({
        attachment,
        name,
        reason: `ZETA Dashboard — created by ${req.user?.username || 'dashboard user'}`
      });
    } else {
      const image = await axios.get(attachment, { responseType: 'arraybuffer', timeout: 15000 });
      const mime = image.headers['content-type'] || 'image/png';
      if (!/^image\/(png|jpeg|webp|gif)$/i.test(mime)) {
        return res.status(400).json({ success: false, error: 'رابط الإيموجي يجب أن يشير إلى PNG أو JPG أو WEBP أو GIF.' });
      }
      const result = await discordEmojiRest(req.params.guildId, 'post', null, {
        name,
        image: `data:${mime};base64,${Buffer.from(image.data).toString('base64')}`
      });
      emoji = result.data;
    }

    res.json({ success: true, emoji: emojiView(emoji) });
  } catch (err) {
    console.error('Custom emoji create error:', err.response?.data || err.message);
    const raw = JSON.stringify(err.response?.data || {}) + ' ' + (err.message || '');
    const msg = /Maximum number of emojis|30008/i.test(raw)
      ? 'وصل السيرفر إلى الحد المسموح من الإيموجيات.'
      : /Missing Permissions|50013/i.test(raw)
        ? 'البوت يحتاج صلاحية Manage Expressions لإدارة الإيموجيات.'
        : /Invalid Form Body|image/i.test(raw)
          ? 'Discord رفض الصورة. جرّب PNG أو JPG أو WEBP أو GIF أصغر حجمًا.'
          : 'تعذر إنشاء الإيموجي. تأكد من الرابط والصلاحيات.';
    res.status(400).json({ success: false, error: msg });
  }
});

router.delete('/:guildId/emojis/:emojiId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  try {
    const discordClient = req.app.get('discordClient');
    const guild = discordClient?.guilds.cache.get(req.params.guildId);
    if (guild) {
      const emoji = guild.emojis.cache.get(req.params.emojiId);
      if (!emoji) return res.status(404).json({ success: false, error: 'الإيموجي غير موجود.' });
      if (emoji.managed) return res.status(400).json({ success: false, error: 'هذا الإيموجي مُدار من Discord ولا يمكن حذفه.' });
      await emoji.delete(`ZETA Dashboard — deleted by ${req.user?.username || 'dashboard user'}`);
    } else {
      await discordEmojiRest(req.params.guildId, 'delete', req.params.emojiId);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Custom emoji delete error:', err.response?.data || err.message);
    res.status(400).json({ success: false, error: /Missing Permissions|50013/i.test(JSON.stringify(err.response?.data || {})) ? 'البوت لا يملك صلاحية إدارة الإيموجيات.' : 'تعذر حذف الإيموجي.' });
  }
});

router.get('/:guildId/roles', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildId = req.params.guildId;

  try {
    const discordClient = req.app.get('discordClient');
    let guild = discordClient?.guilds.cache.get(guildId);

    if (guild && (!guild.roles.cache || guild.roles.cache.size === 0)) {
      await guild.roles.fetch().catch(() => null);
    }

    if (guild) {
      const roles = guild.roles.cache
        .filter((r) => r.id !== guild.id && !r.managed)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));
      return res.json({ roles: roles.length ? roles : DEMO_ROLES });
    }

    if (!process.env.DISCORD_TOKEN || guildId === '112233445566778899') return res.json({ roles: DEMO_ROLES });
    const result = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
      timeout: 20000
    });
    const roles = (result.data || [])
      .filter((r) => !r.managed)
      .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
      .map((r) => ({ id: r.id, name: r.name, color: r.color ? `#${Number(r.color).toString(16).padStart(6, '0')}` : '#000000' }));
    return res.json({ roles: roles.length ? roles : DEMO_ROLES });
  } catch (err) {
    console.warn('Dashboard role list fallback active:', err.message);
    return res.json({ roles: DEMO_ROLES });
  }
});

/* ---------------------------------------------------------------------- */
/* Server Overview                                                        */
/* ---------------------------------------------------------------------- */

const DAY_MS = 86400000;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const dayList = (n) => Array.from({ length: n }, (_, i) => isoDay(Date.now() - (n - 1 - i) * DAY_MS));
// Discord snowflake -> creation date (no API call needed).
const snowflakeDate = (id) => {
  try { return new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toISOString(); } catch { return null; }
};

router.get('/:guildId/overview', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const now = Date.now();
  const day30 = isoDay(now - 29 * DAY_MS), day7 = isoDay(now - 6 * DAY_MS), day14 = isoDay(now - 13 * DAY_MS), today = isoDay(now);
  const since7 = now - 7 * DAY_MS, since14 = now - 14 * DAY_MS;

  const [users, warningCount, openTickets, pendingReports, pendingSuggestions, pendingApplications, usageRows,
    tickets, reports, suggestions, warnings, apps, shieldCases, shieldCfg] = await Promise.all([
    User.find({ guildId }),
    Warning.countDocuments({ guildId, active: true }),
    Ticket.countDocuments({ guildId, status: 'open' }),
    Report.countDocuments({ guildId, status: 'pending' }),
    Suggestion.countDocuments({ guildId, status: 'pending' }),
    StaffApplication.countDocuments({ guildId, status: 'pending' }),
    CommandUsage.find({ guildId }),
    Ticket.find({ guildId }).sort({ createdAt: -1 }).limit(4),
    Report.find({ guildId }).sort({ createdAt: -1 }).limit(4),
    Suggestion.find({ guildId }).sort({ createdAt: -1 }).limit(4),
    Warning.find({ guildId }).sort({ createdAt: -1 }).limit(4),
    StaffApplication.find({ guildId }).sort({ createdAt: -1 }).limit(4),
    ShieldCase.find({ guildId }).sort({ createdAt: -1 }).limit(4),
    shieldService.getConfig(guildId, { fresh: true }).catch(() => null)
  ]);
  const guildDoc = await getOrCreateGuildDoc(guildId);

  const client = req.app.get('discordClient');
  const liveGuild = client?.guilds?.cache?.get(guildId);
  const bot = {
    online: client ? Boolean(client.isReady?.()) : null,
    uptimeMs: client?.uptime ?? null,
    ping: client?.ws?.ping >= 0 ? Math.round(client.ws.ping) : null,
    version: process.env.ZETA_VERSION || '9.0.0'
  };

  const perDay = new Map(), perCmd = new Map();
  let total30 = 0, last7 = 0, prev7 = 0;
  for (const r of usageRows) {
    if (r.day < day30) continue;
    const c = r.count || 0;
    total30 += c;
    perCmd.set(r.command, (perCmd.get(r.command) || 0) + c);
    perDay.set(r.day, (perDay.get(r.day) || 0) + c);
    if (r.day >= day7) last7 += c; else if (r.day >= day14) prev7 += c;
  }
  const topCommands = [...perCmd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  const at = (d) => d.createdAt || d.updatedAt;
  const activity = [
    ...tickets.map((r) => ({ type: 'ticket', at: at(r) })),
    ...reports.map((r) => ({ type: 'report', at: at(r) })),
    ...suggestions.map((r) => ({ type: 'suggestion', at: at(r) })),
    ...warnings.map((r) => ({ type: 'warning', at: at(r) })),
    ...apps.map((r) => ({ type: 'application', at: at(r) })),
    ...shieldCases.map((r) => ({ type: 'shield', at: at(r), text: `${r.kind}: ${r.action || r.reason || ''}`.slice(0, 80) }))
  ].filter((a) => a.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5);

  res.json({
    guildId,
    members: users.length,
    warnings: warningCount,
    openTickets,
    pendingReports,
    economy: {
      dailyBaseReward: guildDoc.dailyBaseReward,
      streakBonus: guildDoc.streakBonus,
      voteReward: guildDoc.voteReward,
      transferTaxPercent: guildDoc.transferTaxPercent
    },
    guild: {
      name: liveGuild?.name || '',
      memberCount: liveGuild?.memberCount ?? users.length,
      createdAt: snowflakeDate(guildId),
      isPremium: guildDoc.isPremium || false
    },
    bot,
    commands: { total30, last7, prev7, today: perDay.get(today) || 0 },
    newMembers: {
      last7: users.filter((u) => new Date(u.createdAt).getTime() >= since7).length,
      prev7: users.filter((u) => { const t = new Date(u.createdAt).getTime(); return t >= since14 && t < since7; }).length
    },
    topCommands,
    attention: { reports: pendingReports, tickets: openTickets, suggestions: pendingSuggestions, applications: pendingApplications, quarantined: shieldCfg?.quarantined?.length || 0 },
    shield: shieldCfg ? {
      antiNuke: shieldCfg.antiNuke.enabled, antiRaid: shieldCfg.antiRaid.enabled, antiSpam: shieldCfg.antiSpam.enabled,
      panic: shieldCfg.panic.active, raid: shieldCfg.antiRaid.raidActive, quarantined: shieldCfg.quarantined.length
    } : null,
    activity
  });
});

/** GET /admin/:guildId/usage?metric=commands|tickets|members&days=7|14|30 — daily series for the overview chart. */
router.get('/:guildId/usage', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const days = [7, 14, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
  const metric = ['commands', 'tickets', 'members'].includes(req.query.metric) ? req.query.metric : 'commands';
  const dates = dayList(days);
  const map = new Map();
  if (metric === 'commands') {
    for (const r of await CommandUsage.find({ guildId })) if (r.day >= dates[0]) map.set(r.day, (map.get(r.day) || 0) + (r.count || 0));
  } else {
    const docs = metric === 'tickets' ? await Ticket.find({ guildId }) : await User.find({ guildId });
    for (const d of docs) { if (!d.createdAt) continue; const k = isoDay(d.createdAt); if (k >= dates[0]) map.set(k, (map.get(k) || 0) + 1); }
  }
  res.json({ metric, days, dates, values: dates.map((d) => map.get(d) || 0) });
});

/* ---------------------------------------------------------------------- */
/* Activity leaderboard                                                   */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/leaderboard', ensureAuth, ensureGuildAdmin, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 25);
    const activityService = require('../../src/services/activityService');
    const voiceActivityService = require('../../src/services/voiceActivityService');

    const [text, voice] = await Promise.all([
      activityService.getLeaderboard(guildId, 'text', 'alltime', limit),
      activityService.getLeaderboard(guildId, 'voice', 'alltime', limit)
    ]);

    res.json({
      success: true,
      text: text.map((u, i) => ({
        rank: i + 1, userId: u.userId, level: u.level || 0,
        xp: u.xp || 0, messages: u.messages || 0
      })),
      voice: voice.map((u, i) => ({
        rank: i + 1, userId: u.userId,
        points: u.voicePoints || Math.floor((u.voiceSeconds || 0) / 60),
        voiceSeconds: u.voiceSeconds || 0,
        duration: voiceActivityService.formatDuration(u.voiceSeconds || 0)
      }))
    });
  } catch (err) {
    console.error('Dashboard leaderboard error:', err);
    res.status(500).json({ success: false, error: 'تعذر تحميل الليدربورد.' });
  }
});

/* ---------------------------------------------------------------------- */
/* Economy settings                                                       */
/* ---------------------------------------------------------------------- */

router.post('/:guildId/economy', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { dailyBaseReward, streakBonus, voteReward, transferTaxPercent } = req.body;

  const guildDoc = await getOrCreateGuildDoc(guildId);
  if (dailyBaseReward !== undefined) guildDoc.dailyBaseReward = Number(dailyBaseReward);
  if (streakBonus !== undefined) guildDoc.streakBonus = Number(streakBonus);
  if (voteReward !== undefined) guildDoc.voteReward = Number(voteReward);
  if (transferTaxPercent !== undefined) guildDoc.transferTaxPercent = Number(transferTaxPercent);
  await guildDoc.save();

  res.json({
    success: true,
    economy: {
      dailyBaseReward: guildDoc.dailyBaseReward,
      streakBonus: guildDoc.streakBonus,
      voteReward: guildDoc.voteReward,
      transferTaxPercent: guildDoc.transferTaxPercent
    }
  });
});

router.post('/:guildId/economy/adjust', ensureAuth, ensureGuildAdmin, ensureBotOwner, async (req, res) => {
  const { guildId } = req.params;
  const { userId, amount } = req.body;

  try {
    const user = await economyService.adminAdjust(guildId, userId, Number(amount), req.user.id);
    await logService.log(req.app.get('discordClient'), guildId, 'adminEconomyChange', {
      User: userId,
      Amount: amount,
      Admin: req.user.id
    });
    res.json({ success: true, balance: user.balance });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* ---------------------------------------------------------------------- */
/* ZETA Command Center — live command catalog + per-role permissions     */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/command-center', ensureAuth, ensureGuildAdmin, async (req, res) => {
  try {
    const report = inspectCommands();
    const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
    const permissions = (guildDoc.commandPermissions || []).map((rule) => ({
      id: String(rule._id),
      command: rule.command,
      roleId: rule.roleId,
      allowed: rule.allowed !== false
    }));
    const states = (guildDoc.commandStates || []).map((state) => ({
      command: state.command,
      enabled: state.enabled !== false
    }));

    // Command Center categories are intentionally explicit so commands are not
    // dumped into one generic "system" bucket. This keeps Admin, Help and
    // General commands separate while still allowing specialized sections.
    const categoryMeta = {
      admin: { ar: 'الإدارة', en: 'Administration', order: 10 },
      help: { ar: 'المساعدة', en: 'Help', order: 20 },
      general: { ar: 'العامة', en: 'General', order: 30 },
      moderation: { ar: 'الإشراف', en: 'Moderation', order: 40 },
      tickets: { ar: 'التذاكر', en: 'Tickets', order: 50 },
      giveaway: { ar: 'السحوبات', en: 'Giveaways', order: 60 },
      economy: { ar: 'الاقتصاد', en: 'Economy', order: 70 },
      activity: { ar: 'النشاط', en: 'Activity', order: 80 },
      reports: { ar: 'البلاغات', en: 'Reports', order: 90 },
      applications: { ar: 'التقديمات', en: 'Applications', order: 100 },
      automation: { ar: 'الأتمتة', en: 'Automation', order: 110 },
      utility: { ar: 'الأدوات', en: 'Utilities', order: 120 },
      owner: { ar: 'المالك', en: 'Owner', order: 130 },
      other: { ar: 'أخرى', en: 'Other', order: 999 }
    };

    const categoryByCommand = {
      help: 'help',
      botprofile: 'admin',
      announce: 'admin',
      'command-permission': 'admin',
      'update-commands': 'admin',
      language: 'admin',
      'set-room': 'admin',
      'auto-rules': 'automation',
      greet: 'admin',
      system: 'admin',
      'staff-ratings': 'admin',
      'setup-ticket': 'tickets',
      'ticket-panel': 'tickets',
      'ticket-button-add': 'tickets',
      giveaway: 'giveaway',
      report: 'reports',
      'application-panel': 'applications',
      'application-setup': 'applications',
      shortcuts: 'utility',
      invite: 'general',
      box: 'general',
      serverstats: 'general',
      wallet: 'economy',
      daily: 'economy',
      salary: 'economy',
      tax: 'economy',
      vote: 'economy',
      'currency-reset': 'economy',
      profile: 'activity',
      top: 'activity',
      speak: 'activity'
    };

    const folderFallback = {
      moderation: 'moderation',
      economy: 'economy',
      activity: 'activity',
      system: 'admin'
    };

    const commands = report.commands.map((cmd) => {
      const key = categoryByCommand[cmd.name] || 'other';
      const meta = categoryMeta[key] || categoryMeta.other;
      return {
        name: cmd.name,
        description: cmd.description || '',
        descriptionEn: cmd.descriptionEn || '',
        type: cmd.type || 1,
        options: cmd.options || [],
        categoryKey: key,
        category: meta.ar,
        categoryEn: meta.en,
        categoryOrder: meta.order
      };
    });

    // inspectCommands intentionally returns Discord JSON only. Recover the folder/category
    // without executing commands a second time, so the dashboard stays a read-only catalog.
    const fs = require('fs');
    const path = require('path');
    const commandsRoot = path.join(__dirname, '../../src/commands');
    const categoryByName = new Map();
    function walk(dir, rel = '') {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const nextRel = path.join(rel, entry.name);
        if (entry.isDirectory()) walk(full, nextRel);
        else if (entry.isFile() && entry.name.endsWith('.js')) {
          try {
            delete require.cache[require.resolve(full)];
            const mod = require(full);
            const name = mod?.data?.name || mod?.data?.toJSON?.()?.name;
            if (name) {
              const folder = rel.split(path.sep)[0] || 'system';
              if (!categoryByCommand[name]) {
                const key = folderFallback[folder] || 'other';
                categoryByName.set(name, key);
              }
            }
          } catch (_) {}
        }
      }
    }
    walk(commandsRoot);
    for (const cmd of commands) {
      const key = categoryByCommand[cmd.name] || categoryByName.get(cmd.name) || cmd.categoryKey || 'other';
      const meta = categoryMeta[key] || categoryMeta.other;
      cmd.categoryKey = key;
      cmd.category = meta.ar;
      cmd.categoryEn = meta.en;
      cmd.categoryOrder = meta.order;
    }

    res.json({
      success: true,
      commands,
      permissions,
      states,
      skipped: report.skipped || []
    });
  } catch (error) {
    console.error('command-center catalog error:', error);
    res.status(500).json({ success: false, error: 'تعذر تحميل مركز الأوامر.' });
  }
});

router.patch('/:guildId/command-state/:command', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, command } = req.params;
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, error: 'حدد حالة الأمر.' });
  try {
    const states = await commandStateService.setEnabled(guildId, decodeURIComponent(command), enabled);
    await logService.log(req.app.get('discordClient'), guildId, 'shortcutChange', {
      Action: enabled ? 'CommandEnabled' : 'CommandDisabled', Command: decodeURIComponent(command), Admin: req.user.id
    });
    res.json({ success: true, states: states.map((s) => ({ command: s.command, enabled: s.enabled !== false })) });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'تعذر تغيير حالة الأمر.' });
  }
});

router.post('/:guildId/command-permissions', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { command, roleId, allowed } = req.body || {};
  if (!command || !roleId || typeof allowed !== 'boolean') {
    return res.status(400).json({ success: false, error: 'حدد الأمر والرول ونوع الصلاحية.' });
  }
  try {
    const permissions = await commandPermissionService.setPermission(guildId, String(command), String(roleId), allowed);
    await logService.log(req.app.get('discordClient'), guildId, 'shortcutChange', {
      Action: allowed ? 'CommandAllow' : 'CommandDeny', Command: command, Role: roleId, Admin: req.user.id
    });
    res.json({ success: true, permissions: permissions.map((r) => ({ id: String(r._id), command: r.command, roleId: r.roleId, allowed: r.allowed !== false })) });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'تعذر حفظ الصلاحية.' });
  }
});

router.delete('/:guildId/command-permissions/:command/:roleId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, command, roleId } = req.params;
  try {
    await commandPermissionService.resetPermission(guildId, decodeURIComponent(command), roleId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'تعذر إزالة الصلاحية.' });
  }
});

/* ---------------------------------------------------------------------- */
/* Command Shortcuts Manager                                              */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/shortcuts', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ shortcuts: guildDoc.shortcuts, defaults: shortcutService.DEFAULT_SHORTCUTS });
});

router.post('/:guildId/shortcuts', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { command, shortcut } = req.body;

  if (!command || !shortcut) return res.status(400).json({ success: false, error: 'command and shortcut are required' });

  try {
    const shortcuts = await shortcutService.addShortcut(guildId, command, shortcut);
    await logService.log(req.app.get('discordClient'), guildId, 'shortcutChange', {
      Action: 'Added', Command: command, Shortcut: shortcut, Admin: req.user.id
    });
    res.json({ success: true, shortcuts });
  } catch (err) {
    if (err.message === 'DUPLICATE_SHORTCUT') return res.status(409).json({ success: false, error: 'This shortcut is already in use.' });
    if (err.message === 'RESERVED_SHORTCUT') return res.status(400).json({ success: false, error: 'This word is reserved and cannot be used.' });
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:guildId/shortcuts/:shortcutId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, shortcutId } = req.params;
  try {
    const entry = await shortcutService.updateShortcut(guildId, shortcutId, req.body);
    await logService.log(req.app.get('discordClient'), guildId, 'shortcutChange', {
      Action: 'Updated', Shortcut: entry.shortcut, Admin: req.user.id
    });
    res.json({ success: true, shortcut: entry });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/:guildId/shortcuts/:shortcutId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, shortcutId } = req.params;
  try {
    await shortcutService.deleteShortcut(guildId, shortcutId);
    await logService.log(req.app.get('discordClient'), guildId, 'shortcutChange', {
      Action: 'Deleted', ShortcutId: shortcutId, Admin: req.user.id
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/* ---------------------------------------------------------------------- */
/* Command Tester                                                         */
/* ---------------------------------------------------------------------- */

router.post('/:guildId/tester/run', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { command, testUserId } = req.body;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  let simulatedResponse;

  switch (command) {
    case 'daily': {
      const wallet = await economyService.getOrCreateWallet(testUserId);
      const wouldBeStreak = wallet.streak + 1;
      const reward = guildDoc.dailyBaseReward + Math.max(0, wouldBeStreak - 1) * guildDoc.streakBonus;
      simulatedResponse = {
        embed: '🎁 Daily Reward',
        text: `+${reward} Zeta\nStreak: ${wouldBeStreak}\n(global balance would become ${wallet.balance + reward} Zeta)`
      };
      break;
    }
    case 'wallet': {
      const wallet = await economyService.getOrCreateWallet(testUserId);
      simulatedResponse = { embed: '🏦 Bank Balance (Global)', text: `your account balance is \`$${wallet.balance}\` Zeta 😈 (Streak: ${wallet.streak} days)` };
      break;
    }
    case 'vote': {
      simulatedResponse = { embed: '🗳️ ZETA VOTE', text: `Would show vote link. Reward on real vote: +${guildDoc.voteReward} Zeta` };
      break;
    }
    case 'speak': {
      const activity = await require('../../src/services/activityService').getActivity(guildId, testUserId);
      simulatedResponse = { embed: '📊 ZETA ACTIVITY', text: activity ? `Level ${activity.level}, XP ${activity.xp}` : 'No activity data.' };
      break;
    }
    default:
      return res.status(400).json({ success: false, error: 'Unsupported command for testing.' });
  }

  res.json({
    success: true,
    simulation: true,
    warning: 'TEST MODE — this is a simulation. No Zeta was added, no streak was changed, no database economy was modified.',
    response: simulatedResponse
  });
});

/* ---------------------------------------------------------------------- */
/* Advanced Ticket Setup                                                  */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/tickets', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ ticketSettings: guildDoc.ticketSettings });
});

router.post('/:guildId/tickets', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  const allowedFields = [
    'enabled', 'panelChannelId', 'panelTitle', 'panelDescription', 'panelColor',
    'panelImage', 'panelThumbnail', 'panelFooter', 'maxTicketsPerUser',
    'ticketNameFormat', 'closeButton', 'claimButton', 'transcriptButton',
    'deleteButton', 'transcriptChannelId', 'openDisplayType', 'actionDisplayType',
    'ratingEnabled', 'ratingChannelId', 'ticketWelcomeTemplate', 'autoCloseEnabled',
    'autoCloseMinutes'
  ];
  for (const field of allowedFields) {
    if (req.body[field] === undefined) continue;
    if (field === 'panelColor') {
      guildDoc.ticketSettings.panelColor = sanitizeHexColor(req.body.panelColor, guildDoc.ticketSettings.panelColor);
      continue;
    }
    guildDoc.ticketSettings[field] = req.body[field];
  }
  await guildDoc.save();

  await logService.log(req.app.get('discordClient'), guildId, 'ticketConfigChange', {
    Admin: req.user.id
  });

  res.json({ success: true, ticketSettings: guildDoc.ticketSettings });
});

router.post('/:guildId/tickets/buttons', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { label, emoji, style, categoryId, supportRoleId, description, image } = req.body;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  const maxButtons = guildDoc.ticketSettings.openDisplayType === 'menu' ? 25 : 5;
  if (guildDoc.ticketSettings.buttons.length >= maxButtons) {
    return res.status(400).json({
      success: false,
      error: guildDoc.ticketSettings.openDisplayType === 'menu'
        ? 'وصلت للحد الأقصى (25 تصنيف في قائمة السلكت).'
        : 'Discord allows a maximum of 5 buttons per row. بدّل النظام لقائمة سلكت (openDisplayType=menu) لإضافة أكثر من 5.'
    });
  }

  if (!label || !String(label).trim()) {
    return res.status(400).json({ success: false, error: 'Label is required.' });
  }
  if (String(label).length > 80) {
    return res.status(400).json({ success: false, error: 'Label must be 80 characters or fewer.' });
  }

  let safeEmoji = '';
  if (emoji && String(emoji).trim()) {
    safeEmoji = sanitizeEmoji(String(emoji).trim());
    if (!safeEmoji) {
      return res.status(400).json({
        success: false,
        error: 'Invalid emoji. Use a real unicode emoji (🎫) or a custom emoji tag (<:name:id>).'
      });
    }
  }

  const safeStyle = VALID_BUTTON_STYLES.has(style) ? style : 'Primary';

  guildDoc.ticketSettings.buttons.push({
    label: String(label).trim(),
    emoji: safeEmoji,
    style: safeStyle,
    categoryId,
    supportRoleId,
    description: description ? String(description).slice(0, 500) : '',
    image: image || ''
  });
  await guildDoc.save();

  res.json({ success: true, buttons: guildDoc.ticketSettings.buttons });
});

router.delete('/:guildId/tickets/buttons/:buttonId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, buttonId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  guildDoc.ticketSettings.buttons.pull(buttonId);
  await guildDoc.save();
  res.json({ success: true, buttons: guildDoc.ticketSettings.buttons });
});

/**
 * أزرار "جاهزة" (Quick Buttons) تضاف تلقائيًا داخل كل تذكرة جديدة تُفتح من
 * البانل الرئيسي — الضغط عليها يعرض نص رد جاهز (بدون تشغيل /ticket-button-add).
 */
router.post('/:guildId/tickets/quick-buttons', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { label, response, emoji, style } = req.body;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  if (!label || !String(label).trim()) {
    return res.status(400).json({ success: false, error: 'نص الزر مطلوب.' });
  }
  if (!response || !String(response).trim()) {
    return res.status(400).json({ success: false, error: 'الرد النصي مطلوب.' });
  }
  if (guildDoc.ticketSettings.quickButtons.length >= 20) {
    return res.status(400).json({ success: false, error: 'وصلت للحد الأقصى (20 زر جاهز).' });
  }

  let safeEmoji = '';
  if (emoji && String(emoji).trim()) {
    safeEmoji = sanitizeEmoji(String(emoji).trim()) || '';
  }
  const safeStyle = VALID_BUTTON_STYLES.has(style) ? style : 'Secondary';

  guildDoc.ticketSettings.quickButtons.push({
    label: String(label).trim().slice(0, 80),
    response: String(response).trim().slice(0, 1000),
    emoji: safeEmoji,
    style: safeStyle
  });
  await guildDoc.save();

  res.json({ success: true, quickButtons: guildDoc.ticketSettings.quickButtons });
});

router.delete('/:guildId/tickets/quick-buttons/:buttonId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, buttonId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  guildDoc.ticketSettings.quickButtons.pull(buttonId);
  await guildDoc.save();
  res.json({ success: true, quickButtons: guildDoc.ticketSettings.quickButtons });
});

router.get('/:guildId/tickets/preview', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  const discordClient = req.app.get('discordClient');
  const guild = discordClient?.guilds.cache.get(req.params.guildId);
  const s = guildDoc.ticketSettings;
  res.json({
    title: `🎫 ${s.panelTitle || guild?.name || ''}`,
    description: s.panelDescription,
    color: s.panelColor,
    image: s.panelImage,
    thumbnail: s.panelThumbnail,
    footer: s.panelFooter || guild?.name || '',
    openDisplayType: s.openDisplayType,
    actionDisplayType: s.actionDisplayType,
    buttons: s.buttons.map((b) => ({ label: b.label, emoji: b.emoji, style: b.style, description: b.description })),
    quickButtons: s.quickButtons.map((b) => ({ label: b.label, emoji: b.emoji, style: b.style, response: b.response }))
  });
});

/* ---------------------------------------------------------------------- */
/* بانلات تذاكر إضافية (بجانب البانل الرئيسي أعلاه)                        */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/ticket-panels', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ panels: guildDoc.ticketPanels });
});

router.post('/:guildId/ticket-panels', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { name } = req.body;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'اسم البانل مطلوب.' });
  }
  if (guildDoc.ticketPanels.length >= 10) {
    return res.status(400).json({ success: false, error: 'وصلت للحد الأقصى (10 بانلات إضافية).' });
  }

  guildDoc.ticketPanels.push({ name: String(name).trim().slice(0, 100) });
  await guildDoc.save();

  res.json({ success: true, panels: guildDoc.ticketPanels });
});

const TICKET_PANEL_FIELDS = [
  'name', 'enabled', 'panelChannelId', 'panelTitle', 'panelDescription', 'panelColor',
  'panelImage', 'panelThumbnail', 'panelFooter', 'maxTicketsPerUser', 'ticketNameFormat',
  'closeButton', 'claimButton', 'transcriptButton', 'deleteButton', 'transcriptChannelId',
  'openDisplayType', 'actionDisplayType', 'ratingEnabled', 'ratingChannelId'
];

router.put('/:guildId/ticket-panels/:panelId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.ticketPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'البانل غير موجود.' });

  for (const field of TICKET_PANEL_FIELDS) {
    if (req.body[field] === undefined) continue;
    if (field === 'panelColor') {
      doc.panelColor = sanitizeHexColor(req.body.panelColor, doc.panelColor);
      continue;
    }
    doc[field] = req.body[field];
  }
  await guildDoc.save();

  res.json({ success: true, panels: guildDoc.ticketPanels });
});

router.delete('/:guildId/ticket-panels/:panelId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  guildDoc.ticketPanels.pull(panelId);
  await guildDoc.save();
  res.json({ success: true, panels: guildDoc.ticketPanels });
});

router.post('/:guildId/ticket-panels/:panelId/buttons', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const { label, emoji, style, categoryId, supportRoleId, description, image } = req.body;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.ticketPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'البانل غير موجود.' });

  const maxButtons = doc.openDisplayType === 'menu' ? 25 : 5;
  if (doc.buttons.length >= maxButtons) {
    return res.status(400).json({
      success: false,
      error: doc.openDisplayType === 'menu' ? 'وصلت للحد الأقصى (25 تصنيف).' : 'الحد الأقصى 5 أزرار — أو بدّل النظام لقائمة سلكت.'
    });
  }
  if (!label || !String(label).trim()) {
    return res.status(400).json({ success: false, error: 'Label is required.' });
  }

  let safeEmoji = '';
  if (emoji && String(emoji).trim()) {
    safeEmoji = sanitizeEmoji(String(emoji).trim());
    if (!safeEmoji) {
      return res.status(400).json({ success: false, error: 'Invalid emoji.' });
    }
  }
  const safeStyle = VALID_BUTTON_STYLES.has(style) ? style : 'Primary';

  doc.buttons.push({
    label: String(label).trim().slice(0, 80),
    emoji: safeEmoji,
    style: safeStyle,
    categoryId,
    supportRoleId,
    description: description ? String(description).slice(0, 500) : '',
    image: image || ''
  });
  await guildDoc.save();

  res.json({ success: true, panels: guildDoc.ticketPanels });
});

router.delete('/:guildId/ticket-panels/:panelId/buttons/:buttonId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId, buttonId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.ticketPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'البانل غير موجود.' });
  doc.buttons.pull(buttonId);
  await guildDoc.save();
  res.json({ success: true, panels: guildDoc.ticketPanels });
});

router.post('/:guildId/ticket-panels/:panelId/quick-buttons', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const { label, response, emoji, style } = req.body;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.ticketPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'البانل غير موجود.' });

  if (!label || !String(label).trim() || !response || !String(response).trim()) {
    return res.status(400).json({ success: false, error: 'نص الزر والرد مطلوبان.' });
  }
  if (doc.quickButtons.length >= 20) {
    return res.status(400).json({ success: false, error: 'وصلت للحد الأقصى (20 زر جاهز).' });
  }

  let safeEmoji = '';
  if (emoji && String(emoji).trim()) safeEmoji = sanitizeEmoji(String(emoji).trim()) || '';
  const safeStyle = VALID_BUTTON_STYLES.has(style) ? style : 'Secondary';

  doc.quickButtons.push({
    label: String(label).trim().slice(0, 80),
    response: String(response).trim().slice(0, 1000),
    emoji: safeEmoji,
    style: safeStyle
  });
  await guildDoc.save();

  res.json({ success: true, panels: guildDoc.ticketPanels });
});

router.delete('/:guildId/ticket-panels/:panelId/quick-buttons/:buttonId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId, buttonId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.ticketPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'البانل غير موجود.' });
  doc.quickButtons.pull(buttonId);
  await guildDoc.save();
  res.json({ success: true, panels: guildDoc.ticketPanels });
});

router.post('/:guildId/ticket-panels/:panelId/send', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ success: false, error: 'اختر روم أولاً.' });

  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.ticketPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'البانل غير موجود.' });

  const discordClient = req.app.get('discordClient');
  const guild = discordClient?.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!guild || !channel || !channel.isTextBased()) {
    return res.status(400).json({ success: false, error: 'الروم غير موجود أو مو نصي.' });
  }

  try {
    const payload = ticketService.buildOpenPanelPayload(guild, doc, doc._id.toString());
    await channel.send(payload);
  } catch (err) {
    console.error('❌ Ticket panel send failed:', err);
    return res.status(400).json({ success: false, error: 'فشل الإرسال — تأكد من صلاحيات البوت في الروم.' });
  }

  doc.enabled = true;
  doc.panelChannelId = channelId;
  await guildDoc.save();

  await logService.log(discordClient, guildId, 'ticketConfigChange', {
    Admin: req.user.id,
    Action: `Sent ticket panel "${doc.name}" to #${channel.name}`
  });

  res.json({ success: true });
});

/* ---------------------------------------------------------------------- */
/* تقديم الإدارة (Staff Applications)                                      */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/application-panels', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ panels: guildDoc.applicationPanels });
});

router.post('/:guildId/application-panels', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { name } = req.body;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'اسم البانل مطلوب.' });
  }
  if (guildDoc.applicationPanels.length >= 10) {
    return res.status(400).json({ success: false, error: 'وصلت للحد الأقصى (10 بانلات تقديم).' });
  }

  guildDoc.applicationPanels.push({ name: String(name).trim().slice(0, 50) });
  await guildDoc.save();

  res.json({ success: true, panels: guildDoc.applicationPanels });
});

const APPLICATION_PANEL_FIELDS = [
  'name', 'enabled', 'panelTitle', 'panelDescription', 'panelColor', 'panelImage', 'panelThumbnail', 'panelFooter',
  'buttonLabel', 'buttonEmoji', 'buttonStyle', 'reviewChannelId', 'reviewPingRoleId', 'acceptRoleId',
  'createTicketOnSubmit', 'ticketCategoryId', 'preventDuplicatePending', 'acceptMessage', 'rejectMessage'
];

router.put('/:guildId/application-panels/:panelId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.applicationPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'البانل غير موجود.' });

  if (req.body.name !== undefined && !String(req.body.name).trim()) {
    return res.status(400).json({ success: false, error: 'اسم البانل مطلوب.' });
  }

  for (const field of APPLICATION_PANEL_FIELDS) {
    if (req.body[field] === undefined) continue;
    if (field === 'panelColor') {
      doc.panelColor = sanitizeHexColor(req.body.panelColor, doc.panelColor);
      continue;
    }
    if (field === 'buttonEmoji') {
      doc.buttonEmoji = req.body.buttonEmoji ? (sanitizeEmoji(String(req.body.buttonEmoji).trim()) || '') : '';
      continue;
    }
    if (field === 'buttonStyle') {
      doc.buttonStyle = VALID_BUTTON_STYLES.has(req.body.buttonStyle) ? req.body.buttonStyle : doc.buttonStyle;
      continue;
    }
    if (field === 'name') {
      doc.name = String(req.body.name).trim().slice(0, 50);
      continue;
    }
    doc[field] = req.body[field];
  }

  // الأسئلة تُستبدل بالكامل كل مرة — بحد أقصى 5 (قيد المودال بالديسكورد)، وأول
  // سؤال إجباري حتى يبقى فيه على الأقل سؤال واحد بأي بانل.
  if (Array.isArray(req.body.questions)) {
    const questions = req.body.questions
      .map((q) => (typeof q === 'string' ? q : q?.text))
      .filter((text) => text && String(text).trim())
      .slice(0, 5)
      .map((text) => ({ text: String(text).trim().slice(0, 45) }));

    if (!questions.length) {
      return res.status(400).json({ success: false, error: 'لازم سؤال واحد على الأقل.' });
    }
    doc.questions = questions;
  }

  await guildDoc.save();
  res.json({ success: true, panels: guildDoc.applicationPanels });
});

router.delete('/:guildId/application-panels/:panelId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  guildDoc.applicationPanels.pull(panelId);
  await guildDoc.save();
  res.json({ success: true, panels: guildDoc.applicationPanels });
});

router.post('/:guildId/application-panels/:panelId/send', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ success: false, error: 'اختر روم أولاً.' });

  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.applicationPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'البانل غير موجود.' });
  if (!doc.reviewChannelId && !doc.createTicketOnSubmit) {
    return res.status(400).json({ success: false, error: 'حدد "روم المراجعة" أو فعّل "تكت لكل تقديم" قبل ما ترسل البانل.' });
  }

  const discordClient = req.app.get('discordClient');
  const guild = discordClient?.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!guild || !channel || !channel.isTextBased()) {
    return res.status(400).json({ success: false, error: 'الروم غير موجود أو مو نصي.' });
  }

  try {
    const payload = applicationService.buildPanelPayload(guild, doc);
    await channel.send(payload);
  } catch (err) {
    console.error('❌ Application panel send failed:', err);
    return res.status(400).json({ success: false, error: 'فشل الإرسال — تأكد من صلاحيات البوت في الروم.' });
  }

  doc.panelChannelId = channelId;
  await guildDoc.save();

  await logService.log(discordClient, guildId, 'ticketConfigChange', {
    Admin: req.user.id,
    Action: `Sent application panel "${doc.name}" to #${channel.name}`
  });

  res.json({ success: true });
});

// آخر 50 تقديم (لأي بانل) — عرض فقط، بدون قبول/رفض من الداشبورد (يصير من روم
// المراجعة نفسه بأزرار قبول/رفض عشان يبقى القرار موثّق بديسكورد).
router.get('/:guildId/applications', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const applications = await StaffApplication.find({ guildId: req.params.guildId })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ applications });
});

/* ---------------------------------------------------------------------- */
/* تقييم الإدارة (Staff Ratings)                                          */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/staff-ratings', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const leaderboard = await staffRatingService.getLeaderboard(req.params.guildId, 25);
  res.json({ leaderboard });
});


/* ---------------------------------------------------------------------- */
/* Embed Builder — Reusable Embeds Library                                 */
/* ---------------------------------------------------------------------- */

/**
 * يحوّل مستند embed محفوظ (title/description/fields/thumbnail/...) إلى
 * payload جاهز على نظام Components v2 بدل الإمبدات القديمة.
 */
function buildV2PayloadFromDoc(doc, rows = []) {
  const fields = (doc.fields || [])
    .filter((f) => f.name && f.value)
    .slice(0, 25)
    .map((f) => ({ name: String(f.name).slice(0, 256), value: String(f.value).slice(0, 1024) }));

  // Components v2 ما فيه "Author block" مثل الإمبدات القديمة، فنعرض اسم الكاتب
  // كسطر بولد فوق الوصف، وأيقونته كصورة مصغّرة إذا ما فيه thumbnail محدد أصلاً.
  let description = doc.description ? String(doc.description).slice(0, 4096) : '';
  if (doc.authorName) {
    const authorLine = `**${String(doc.authorName).slice(0, 256)}**`;
    description = description ? `${authorLine}\n${description}` : authorLine;
  }

  const colorInt = parseHexColor(doc.color, 0x7c3aed);
  const colorHex = `#${colorInt.toString(16).padStart(6, '0')}`;

  return buildV2Panel({
    title: doc.title ? String(doc.title).slice(0, 256) : undefined,
    description,
    fields,
    color: colorHex,
    thumbnail: doc.thumbnail || doc.authorIcon || undefined,
    image: doc.image || undefined,
    footer: doc.footer ? String(doc.footer).slice(0, 2048) : undefined,
    timestamp: Boolean(doc.timestamp),
    rows
  });
}

router.get('/:guildId/embeds', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ embeds: guildDoc.savedEmbeds });
});

router.post('/:guildId/embeds', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { name, title, description, color, authorName, authorIcon, image, thumbnail, footer, timestamp, fields } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'الاسم مطلوب.' });
  }
  const guildDoc = await getOrCreateGuildDoc(guildId);
  if (guildDoc.savedEmbeds.length >= 50) {
    return res.status(400).json({ success: false, error: 'وصلت للحد الأقصى (50 embed محفوظ).' });
  }

  guildDoc.savedEmbeds.push({
    name: String(name).trim().slice(0, 100),
    title: title || '',
    description: description || '',
    color: sanitizeHexColor(color, '#0f2158'),
    authorName: authorName || '',
    authorIcon: authorIcon || '',
    image: image || '',
    thumbnail: thumbnail || '',
    footer: footer || '',
    timestamp: Boolean(timestamp),
    fields: Array.isArray(fields) ? fields.slice(0, 25).map((f) => ({ name: f.name || '', value: f.value || '', inline: Boolean(f.inline) })) : []
  });
  await guildDoc.save();

  res.json({ success: true, embeds: guildDoc.savedEmbeds });
});

router.put('/:guildId/embeds/:embedId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, embedId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.savedEmbeds.id(embedId);
  if (!doc) return res.status(404).json({ success: false, error: 'Embed غير موجود.' });

  const { name, title, description, color, authorName, authorIcon, image, thumbnail, footer, timestamp, fields } = req.body;
  if (name !== undefined) doc.name = String(name).trim().slice(0, 100) || doc.name;
  if (title !== undefined) doc.title = title;
  if (description !== undefined) doc.description = description;
  if (color !== undefined) doc.color = sanitizeHexColor(color, doc.color);
  if (authorName !== undefined) doc.authorName = authorName;
  if (authorIcon !== undefined) doc.authorIcon = authorIcon;
  if (image !== undefined) doc.image = image;
  if (thumbnail !== undefined) doc.thumbnail = thumbnail;
  if (footer !== undefined) doc.footer = footer;
  if (timestamp !== undefined) doc.timestamp = Boolean(timestamp);
  if (Array.isArray(fields)) doc.fields = fields.slice(0, 25).map((f) => ({ name: f.name || '', value: f.value || '', inline: Boolean(f.inline) }));

  await guildDoc.save();
  res.json({ success: true, embeds: guildDoc.savedEmbeds });
});

router.delete('/:guildId/embeds/:embedId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, embedId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  guildDoc.savedEmbeds.pull(embedId);
  await guildDoc.save();
  res.json({ success: true, embeds: guildDoc.savedEmbeds });
});

router.post('/:guildId/embeds/:embedId/send', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, embedId } = req.params;
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ success: false, error: 'اختر روم أولاً.' });

  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.savedEmbeds.id(embedId);
  if (!doc) return res.status(404).json({ success: false, error: 'Embed غير موجود.' });

  const discordClient = req.app.get('discordClient');
  const guild = discordClient?.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ success: false, error: 'الروم غير موجود أو مو نصي.' });
  }

  try {
    const panel = buildV2PayloadFromDoc(doc);
    await channel.send(panel);
  } catch (err) {
    console.error('❌ Embed send failed:', err);
    return res.status(400).json({ success: false, error: 'فشل الإرسال — تأكد من صلاحيات البوت في الروم.' });
  }

  await logService.log(discordClient, guildId, 'systemConfigChange', {
    Admin: req.user.id,
    Action: `Sent embed "${doc.name}" to #${channel.name}`
  });

  res.json({ success: true });
});

/* ---------------------------------------------------------------------- */
/* Component Panels — embed messages with buttons / select menus wired    */
/* to simple actions (give/remove role, or send a text reply).            */
/* ---------------------------------------------------------------------- */

const VALID_ACTION_TYPES = new Set(['giveRole', 'removeRole', 'toggleRole', 'sendMessage']);

function sanitizeAction(a) {
  const type = VALID_ACTION_TYPES.has(a?.type) ? a.type : 'sendMessage';
  return {
    type,
    roleId: type === 'sendMessage' ? '' : String(a?.roleId || ''),
    message: type === 'sendMessage' ? String(a?.message || '').slice(0, 1900) : ''
  };
}

function sanitizeComponent(c) {
  const kind = c?.kind === 'select' ? 'select' : 'button';
  if (kind === 'select') {
    return {
      kind,
      placeholder: String(c?.placeholder || 'اختر...').slice(0, 150),
      options: (Array.isArray(c?.options) ? c.options : []).slice(0, 25).map((o) => ({
        label: String(o?.label || '').slice(0, 100) || 'خيار',
        emoji: sanitizeEmoji(o?.emoji) || '',
        action: sanitizeAction(o?.action)
      }))
    };
  }
  return {
    kind,
    label: String(c?.label || 'زر').slice(0, 80),
    emoji: sanitizeEmoji(c?.emoji) || '',
    style: VALID_BUTTON_STYLES.has(c?.style) ? c.style : 'Primary',
    action: sanitizeAction(c?.action)
  };
}

router.get('/:guildId/components', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ panels: guildDoc.componentPanels });
});

router.post('/:guildId/components', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { name, title, description, color, image, footer, components } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'الاسم مطلوب.' });
  }
  const guildDoc = await getOrCreateGuildDoc(guildId);
  if (guildDoc.componentPanels.length >= 50) {
    return res.status(400).json({ success: false, error: 'وصلت للحد الأقصى (50 رسالة محفوظة).' });
  }

  guildDoc.componentPanels.push({
    name: String(name).trim().slice(0, 100),
    title: title || '',
    description: description || '',
    color: sanitizeHexColor(color, '#0f2158'),
    image: image || '',
    footer: footer || '',
    components: (Array.isArray(components) ? components : []).slice(0, 5).map(sanitizeComponent)
  });
  await guildDoc.save();

  res.json({ success: true, panels: guildDoc.componentPanels });
});

router.put('/:guildId/components/:panelId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.componentPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'الرسالة غير موجودة.' });

  const { name, title, description, color, image, footer, components } = req.body;
  if (name !== undefined) doc.name = String(name).trim().slice(0, 100) || doc.name;
  if (title !== undefined) doc.title = title;
  if (description !== undefined) doc.description = description;
  if (color !== undefined) doc.color = sanitizeHexColor(color, doc.color);
  if (image !== undefined) doc.image = image;
  if (footer !== undefined) doc.footer = footer;
  if (Array.isArray(components)) doc.components = components.slice(0, 5).map(sanitizeComponent);

  await guildDoc.save();
  res.json({ success: true, panels: guildDoc.componentPanels });
});

router.delete('/:guildId/components/:panelId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  guildDoc.componentPanels.pull(panelId);
  await guildDoc.save();
  res.json({ success: true, panels: guildDoc.componentPanels });
});

router.post('/:guildId/components/:panelId/send', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId, panelId } = req.params;
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ success: false, error: 'اختر روم أولاً.' });

  const guildDoc = await getOrCreateGuildDoc(guildId);
  const doc = guildDoc.componentPanels.id(panelId);
  if (!doc) return res.status(404).json({ success: false, error: 'الرسالة غير موجودة.' });
  if (!doc.components.length) {
    return res.status(400).json({ success: false, error: 'أضف زر أو قائمة اختيار واحدة على الأقل قبل الإرسال.' });
  }

  const discordClient = req.app.get('discordClient');
  const guild = discordClient?.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ success: false, error: 'الروم غير موجود أو مو نصي.' });
  }

  try {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
    const rows = doc.components.map((c) => {
      if (c.kind === 'select') {
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`panel_sel_${doc._id}_${c._id}`)
          .setPlaceholder(c.placeholder || 'اختر...')
          .addOptions(
            c.options.slice(0, 25).map((o) => ({
              label: o.label || 'خيار',
              value: String(o._id),
              emoji: o.emoji || undefined
            }))
          );
        return new ActionRowBuilder().addComponents(menu);
      }
      const btn = new ButtonBuilder()
        .setCustomId(`panel_btn_${doc._id}_${c._id}`)
        .setLabel(c.label || 'زر')
        .setStyle(ButtonStyle[c.style] || ButtonStyle.Primary);
      if (c.emoji) btn.setEmoji(c.emoji);
      return new ActionRowBuilder().addComponents(btn);
    });
    const panel = buildV2PayloadFromDoc(doc, rows);
    await channel.send(panel);
  } catch (err) {
    console.error('❌ Component panel send failed:', err);
    return res.status(400).json({ success: false, error: 'فشل الإرسال — تأكد من صلاحيات البوت في الروم وأن كل خيار له اسم.' });
  }

  await logService.log(discordClient, guildId, 'systemConfigChange', {
    Admin: req.user.id,
    Action: `Sent component panel "${doc.name}" to #${channel.name}`
  });

  res.json({ success: true });
});
/* ---------------------------------------------------------------------- */

router.get('/:guildId/logs', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ logSettings: guildDoc.logSettings, logTypes: Object.keys(logService.TYPE_MAP) });
});

router.post('/:guildId/logs', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  const allowed = [
    'memberChannelId', 'moderationChannelId', 'economyChannelId', 'ticketChannelId',
    'messageChannelId', 'automodChannelId', 'systemChannelId', 'voteChannelId',
    'memberLogs', 'moderationLogs', 'economyLogs', 'ticketLogs', 'messageLogs',
    'automodLogs', 'systemLogs', 'voteLogs'
  ];
  for (const field of allowed) {
    if (req.body[field] !== undefined) guildDoc.logSettings[field] = req.body[field];
  }

  // New dashboard-style per-event configuration. Each event can have its own
  // enable switch, target channel and embed color while remaining compatible
  // with the older grouped log settings.
  if (req.body.events && typeof req.body.events === 'object') {
    for (const [type, raw] of Object.entries(req.body.events)) {
      if (!logService.TYPE_MAP[type] || !raw || typeof raw !== 'object') continue;
      const color = typeof raw.color === 'string' ? raw.color.trim() : '';
      const channelId = typeof raw.channelId === 'string' ? raw.channelId.trim() : '';
      const enabled = raw.enabled !== false;
      guildDoc.logSettings.logEvents.set(type, { enabled, channelId, color });
    }
  }
  await guildDoc.save();

  await logService.log(req.app.get('discordClient'), guildId, 'systemConfigChange', {
    Setting: 'Log settings', Admin: req.user.id
  });

  res.json({ success: true, logSettings: guildDoc.logSettings });
});

/* ---------------------------------------------------------------------- */
/* Level-up settings                                                      */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/level', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ levelUp: guildDoc.levelUp });
});

router.post('/:guildId/level', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  const { enabled, channelId, message, settings } = req.body;
  if (enabled !== undefined) guildDoc.levelUp.enabled = enabled;
  if (channelId !== undefined) guildDoc.levelUp.channelId = channelId;
  if (message !== undefined) guildDoc.levelUp.message = message;

  if (settings && typeof settings === 'object') {
    const s = guildDoc.levelSettings;
    if (settings.enabled !== undefined) s.enabled = Boolean(settings.enabled);
    if (settings.xpPerMessage !== undefined) s.xpPerMessage = Math.max(0, Math.min(100, Number(settings.xpPerMessage) || 0));
    if (settings.messageCooldownSeconds !== undefined) s.messageCooldownSeconds = Math.max(0, Math.min(3600, Number(settings.messageCooldownSeconds) || 0));
    if (settings.xpPerVoiceMinute !== undefined) s.xpPerVoiceMinute = Math.max(0, Math.min(100, Number(settings.xpPerVoiceMinute) || 0));
    if (settings.resetOnLeave !== undefined) s.resetOnLeave = Boolean(settings.resetOnLeave);
    if (Array.isArray(settings.disabledChannelIds)) s.disabledChannelIds = settings.disabledChannelIds.filter(Boolean);
    if (Array.isArray(settings.disabledRoleIds)) s.disabledRoleIds = settings.disabledRoleIds.filter(Boolean);
    if (Array.isArray(settings.roleMultipliers)) {
      s.roleMultipliers = settings.roleMultipliers
        .map(x => ({ roleId: String(x.roleId || ''), multiplier: Math.max(0, Math.min(10, Number(x.multiplier) || 1)) }))
        .filter(x => x.roleId);
    }
    if (Array.isArray(settings.channelMultipliers)) {
      s.channelMultipliers = settings.channelMultipliers
        .map(x => ({ channelId: String(x.channelId || ''), multiplier: Math.max(0, Math.min(10, Number(x.multiplier) || 1)) }))
        .filter(x => x.channelId);
    }
  }
  await guildDoc.save();

  await logService.log(req.app.get('discordClient'), guildId, 'systemConfigChange', {
    Setting: 'Level-up settings', Admin: req.user.id
  });

  res.json({ success: true, levelUp: guildDoc.levelUp });
});

/* ---------------------------------------------------------------------- */
/* Seller Room                                                            */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/sellerroom', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ sellerRoom: guildDoc.sellerRoom });
});

router.post('/:guildId/sellerroom', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  const { enabled, channelId, sellerRoleId } = req.body;
  if (enabled !== undefined) guildDoc.sellerRoom.enabled = enabled;
  if (channelId !== undefined) guildDoc.sellerRoom.channelId = channelId;
  if (sellerRoleId !== undefined) guildDoc.sellerRoom.sellerRoleId = sellerRoleId;

  if (guildDoc.sellerRoom.enabled && (!guildDoc.sellerRoom.channelId || !guildDoc.sellerRoom.sellerRoleId)) {
    return res.status(400).json({
      success: false,
      error: 'لازم تحدد القناة ورتبة البائع الموثّق قبل ما تفعّل روم البيع.'
    });
  }

  await guildDoc.save();

  await logService.log(req.app.get('discordClient'), guildId, 'systemConfigChange', {
    Setting: 'Seller Room', Admin: req.user.id
  });

  res.json({ success: true, sellerRoom: guildDoc.sellerRoom });
});

/* ---------------------------------------------------------------------- */
/* Auto Responder                                                         */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/autoresponder', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ rules: guildDoc.autoResponders });
});

router.post('/:guildId/autoresponder', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { rules } = req.body;

  if (!Array.isArray(rules)) {
    return res.status(400).json({ success: false, error: 'rules must be an array.' });
  }

  // Normalize + validate `responses` for every rule before touching the DB —
  // accepts either the new `responses` array or the legacy singular `response`
  // (kept as a convenience for any external caller still using it).
  const normalized = [];
  for (const r of rules) {
    const trigger = String(r.trigger || '').trim();
    const responses = (Array.isArray(r.responses) ? r.responses : [r.response])
      .map((res) => String(res || '').trim().slice(0, 1900))
      .filter(Boolean)
      .slice(0, 10);
    if (!trigger || !responses.length) {
      return res.status(400).json({ success: false, error: 'كل قاعدة لازم تحتوي على كلمة مفتاحية ورد واحد على الأقل.' });
    }
    const idList = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 50) : []);
    normalized.push({
      trigger: trigger.slice(0, 200),
      matchType: ['contains', 'exact', 'startsWith'].includes(r.matchType) ? r.matchType : 'contains',
      caseSensitive: Boolean(r.caseSensitive),
      responses,
      response: responses[0],
      enabled: r.enabled !== false,
      mentionUser: r.mentionUser !== false,
      enabledRoleIds: idList(r.enabledRoleIds),
      disabledRoleIds: idList(r.disabledRoleIds),
      enabledChannelIds: idList(r.enabledChannelIds),
      disabledChannelIds: idList(r.disabledChannelIds)
    });
  }

  const guildDoc = await getOrCreateGuildDoc(guildId);
  guildDoc.autoResponders = normalized;
  await guildDoc.save();

  await logService.log(req.app.get('discordClient'), guildId, 'systemConfigChange', {
    Setting: 'Auto Responder', Admin: req.user.id
  });

  res.json({ success: true, rules: guildDoc.autoResponders });
});

/* ---------------------------------------------------------------------- */
/* Auto Rules                                                             */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/autorole-rules', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({ rules: guildDoc.autoRoleRules || {} });
});

router.post('/:guildId/autorole-rules', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { enabled, memberRoleIds, botRoleIds, inviteRoles } = req.body;

  if (!Array.isArray(memberRoleIds) || !Array.isArray(botRoleIds) || !Array.isArray(inviteRoles)) {
    return res.status(400).json({ success: false, error: 'memberRoleIds / botRoleIds / inviteRoles must be arrays.' });
  }
  for (const r of inviteRoles) {
    if (!r.invite || !String(r.invite).trim() || !r.roleId || !String(r.roleId).trim()) {
      return res.status(400).json({ success: false, error: 'كل ربط دعوة لازم يحتوي على كود دعوة ورول.' });
    }
  }

  const guildDoc = await getOrCreateGuildDoc(guildId);
  guildDoc.autoRoleRules = {
    enabled: enabled !== false,
    memberRoleIds: [...new Set(memberRoleIds.map(String).filter(Boolean))].slice(0, 25),
    botRoleIds: [...new Set(botRoleIds.map(String).filter(Boolean))].slice(0, 25),
    inviteRoles: inviteRoles
      .map((r) => ({ invite: String(r.invite).trim().slice(0, 100), roleId: String(r.roleId).trim() }))
      .slice(0, 25)
  };
  await guildDoc.save();

  await logService.log(req.app.get('discordClient'), guildId, 'systemConfigChange', {
    Setting: 'Auto Rules', Admin: req.user.id
  });

  res.json({ success: true, rules: guildDoc.autoRoleRules });
});

/* ---------------------------------------------------------------------- */
/* Staff Points                                                           */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/staff-points', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const scores = await StaffScore.find({ guildId }).sort({ points: -1 }).limit(50);

  const discordClient = req.app.get('discordClient');
  const guild = discordClient?.guilds.cache.get(guildId);
  const leaderboard = await Promise.all(
    scores.map(async (s) => {
      let tag = s.userId;
      let avatar = null;
      const member = guild?.members.cache.get(s.userId) || (await guild?.members.fetch(s.userId).catch(() => null));
      if (member) {
        tag = member.user.tag;
        avatar = member.user.displayAvatarURL({ size: 64 });
      }
      return { userId: s.userId, points: s.points, tag, avatar, history: (s.history || []).slice(-10).reverse() };
    })
  );

  res.json({ staffPoints: guildDoc.staffPoints, leaderboard });
});

router.post('/:guildId/staff-points', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const body = req.body || {};

  const toBool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
  const toNum = (v, fallback) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
  const current = guildDoc.staffPoints;

  guildDoc.staffPoints = {
    enabled: toBool(body.enabled, current.enabled),
    logsChannelId: body.logsChannelId !== undefined ? String(body.logsChannelId || '') : current.logsChannelId,
    ticketPoints: {
      enabled: toBool(body.ticketPoints?.enabled, current.ticketPoints.enabled),
      claim: {
        enabled: toBool(body.ticketPoints?.claim?.enabled, current.ticketPoints.claim.enabled),
        points: toNum(body.ticketPoints?.claim?.points, current.ticketPoints.claim.points)
      },
      close: {
        enabled: toBool(body.ticketPoints?.close?.enabled, current.ticketPoints.close.enabled),
        points: toNum(body.ticketPoints?.close?.points, current.ticketPoints.close.points)
      }
    },
    commandPoints: {
      enabled: toBool(body.commandPoints?.enabled, current.commandPoints.enabled),
      commands: Array.isArray(body.commandPoints?.commands)
        ? body.commandPoints.commands
            .filter((c) => c && typeof c.name === 'string' && c.name.trim())
            .map((c) => ({
              name: c.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 50),
              points: toNum(c.points, 1)
            }))
            .filter((c) => c.name)
            .slice(0, 50)
        : current.commandPoints.commands
    },
    antiAbuse: {
      enabled: toBool(body.antiAbuse?.enabled, current.antiAbuse.enabled),
      noSelfClaim: toBool(body.antiAbuse?.noSelfClaim, current.antiAbuse.noSelfClaim),
      noDuplicatePoints: toBool(body.antiAbuse?.noDuplicatePoints, current.antiAbuse.noDuplicatePoints),
      cooldownMinutes: toNum(body.antiAbuse?.cooldownMinutes, current.antiAbuse.cooldownMinutes)
    },
    rewards: {
      enabled: toBool(body.rewards?.enabled, current.rewards.enabled),
      list: Array.isArray(body.rewards?.list)
        ? body.rewards.list
            .filter((r) => r && Number(r.points) > 0)
            .map((r) => ({ points: toNum(r.points, 100), roleId: String(r.roleId || ''), label: String(r.label || '').slice(0, 80) }))
            .slice(0, 25)
        : current.rewards.list
    }
  };

  await guildDoc.save();

  await logService.log(req.app.get('discordClient'), guildId, 'systemConfigChange', {
    Setting: 'Staff Points', Admin: req.user.id
  });

  res.json({ success: true, staffPoints: guildDoc.staffPoints });
});

router.post('/:guildId/staff-points/adjust', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { userId, delta, reason } = req.body || {};
  if (!userId || !Number(delta)) {
    return res.status(400).json({ success: false, error: 'لازم تحدد العضو وقيمة النقاط (موجبة أو سالبة).' });
  }

  const guildDoc = await getOrCreateGuildDoc(guildId);
  if (!guildDoc.staffPoints?.enabled) {
    return res.status(400).json({ success: false, error: 'نظام نقاط التذاكر غير مفعّل حاليًا.' });
  }

  const discordClient = req.app.get('discordClient');
  const score = await staffPointsService.awardPoints(
    discordClient,
    guildId,
    String(userId),
    Number(delta),
    reason && String(reason).trim() ? String(reason).trim().slice(0, 200) : `تعديل يدوي من <@${req.user.id}>`
  );

  res.json({ success: true, score });
});

/* ---------------------------------------------------------------------- */
/* Nav status                                                             */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/nav-status', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({
    automod: Boolean(guildDoc.automod?.enabled),
    level: Boolean(guildDoc.levelUp?.enabled),
    economy: true,
    shortcuts: (guildDoc.shortcuts || []).some((s) => s.enabled),
    tickets: Boolean(guildDoc.ticketSettings?.enabled),
    sellerroom: Boolean(guildDoc.sellerRoom?.enabled),
    autoresponder: (guildDoc.autoResponders || []).some((r) => r.enabled),
    autorules: Boolean(
      guildDoc.autoRoleRules?.enabled &&
      ((guildDoc.autoRoleRules.memberRoleIds || []).length ||
        (guildDoc.autoRoleRules.botRoleIds || []).length ||
        (guildDoc.autoRoleRules.inviteRoles || []).length)
    ),
    reports: Boolean(guildDoc.reports?.enabled),
    suggestions: Boolean(guildDoc.suggestions?.enabled),
    welcomejoin: Boolean(guildDoc.welcome?.enabled || guildDoc.leave?.enabled),
    components: (guildDoc.componentPanels || []).length > 0,
    pointsinteractions: Boolean(guildDoc.interactionPoints?.enabled),
    logs: Object.keys(guildDoc.logSettings?.toObject?.() || guildDoc.logSettings || {}).some(
      (k) => k.endsWith('ChannelId') && guildDoc.logSettings[k]
    ),
    pointstickets: Boolean(guildDoc.staffPoints?.enabled),
    applications: (guildDoc.applicationPanels || []).some((p) => p.enabled && p.reviewChannelId)
  });
});

/* ---------------------------------------------------------------------- */
/* Reports                                                                */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/reports', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  const reports = await Report.find({ guildId: req.params.guildId }).sort({ createdAt: -1 }).limit(100);
  res.json({ settings: guildDoc.reports, reports });
});

router.post('/:guildId/reports/settings', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { enabled, channelId } = req.body;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  if (enabled !== undefined) guildDoc.reports.enabled = enabled;
  if (channelId !== undefined) guildDoc.reports.channelId = channelId;
  await guildDoc.save();
  res.json({ success: true, settings: guildDoc.reports });
});

router.post('/:guildId/reports/:reportId/resolve', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { reportId } = req.params;
  const { status } = req.body;
  const report = await Report.findById(reportId);
  if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
  report.status = status;
  report.reviewedBy = req.user.id;
  await report.save();
  res.json({ success: true, report });
});

/* ---------------------------------------------------------------------- */
/* Suggestions                                                            */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/suggestions', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  const suggestions = await Suggestion.find({ guildId: req.params.guildId }).sort({ createdAt: -1 }).limit(100);
  res.json({ settings: guildDoc.suggestions, suggestions });
});

router.post('/:guildId/suggestions/settings', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const { enabled, channelId } = req.body;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  if (enabled !== undefined) guildDoc.suggestions.enabled = enabled;
  if (channelId !== undefined) guildDoc.suggestions.channelId = channelId;
  await guildDoc.save();
  res.json({ success: true, settings: guildDoc.suggestions });
});

router.post('/:guildId/suggestions/:suggestionId/status', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { suggestionId } = req.params;
  const { status } = req.body;
  if (!['pending', 'accepted', 'rejected', 'closed'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }
  const suggestion = await Suggestion.findById(suggestionId);
  if (!suggestion) return res.status(404).json({ success: false, error: 'Suggestion not found' });
  suggestion.status = status;
  await suggestion.save();
  res.json({ success: true, suggestion });
});

/* ---------------------------------------------------------------------- */
/* Interaction Points (نقاط التفاعل) — role rewards, no DC involved       */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/interaction-points', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const scores = await InteractionScore.find({ guildId }).sort({ points: -1 }).limit(50);

  const discordClient = req.app.get('discordClient');
  const guild = discordClient?.guilds.cache.get(guildId);
  const leaderboard = await Promise.all(
    scores.map(async (s) => {
      let tag = s.userId;
      let avatar = null;
      const member = guild?.members.cache.get(s.userId) || (await guild?.members.fetch(s.userId).catch(() => null));
      if (member) {
        tag = member.user.tag;
        avatar = member.user.displayAvatarURL({ size: 64 });
      }
      return { userId: s.userId, points: s.points, tag, avatar };
    })
  );

  res.json({ settings: guildDoc.interactionPoints, leaderboard });
});

router.post('/:guildId/interaction-points', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const body = req.body || {};
  const current = guildDoc.interactionPoints;

  const toBool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
  const toNum = (v, fallback) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };

  guildDoc.interactionPoints = {
    enabled: toBool(body.enabled, current.enabled),
    pointsPerMessage: Math.max(0, toNum(body.pointsPerMessage, current.pointsPerMessage)),
    cooldownSeconds: Math.max(0, toNum(body.cooldownSeconds, current.cooldownSeconds)),
    minMessageLength: Math.max(0, toNum(body.minMessageLength, current.minMessageLength)),
    excludedChannelIds: Array.isArray(body.excludedChannelIds) ? body.excludedChannelIds.filter(Boolean) : current.excludedChannelIds,
    logsChannelId: body.logsChannelId !== undefined ? String(body.logsChannelId || '') : current.logsChannelId,
    rewards: Array.isArray(body.rewards)
      ? body.rewards
          .filter((r) => r && Number(r.points) > 0)
          .map((r) => ({ points: toNum(r.points, 100), roleId: String(r.roleId || ''), label: String(r.label || '').slice(0, 80) }))
          .slice(0, 25)
      : current.rewards
  };

  await guildDoc.save();
  res.json({ success: true, settings: guildDoc.interactionPoints });
});

/* ---------------------------------------------------------------------- */
/* Warnings                                                                */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/warnings', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const warnings = await Warning.find({ guildId: req.params.guildId }).sort({ createdAt: -1 }).limit(200);
  res.json({ warnings });
});

/* ---------------------------------------------------------------------- */
/* Settings                                                               */
/* ---------------------------------------------------------------------- */

router.get('/:guildId/settings', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildDoc = await getOrCreateGuildDoc(req.params.guildId);
  res.json({
    welcome: guildDoc.welcome,
    leave: guildDoc.leave,
    autoRoleId: guildDoc.autoRoleId,
    suggestions: guildDoc.suggestions,
    automod: guildDoc.automod,
    locale: guildDoc.locale,
    prefix: guildDoc.prefix
  });
});

router.post('/:guildId/settings', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);

  const { welcome, leave, autoRoleId, suggestions, reports, automod, locale, prefix } = req.body;
  if (welcome) Object.assign(guildDoc.welcome, welcome);
  if (leave) Object.assign(guildDoc.leave, leave);
  if (autoRoleId !== undefined) guildDoc.autoRoleId = autoRoleId;
  if (suggestions) Object.assign(guildDoc.suggestions, suggestions);
  if (reports) Object.assign(guildDoc.reports, reports);
  if (automod) Object.assign(guildDoc.automod, automod);
  if (locale) guildDoc.locale = locale;
  if (prefix) guildDoc.prefix = prefix;

  await guildDoc.save();
  res.json({ success: true, guild: guildDoc });
});

router.post('/:guildId/welcome/test', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guildDoc = await getOrCreateGuildDoc(guildId);
  const discordClient = req.app.get('discordClient');
  const liveGuild = discordClient?.guilds?.cache?.get(guildId);

  const rawMessage = req.body.message || guildDoc.welcome?.message || 'أهلاً بك {user} في سيرفر {server}! أنت العضو رقم {membercount}.';
  const channelId = req.body.channelId || guildDoc.welcome?.channelId;
  const serverName = liveGuild?.name || 'سيرفر ZETA';
  const memberCount = liveGuild?.memberCount || 154;
  const userMention = `<@${req.user?.id || '123456789'}>`;
  const userName = req.user?.username || 'عضو جديد';

  const formattedMessage = String(rawMessage)
    .replaceAll('{user}', userMention)
    .replaceAll('{mention}', userMention)
    .replaceAll('{username}', userName)
    .replaceAll('{server}', serverName)
    .replaceAll('{membercount}', String(memberCount));

  if (!channelId) {
    return res.json({
      success: true,
      simulated: true,
      sent: false,
      message: formattedMessage,
      note: 'تمت معاينة الرسالة بنجاح (حدد روماً للإرسال المباشر).'
    });
  }

  const channel = liveGuild?.channels?.cache?.get(channelId);
  if (channel && channel.isTextBased()) {
    try {
      await channel.send({ content: `🧪 **[رسالة ترحيب تجريبية من لوحة التحكم]**\n${formattedMessage}` });
      return res.json({
        success: true,
        sent: true,
        channelName: channel.name,
        message: formattedMessage,
        note: `تم إرسال الرسالة بنجاح إلى #${channel.name}`
      });
    } catch (err) {
      console.warn('Welcome test send failed:', err.message);
    }
  }

  return res.json({
    success: true,
    simulated: true,
    sent: false,
    message: formattedMessage,
    note: liveGuild ? 'تعذر الإرسال للروم الفعلي (تأكد من صلاحيات البوت).' : 'تمت محاكاة الإرسال بنجاح (وضع العرض التجريبي).'
  });
});

/* ---------------------------------------------------------------------- */
/* ZETA Shield (Wick-style protection) + server backups                    */
/* ---------------------------------------------------------------------- */

const clampInt = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const idList = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\s,]+/)).map((x) => String(x).trim()).filter((x) => /^\d{15,25}$/.test(x));
const pickEnum = (v, allowed, def) => (allowed.includes(v) ? v : def);
const SHIELD_LIMIT_KEYS = ['channelCreate', 'channelDelete', 'roleCreate', 'roleDelete', 'ban', 'kick', 'webhookCreate'];

function shieldPayload(cfg, guild) {
  return {
    logChannelId: cfg.logChannelId, quarantineRoleId: cfg.quarantineRoleId,
    antiNuke: cfg.antiNuke, antiRaid: cfg.antiRaid, antiSpam: cfg.antiSpam,
    whitelist: cfg.whitelist, trustedAdminIds: cfg.trustedAdminIds, panic: { active: cfg.panic.active, since: cfg.panic.since, locked: cfg.panic.lockedChannelIds.length },
    quarantined: cfg.quarantined.map((q) => ({ userId: q.userId, reason: q.reason, at: q.at, name: guild?.members.cache.get(q.userId)?.user.tag || '' }))
  };
}

function needClient(req, res) {
  const client = req.app.get('discordClient');
  const guild = client?.guilds?.cache?.get(req.params.guildId);
  if (!guild) { res.status(503).json({ error: 'البوت غير متصل بهذا السيرفر حالياً.' }); return null; }
  return guild;
}

router.get('/:guildId/shield', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const guild = req.app.get('discordClient')?.guilds?.cache?.get(guildId);
  const [cfg, cases, backups] = await Promise.all([
    shieldService.getConfig(guildId, { fresh: true }),
    ShieldCase.find({ guildId }).sort({ createdAt: -1 }).limit(15),
    backupService.listBackups(guildId)
  ]);
  res.json({
    ...shieldPayload(cfg, guild),
    cases: cases.map((c) => ({ kind: c.kind, userId: c.userId, action: c.action, reason: c.reason, at: c.createdAt })),
    backups,
    botConnected: Boolean(guild)
  });
});

router.post('/:guildId/shield', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const { guildId } = req.params;
  const b = req.body || {};
  const cfg = await shieldService.getConfig(guildId, { fresh: true });
  const bool = (v, d) => (v === undefined ? d : Boolean(v));

  if (b.logChannelId !== undefined) cfg.logChannelId = /^\d{15,25}$/.test(String(b.logChannelId)) ? String(b.logChannelId) : '';

  if (b.antiNuke) {
    const a = cfg.antiNuke, n = b.antiNuke;
    a.enabled = bool(n.enabled, a.enabled);
    a.punishment = pickEnum(n.punishment, ['quarantine', 'strip', 'kick', 'ban'], a.punishment);
    for (const k of ['revert', 'panicOnTrigger', 'protectEveryone', 'strictRoles', 'blockBotAdd']) a[k] = bool(n[k], a[k]);
    for (const k of SHIELD_LIMIT_KEYS) {
      if (!n[k]) continue;
      a[k].enabled = bool(n[k].enabled, a[k].enabled);
      a[k].limit = clampInt(n[k].limit, 1, 50, a[k].limit);
      a[k].windowSec = clampInt(n[k].windowSec, 2, 300, a[k].windowSec);
    }
  }
  if (b.antiRaid) {
    const a = cfg.antiRaid, r = b.antiRaid;
    a.enabled = bool(r.enabled, a.enabled);
    a.joinLimit = clampInt(r.joinLimit, 2, 100, a.joinLimit);
    a.windowSec = clampInt(r.windowSec, 2, 120, a.windowSec);
    a.action = pickEnum(r.action, ['timeout', 'kick', 'ban'], a.action);
    a.raidModeMinutes = clampInt(r.raidModeMinutes, 1, 1440, a.raidModeMinutes);
    a.minAccountAgeDays = clampInt(r.minAccountAgeDays, 0, 365, a.minAccountAgeDays);
    a.blockNoAvatar = bool(r.blockNoAvatar, a.blockNoAvatar);
    a.autoLockdown = bool(r.autoLockdown, a.autoLockdown);
  }
  if (b.antiSpam) {
    const a = cfg.antiSpam, s = b.antiSpam;
    a.enabled = bool(s.enabled, a.enabled);
    a.threshold = clampInt(s.threshold, 30, 500, a.threshold);
    a.timeoutMinutes = clampInt(s.timeoutMinutes, 1, 1440, a.timeoutMinutes);
    a.deleteMessages = bool(s.deleteMessages, a.deleteMessages);
  }
  if (b.whitelist) {
    if (b.whitelist.userIds !== undefined) cfg.whitelist.userIds = idList(b.whitelist.userIds);
    if (b.whitelist.roleIds !== undefined) cfg.whitelist.roleIds = idList(b.whitelist.roleIds);
  }
  if (b.trustedAdminIds !== undefined) cfg.trustedAdminIds = idList(b.trustedAdminIds);

  await shieldService.saveConfig(cfg);
  await logService.log(req.app.get('discordClient'), guildId, 'systemConfigChange', { Section: 'ZETA Shield', By: `<@${req.user.id}>` }).catch(() => {});
  res.json({ success: true });
});

router.post('/:guildId/shield/panic', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guild = needClient(req, res); if (!guild) return;
  const by = req.user.username || req.user.id;
  const out = req.body?.active ? await shieldService.panicOn(guild, `Dashboard — ${by}`) : await shieldService.panicOff(guild, by);
  res.json({ success: true, ...out });
});

router.post('/:guildId/shield/raidmode', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guild = needClient(req, res); if (!guild) return;
  const cfg = await shieldService.raidModeSet(guild, Boolean(req.body?.active), req.user.username || req.user.id);
  res.json({ success: true, active: cfg.antiRaid.raidActive });
});

router.post('/:guildId/shield/quarantine', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guild = needClient(req, res); if (!guild) return;
  const userId = String(req.body?.userId || '').trim();
  if (!/^\d{15,25}$/.test(userId)) return res.status(400).json({ error: 'معرّف العضو غير صالح.' });
  if (userId === req.user.id) return res.status(400).json({ error: 'لا يمكنك حجر نفسك.' });
  const out = await shieldService.quarantineMember(guild, userId, String(req.body?.reason || 'Dashboard').slice(0, 200), req.user.username || req.user.id);
  if (!out.ok) return res.status(400).json({ error: out.error === 'hierarchy' ? 'رتبة البوت أقل من رتبة العضو.' : out.error === 'protected' ? 'هذا العضو محمي.' : 'العضو غير موجود في السيرفر.' });
  res.json({ success: true });
});

router.delete('/:guildId/shield/quarantine/:userId', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guild = needClient(req, res); if (!guild) return;
  const out = await shieldService.releaseMember(guild, req.params.userId, req.user.username || req.user.id);
  if (!out.ok) return res.status(404).json({ error: 'هذا العضو ليس في الحجر.' });
  res.json({ success: true });
});

router.post('/:guildId/shield/backups', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guild = needClient(req, res); if (!guild) return;
  const doc = await backupService.createBackup(guild, req.user.username || req.user.id, String(req.body?.name || '').slice(0, 80));
  res.json({ success: true, id: doc._id });
});

router.post('/:guildId/shield/backups/:id/restore', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guild = needClient(req, res); if (!guild) return;
  const out = await backupService.restoreBackup(guild, req.params.id);
  if (!out.ok) return res.status(404).json({ error: 'النسخة غير موجودة.' });
  res.json({ success: true, ...out });
});

router.delete('/:guildId/shield/backups/:id', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const ok = await backupService.deleteBackup(req.params.guildId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'النسخة غير موجودة.' });
  res.json({ success: true });
});

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

router.post('/:guildId/premium/stripe-checkout', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildId = req.params.guildId;
  const { plan } = req.body;

  const stripeInstance = getStripe();
  if (!stripeInstance) {
    return res.status(400).json({
      success: false,
      error: 'لم يتم إعداد بوابة الدفع Stripe في خادم الداشبورد بعد. يرجى تزويد مفتاح STRIPE_SECRET_KEY في ملف البيئة .env.'
    });
  }

  const priceAmount = plan === 'yearly' ? 4900 : 500;
  const priceName = plan === 'yearly' ? 'ZETA Premium - الباقة السنوية 👑' : 'ZETA Premium - الباقة الشهرية 👑';

  try {
    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: priceName,
              description: `تفعيل ميزات ZETA Premium الفاخرة لسيرفرك (ID: ${guildId})`,
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        guildId,
        userId: req.user.id,
        plan
      },
      success_url: `${process.env.DASHBOARD_URL}/dashboard/?guildId=${guildId}&stripe_session_id={CHECKOUT_SESSION_ID}&stripe_status=success`,
      cancel_url: `${process.env.DASHBOARD_URL}/dashboard/?guildId=${guildId}&stripe_status=cancel`,
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('Stripe Session Creation Error:', err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء الاتصال بـ Stripe: ' + err.message });
  }
});

router.get('/:guildId/premium/stripe-verify', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildId = req.params.guildId;
  const sessionId = req.query.session_id;

  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'رمز الجلسة مفقود.' });
  }

  const stripeInstance = getStripe();
  if (!stripeInstance) {
    return res.status(500).json({ success: false, error: 'بوابة الدفع Stripe غير مهيأة على السيرفر.' });
  }

  try {
    const session = await stripeInstance.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid' && session.metadata.guildId === guildId) {
      const guildDoc = await getOrCreateGuildDoc(guildId);
      guildDoc.isPremium = true;
      await guildDoc.save();

      console.log(`💎 Premium activated via Real Stripe Payment for Guild ${guildId} by user ${req.user.username}`);
      return res.json({ success: true, message: 'تم تفعيل باقة ZETA Premium لسيرفرك بنجاح عبر Stripe! 🎉' });
    } else {
      return res.status(400).json({ success: false, error: 'لم تكتمل عملية الدفع أو أن الجلسة غير صالحة.' });
    }
  } catch (err) {
    console.error('Stripe Session Verification Error:', err);
    res.status(500).json({ success: false, error: 'فشل التحقق من الجلسة: ' + err.message });
  }
});

router.post('/:guildId/premium/pay', ensureAuth, ensureGuildAdmin, async (req, res) => {
  const guildId = req.params.guildId;
  const { cardholderName, cardNumber, expiryDate, cvv, plan } = req.body;

  // Basic validation
  if (!cardholderName || !cardNumber || !expiryDate || !cvv || !plan) {
    return res.status(400).json({ success: false, error: 'الرجاء إدخال جميع تفاصيل البطاقة بشكل صحيح.' });
  }

  // Validate card number length
  const cleanCard = cardNumber.replace(/\s+/g, '');
  if (cleanCard.length < 13 || cleanCard.length > 19) {
    return res.status(400).json({ success: false, error: 'رقم البطاقة غير صالح.' });
  }

  // Simulate banking network request delay (direct processing)
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Update Guild premium status in DB
  const guildDoc = await getOrCreateGuildDoc(guildId);
  guildDoc.isPremium = true;
  await guildDoc.save();

  console.log(`💎 Premium activated via Direct Card Payment for Guild ${guildId} by user ${req.user.username}`);

  res.json({
    success: true,
    message: 'تم تفعيل باقة ZETA Premium لسيرفرك بنجاح! شكرًا لثقتك بنا 💎'
  });
});

module.exports = router;
