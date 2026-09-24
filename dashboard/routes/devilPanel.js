const express = require('express');
const router = require('../asyncRouter')(express.Router());
const { ensureAuth, ensureDevilRole } = require('../middleware');

const Wallet = require('../../src/models/Wallet');
const BotGuild = require('../../src/models/BotGuild');
const economyService = require('../../src/services/economyService');
const guildBlockService = require('../../src/services/guildBlockService');
const logService = require('../../src/services/logService');

/**
 * ZetaBot Panel — hidden global economy super-controls (block a server, zero/adjust any
 * wallet, blacklist a sender from transferring). Every route here is gated on
 * ensureAuth + ensureDevilRole, which checks live Discord role membership in
 * DEVIL_PANEL_GUILD_ID (see dashboard/middleware.js#ensureDevilRole) — there is no
 * client-supplied secret anywhere in this flow, the check always happens fresh on the
 * server against the bot's own guild cache. Every action is logged both to the
 * Transaction/Guild log channels (logService) and console, with the acting admin's ID
 * attached, so there's always a record of who did what.
 */

router.use(ensureAuth, ensureDevilRole);

// Simple reachability check the front-end uses to decide whether to render the panel
// (real enforcement is the ensureDevilRole above, this is just UX so a non-authorized
// person who somehow lands on the page sees a clean "no access" state, not a broken UI).
router.get('/access', (req, res) => {
  res.json({ access: true, adminId: req.user.id });
});

router.get('/emojis', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    if (!client?.application?.emojis) return res.json({ emojis: [] });
    const emojis = await client.application.emojis.fetch();
    res.json({ emojis: emojis.map(e => ({
      id: e.id,
      name: e.name,
      animated: Boolean(e.animated),
      url: e.imageURL({ extension: e.animated ? 'gif' : 'png', size: 128 }),
      tag: e.toString()
    })) });
  } catch (err) {
    console.error('Devil application emoji list error:', err);
    res.status(500).json({ success: false, error: 'تعذر جلب إيموجيات البوت.' });
  }
});

router.post('/emojis', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const image = String(req.body?.image || '').trim();
  if (!/^[A-Za-z0-9_]{2,32}$/.test(name)) {
    return res.status(400).json({ success: false, error: 'اسم الإيموجي يجب أن يكون 2–32 حرفًا إنجليزيًا/رقمًا أو _.' });
  }
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(image) && !/^https?:\/\//i.test(image)) {
    return res.status(400).json({ success: false, error: 'أرسل صورة PNG/JPG/WEBP/GIF أو رابط صورة مباشر.' });
  }
  try {
    const client = req.app.get('discordClient');
    if (!client?.application?.emojis) throw new Error('مدير إيموجيات التطبيق غير متاح.');
    const existing = await client.application.emojis.fetch();
    if (existing.some(e => e.name === name)) return res.status(409).json({ success: false, error: 'يوجد إيموجي بهذا الاسم بالفعل.' });
    const emoji = await client.application.emojis.create({
      attachment: image,
      name,
      reason: `Devil Panel — created by ${req.user.id}`
    });
    res.json({ success: true, emoji: { id: emoji.id, name: emoji.name, animated: Boolean(emoji.animated), url: emoji.imageURL({ extension: emoji.animated ? 'gif' : 'png', size: 128 }), tag: emoji.toString() } });
  } catch (err) {
    console.error('Devil application emoji create error:', err);
    const raw = String(err?.message || '');
    const error = /Maximum number|30008/i.test(raw) ? 'وصل البوت للحد الأقصى من الإيموجيات.'
      : /Missing Permissions|50013/i.test(raw) ? 'البوت لا يملك صلاحية إدارة الإيموجيات.'
      : 'تعذر إنشاء الإيموجي. تأكد من الصورة والصلاحيات.';
    res.status(400).json({ success: false, error });
  }
});

