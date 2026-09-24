const express = require('express');
const router = require('../asyncRouter')(express.Router());
const voteService = require('../../src/services/voteService');

/**
 * Vote webhook — configure this URL on your bot's top.gg page under
 * "Webhooks": {DASHBOARD_URL}/webhooks/vote
 * (Also works for Voite.gg or any provider that can send a custom JSON payload.)
 *
 * top.gg sends (bot-wide, no server/guild info):
 * {
 *   "bot": "1535599195145240588",
 *   "user": "...",         // the voter's Discord user ID
 *   "type": "upvote" | "test",
 *   "isWeekend": false,
 *   "query": ""
 * }
 * Since top.gg has no concept of "which server", we fall back to MAIN_GUILD_ID
 * (set it in .env) to know which server's Vote Reward amount to use.
 *
 * Custom/other providers can instead send:
 * {
 *   "guildId": "...",
 *   "userId": "...",
 *   "voteId": "...",       // unique ID for this vote, used for dedup
 *   "provider": "voite.gg"
 * }
 *
 * Security: set VOTE_WEBHOOK_SECRET here AND as the "Authorization" value on
 * top.gg's webhook settings page (or the equivalent header on other providers).
 */
router.post('/vote', async (req, res) => {
  const providedKey = req.headers['authorization'] || req.headers['x-webhook-secret'];
  if (process.env.VOTE_WEBHOOK_SECRET && providedKey !== process.env.VOTE_WEBHOOK_SECRET) {
    return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
  }

  try {
    const body = req.body || {};

    // top.gg native payload: { bot, user, type, isWeekend, query }
    const isTopgg = typeof body.user === 'string' && typeof body.guildId === 'undefined';

    const guildId = isTopgg ? process.env.MAIN_GUILD_ID : body.guildId;
    const userId = isTopgg ? body.user : body.userId;
    const voteId = isTopgg ? `topgg_${body.user}_${Date.now()}` : body.voteId;
    const provider = isTopgg ? 'top.gg' : (body.provider || 'unknown');

    if (isTopgg && !guildId) {
      return res.status(500).json({
        success: false,
        error: 'MAIN_GUILD_ID is not set in .env — cannot determine which server\'s vote reward to use for a top.gg vote.'
      });
    }
    if (isTopgg && body.type === 'test') {
      // top.gg's "test" button on the webhook settings page — acknowledge without rewarding.
      return res.json({ success: true, test: true });
    }

    const result = await voteService.handleIncomingVote({ guildId, userId, voteId, provider });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
