const Vote = require('../models/Vote');
const economyService = require('./economyService');

/**
 * voteService — isolated so the vote provider (top.gg, Voite.gg, etc.) can be swapped
 * later without touching commands or economy logic.
 *
 * Flow:
 *  1. Provider sends a webhook (see dashboard/routes/webhooks.js, route: /webhooks/vote)
 *     with { guildId, userId, voteId, provider }.
 *  2. handleIncomingVote() dedupes on voteId (unique index) and only then rewards VC.
 *  3. /vote command itself NEVER grants VC — it only shows the vote link/button.
 */

const VOTE_URL = process.env.VOTE_URL || 'https://top.gg/bot/1535599195145240588';

function getVoteUrl() {
  return VOTE_URL;
}

/**
 * Call this from the webhook handler once a real vote is confirmed by the provider.
 * Returns { rewarded: boolean, amount?, balance? }
 */
async function handleIncomingVote({ guildId, userId, voteId, provider = 'top.gg' }) {
  if (!guildId || !userId || !voteId) {
    throw new Error('INVALID_VOTE_PAYLOAD');
  }

  const existing = await Vote.findOne({ voteId });
  if (existing) {
    return { rewarded: false, reason: 'DUPLICATE_VOTE' };
  }

  await Vote.create({ guildId, userId, voteId, provider, rewarded: true });
  const result = await economyService.rewardVote(guildId, userId);

  return { rewarded: true, amount: result.amount, balance: result.balance };
}

async function getLastVote(guildId, userId) {
  return Vote.findOne({ guildId, userId }).sort({ createdAt: -1 });
}

module.exports = { getVoteUrl, handleIncomingVote, getLastVote };