router.delete('/emojis/:emojiId', async (req, res) => {
  try {
    const client = req.app.get('discordClient');
    if (!client?.application?.emojis) throw new Error('مدير إيموجيات التطبيق غير متاح.');
    const emoji = await client.application.emojis.fetch(req.params.emojiId);
    if (!emoji) return res.status(404).json({ success: false, error: 'الإيموجي غير موجود.' });
    await emoji.delete(`Devil Panel — deleted by ${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Devil application emoji delete error:', err);
    res.status(400).json({ success: false, error: 'تعذر حذف الإيموجي.' });
  }
});

/* ---------------------------------------------------------------------- */
/* Server blocking                                                         */
/* ---------------------------------------------------------------------- */

router.get('/servers/blocked', async (req, res) => {
  const blocked = await guildBlockService.listBlocked();
  res.json({ blocked });
});

router.post('/servers/block', async (req, res) => {
  const { guildId, reason } = req.body;
  if (!guildId) return res.status(400).json({ success: false, error: 'guildId is required.' });

  await guildBlockService.block(guildId, reason || '', req.user.id);
  await guildBlockService.leaveGuildIfPresent(req.app.get('discordClient'), guildId);

  await logService.log(req.app.get('discordClient'), process.env.DEVIL_PANEL_GUILD_ID, 'devilGuildBlocked', {
    Server: guildId,
    Reason: reason || '—',
    Admin: req.user.id
  });
  console.log(`💀 ZetaBot Panel: guild ${guildId} blocked by ${req.user.id} (${reason || 'no reason given'})`);

  res.json({ success: true });
});

router.post('/servers/unblock', async (req, res) => {
  const { guildId } = req.body;
  if (!guildId) return res.status(400).json({ success: false, error: 'guildId is required.' });

  await guildBlockService.unblock(guildId);

  await logService.log(req.app.get('discordClient'), process.env.DEVIL_PANEL_GUILD_ID, 'devilGuildUnblocked', {
    Server: guildId,
    Admin: req.user.id
  });
  console.log(`💀 ZetaBot Panel: guild ${guildId} unblocked by ${req.user.id}`);

  res.json({ success: true });
});

/* ---------------------------------------------------------------------- */
/* Wallet lookup / balance controls / blacklist                            */
/* ---------------------------------------------------------------------- */

router.get('/users/:userId', async (req, res) => {
  const wallet = await economyService.getOrCreateWallet(req.params.userId);
  res.json({ wallet });
});

router.post('/users/:userId/adjust', async (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;

  try {
    const wallet = await economyService.adminAdjust(process.env.DEVIL_PANEL_GUILD_ID, userId, Number(amount), req.user.id);
    await logService.log(req.app.get('discordClient'), process.env.DEVIL_PANEL_GUILD_ID, 'adminEconomyChange', {
      User: userId,
      Amount: amount,
      Admin: req.user.id
    });
    console.log(`💀 ZetaBot Panel: ${req.user.id} adjusted ${userId}'s balance by ${amount}`);
    res.json({ success: true, balance: wallet.balance });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/users/:userId/zero', async (req, res) => {
  const { userId } = req.params;

  const wallet = await economyService.adminZeroBalance(userId, req.user.id, process.env.DEVIL_PANEL_GUILD_ID);
  await logService.log(req.app.get('discordClient'), process.env.DEVIL_PANEL_GUILD_ID, 'devilBalanceZeroed', {
    User: userId,
    Admin: req.user.id
  });
  console.log(`💀 ZetaBot Panel: ${req.user.id} zeroed ${userId}'s balance`);

  res.json({ success: true, balance: wallet.balance });
});

router.post('/users/:userId/blacklist', async (req, res) => {
  const { userId } = req.params;
  const { blacklisted, reason } = req.body;

  const wallet = await economyService.setBlacklist(userId, Boolean(blacklisted), { reason, adminUserId: req.user.id });
  await logService.log(req.app.get('discordClient'), process.env.DEVIL_PANEL_GUILD_ID, 'devilBlacklistChange', {
    User: userId,
    Blacklisted: blacklisted ? 'Yes' : 'No',
    Reason: reason || '—',
    Admin: req.user.id
  });
  console.log(`💀 ZetaBot Panel: ${req.user.id} set blacklisted=${Boolean(blacklisted)} for ${userId}`);

  res.json({ success: true, wallet });
});

module.exports = router;
