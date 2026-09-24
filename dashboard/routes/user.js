const express = require('express');
const router = require('../asyncRouter')(express.Router());
const { PermissionsBitField } = require('discord.js');
const { ensureAuth } = require('../middleware');
const BotGuild = require('../../src/models/BotGuild');
const User = require('../../src/models/User');
const Wallet = require('../../src/models/Wallet');
const Transaction = require('../../src/models/Transaction');
const voteService = require('../../src/services/voteService');

/**
 * GET /user/public-config — the handful of values the public marketing landing
 * page (dashboard/public/landing.html, served at "/") needs before anyone has
 * logged in: the bot's invite link and the support server link. No ensureAuth —
 * this is meant to be readable by a logged-out visitor.
 */
router.get('/public-config', (req, res) => {
  const inviteLink =
    process.env.INVITE_LINK ||
    'https://discord.com/oauth2/authorize?client_id=1544990088256159777&permissions=8&integration_type=0&scope=bot';
  res.json({ inviteLink, supportLink: 'https://discord.gg/m8c2mUEMj' });
});

/**
 * GET /user/me — the logged-in Discord user's basic info (for the profile header).
 * Also reports `isOwner` (matches OWNER_ID in .env) so the dashboard frontend can
 * hide bot-owner-only sections (e.g. the manual DC balance adjustment panel) from
 * everyone else — the actual enforcement still lives server-side in
 * dashboard/middleware.js#ensureBotOwner; this is just so the UI doesn't even show
 * a button that would 403 for a regular server admin.
 */
router.get('/me', ensureAuth, (req, res) => {
  const avatar = req.user.avatar
    ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${Number(req.user.discriminator || 0) % 5}.png`;

  const isOwner = Boolean(process.env.OWNER_ID) && req.user.id === process.env.OWNER_ID;

  res.json({ id: req.user.id, username: req.user.username, avatar, isOwner });
});

/**
 * GET /user/servers — servers the logged-in user can manage (Owner / Administrator /
 * Manage Guild) that ALSO actually have ZETA installed. This is what was missing
 * before: previously there was no way to discover which servers to manage at all.
 */
router.get('/servers', ensureAuth, async (req, res) => {
  const userGuilds = req.user.guilds || [];
  const botGuilds = await BotGuild.find({});
  const botGuildMap = new Map(botGuilds.map((g) => [g.guildId, g]));

  // Show every server where the logged-in user can manage the server, even when
  // ZETA is NOT installed there yet. This lets the dashboard act as a server
  // picker first, with an "إضافة البوت" action for missing installations.
  const manageable = userGuilds
    .filter((g) => {
      if (g.owner) return true;
      const perms = new PermissionsBitField(BigInt(g.permissions || 0));
      return perms.has(PermissionsBitField.Flags.Administrator) || perms.has(PermissionsBitField.Flags.ManageGuild);
    })
    .map((g) => {
      const botInfo = botGuildMap.get(g.id);
      const installed = Boolean(botInfo);
      return {
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
          : botInfo?.icon || null,
        owner: g.owner,
        installed,
        memberCount: botInfo?.memberCount ?? null
      };
    });

  res.json({
    servers: manageable,
    installedCount: manageable.filter((g) => g.installed).length,
    botNotAddedCount: manageable.filter((g) => !g.installed).length,
    clientId: process.env.CLIENT_ID
  });
});

/**
 * GET /user/profile — the logged-in user's global DC wallet (one balance, shared
 * across every server) plus their per-server activity stats (XP/level/messages,
 * which stay separate per server on purpose), for servers where the bot is actually
 * installed. Previously this looped over every server the person is in on Discord
 * and silently created a database record for each one, even servers ZETA was
 * never added to — now it's a read-only lookup.
 */
router.get('/profile', ensureAuth, async (req, res) => {
  const userGuilds = req.user.guilds || [];
  const botGuilds = await BotGuild.find({});
  const botGuildIds = new Set(botGuilds.map((g) => g.guildId));
  const sharedGuilds = userGuilds.filter((g) => botGuildIds.has(g.id));

  // One global wallet — read-only lookup, don't create one just because the
  // dashboard was opened.
  const wallet = await Wallet.findOne({ userId: req.user.id });

  const activityProfiles = [];
  for (const g of sharedGuilds) {
    const user = await User.findOne({ guildId: g.id, userId: req.user.id });
    if (!user) continue; // no activity data yet in this server

    const rank = user.xp > 0
      ? (await User.countDocuments({ guildId: g.id, xp: { $gt: user.xp } })) + 1
      : null;

    activityProfiles.push({
      guildId: g.id,
      guildName: g.name,
      level: user.level,
      xp: user.xp,
      messages: user.messages,
      rank
    });
  }

  res.json({
    discordUser: { id: req.user.id, username: req.user.username, avatar: req.user.avatar },
    voteUrl: voteService.getVoteUrl(),
    wallet: { balance: wallet?.balance ?? 0, streak: wallet?.streak ?? 0, profileBackground: wallet?.profileBackground ?? '' },
    activityProfiles
  });
});

/**
 * GET /user/transactions — the logged-in user's own currency log: their most recent
 * DC movements, both received (toUserId = them) and sent (fromUserId = them), newest
 * first. This is what replaced the old per-guild "Economy" settings tab in the
 * dashboard nav — DC is a global wallet, so this is scoped to the person, not a
 * server. Read-only, no ensureGuildAdmin needed (just needs to be logged in).
 */
router.get('/transactions', ensureAuth, async (req, res) => {
  const userId = req.user.id;
  const transactions = await Transaction.find({ $or: [{ fromUserId: userId }, { toUserId: userId }] })
    .sort({ createdAt: -1 })
    .limit(50);

  const items = transactions.map((tx) => ({
    id: tx._id,
    direction: tx.toUserId === userId ? 'received' : 'sent',
    counterpartyId: tx.toUserId === userId ? tx.fromUserId : tx.toUserId,
    amount: tx.amount,
    type: tx.type,
    guildId: tx.guildId,
    createdAt: tx.createdAt
  }));

  res.json({ transactions: items });
});

/**
 * POST /user/profile-background — lets the logged-in user set (or clear, by
 * sending an empty string) the custom background image used on their /profile
 * rank card (src/utils/profileCard.js). Global, like the rest of the wallet —
 * one background per person, shown on every server. No ensureGuildAdmin needed,
 * this only ever touches the caller's own wallet (req.user.id), never a param.
 */
router.post('/profile-background', ensureAuth, async (req, res) => {
  const { backgroundImage } = req.body;
  if (typeof backgroundImage !== 'string') {
    return res.status(400).json({ success: false, error: 'صيغة غير صحيحة.' });
  }

  await Wallet.findOneAndUpdate(
    { userId: req.user.id },
    { $setOnInsert: { userId: req.user.id }, $set: { profileBackground: backgroundImage } },
    { upsert: true }
  );

  res.json({ success: true, backgroundImage });
});

module.exports = router;
