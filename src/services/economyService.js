const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const GuildModel = require('../models/Guild');

/**
 * economyService — the ONLY module allowed to mutate VC balances.
 *
 * VC (ZetaBot Coins) is a GLOBAL currency: one Wallet per Discord user, shared across
 * every server. `guildId` still shows up in several function signatures below, but
 * only to (a) look up that server's configured rates (Daily Base Reward, Streak
 * Bonus, Vote Reward, Transfer Tax — each server can still tune its own numbers) and
 * (b) tag the Transaction log with which server the action happened in. It is never
 * used to partition balances anymore.
 *
 * Every balance change goes through an atomic MongoDB update + a Transaction record.
 * Sources of VC: /daily, /vote. Movement: /wallet user:@x amount:y. Corrections: admin.
 */

/**
 * Atomic upsert — a plain find-then-create has a race window (two commands from the
 * same new user firing almost simultaneously can both see "no wallet" and both try to
 * create one, and the second create() throws a duplicate-key error). findOneAndUpdate
 * with upsert:true is atomic at the MongoDB level, so this race can't happen here.
 */
async function getOrCreateWallet(userId) {
  return Wallet.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function getGuildSettings(guildId) {
  let g = await GuildModel.findOne({ guildId });
  if (!g) g = await GuildModel.create({ guildId });
  return g;
}

/**
 * Atomically credit VC to a user's global wallet (never goes negative because credits
 * only add). `guildId` here is only for the Transaction log context.
 */
async function credit(userId, amount, type, { fromUserId = null, guildId = null } = {}) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { balance: amount }, $setOnInsert: { userId } },
    { upsert: true, new: true }
  );
  await Transaction.create({ guildId, fromUserId, toUserId: userId, amount, type });
  return wallet;
}

/**
 * Atomically debit VC from a user's global wallet. Uses a conditional update so
 * balance can never go negative even under concurrent requests.
 */
async function debit(userId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  const wallet = await Wallet.findOneAndUpdate(
    { userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );
  if (!wallet) {
    throw new Error('INSUFFICIENT_FUNDS');
  }
  return wallet;
}

/**
 * Transfer VC from one real user's global wallet to another's. Validates
 * self-transfer, bot-transfer (caller must pass isBotTarget), non-positive amounts,
 * and sufficient balance.
 *
 * A transfer tax (Guild.transferTaxPercent, default 2.5% — looked up from whichever
 * server the /credit command was run in) is deducted from the amount the recipient
 * actually receives — the sender is still debited the full amount they entered, and
 * the tax portion is removed from circulation (not paid to anyone). Returns
 * { grossAmount, taxAmount, netAmount }.
 */
async function transfer(guildId, fromUserId, toUserId, amount, { isBotTarget = false } = {}) {
  if (fromUserId === toUserId) throw new Error('SELF_TRANSFER');
  if (isBotTarget) throw new Error('BOT_TRANSFER');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');

  // Sender-side blacklist (set from the ZetaBot Panel) — blocked accounts can still
  // receive VC, they just can't send it out. Checked here so every transfer path
  // (slash command + prefix shortcut, both go through this function) is covered.
  const senderWallet = await getOrCreateWallet(fromUserId);
  if (senderWallet.blacklisted) throw new Error('SENDER_BLACKLISTED');

  const settings = await getGuildSettings(guildId);
  const taxPercent = Number.isFinite(settings.transferTaxPercent) ? settings.transferTaxPercent : 0;
  const taxAmount = Math.floor(amount * (taxPercent / 100));
  const netAmount = amount - taxAmount;

  await debit(fromUserId, amount);
  await credit(toUserId, netAmount, 'transfer', { fromUserId, guildId });

  return { grossAmount: amount, taxAmount, netAmount };
}

/**
 * Claim daily reward. There is one global streak per person (claimable from any
 * server), but the reward amount uses whichever server's configured Daily Base
 * Reward / Streak Bonus you claimed in. Returns { amount, streak, balance } or throws
 * 'ALREADY_CLAIMED' with `nextAvailableAt` attached.
 */
async function claimDaily(guildId, userId) {
  const settings = await getGuildSettings(guildId);
  const wallet = await getOrCreateWallet(userId);

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  if (wallet.lastDaily && now - new Date(wallet.lastDaily).getTime() < DAY_MS) {
    const err = new Error('ALREADY_CLAIMED');
    err.nextAvailableAt = new Date(wallet.lastDaily).getTime() + DAY_MS;
    throw err;
  }

  const brokeStreak = !wallet.lastDaily || now - new Date(wallet.lastDaily).getTime() > DAY_MS * 2;
  const newStreak = brokeStreak ? 1 : wallet.streak + 1;

  const reward = settings.dailyBaseReward + Math.max(0, newStreak - 1) * settings.streakBonus;

  const updated = await Wallet.findOneAndUpdate(
    { userId },
    { $set: { streak: newStreak, lastDaily: new Date(now) }, $inc: { balance: reward } },
    { new: true }
  );
  await Transaction.create({ guildId, fromUserId: null, toUserId: userId, amount: reward, type: 'daily' });

  return { amount: reward, streak: newStreak, balance: updated.balance };
}

/**
 * Claim the weekly staff salary. Fixed amount (STAFF_SALARY_AMOUNT env, default
 * 200,000 VC), once every 7 days per person, global cooldown like /daily. Role-gating
 * (who is even allowed to run this) happens in the command itself, not here.
 * Returns { amount, balance } or throws 'ALREADY_CLAIMED' with `nextAvailableAt`.
 */
async function claimSalary(guildId, userId) {
  const wallet = await getOrCreateWallet(userId);

  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const amount = Number(process.env.STAFF_SALARY_AMOUNT) || 200000;

  if (wallet.lastSalary && now - new Date(wallet.lastSalary).getTime() < WEEK_MS) {
    const err = new Error('ALREADY_CLAIMED');
    err.nextAvailableAt = new Date(wallet.lastSalary).getTime() + WEEK_MS;
    throw err;
  }

  const updated = await Wallet.findOneAndUpdate(
    { userId },
    { $set: { lastSalary: new Date(now) }, $inc: { balance: amount } },
    { new: true }
  );
  await Transaction.create({ guildId, fromUserId: null, toUserId: userId, amount, type: 'salary' });

  return { amount, balance: updated.balance };
}

/**
 * Reward a confirmed vote. Dedup is enforced by the unique voteId in the Vote model —
 * callers (voteService) must have already checked/created the Vote record before calling this.
 */
async function rewardVote(guildId, userId) {
  const settings = await getGuildSettings(guildId);
  const updated = await credit(userId, settings.voteReward, 'vote', { guildId });
  // lastVote/voteReminded weren't being written anywhere before, which meant the
  // vote-reminder system (src/systems/voteReminder.js) had nothing to work off of.
  // Set here so both that and any future "last voted X ago" display work correctly.
  await Wallet.findOneAndUpdate({ userId }, { lastVote: Date.now(), voteReminded: false });
  return { amount: settings.voteReward, balance: updated.balance };
}

/**
 * Admin-driven balance correction (grant or deduct) on a user's global wallet, always
 * logged as type 'admin'. VC is a global/shared currency, so this is intentionally
 * powerful — callers MUST restrict who can invoke it to the bot owner only (see
 * dashboard/middleware.js#ensureBotOwner), never just "an admin in some server".
 */
async function adminAdjust(guildId, userId, amount, adminUserId) {
  if (!Number.isFinite(amount) || amount === 0) throw new Error('INVALID_AMOUNT');
  if (amount > 0) {
    return credit(userId, amount, 'admin', { fromUserId: adminUserId, guildId });
  }
  return debit(userId, Math.abs(amount));
}

/**
 * Zero out a user's global wallet balance — sets it to exactly 0 regardless of what
 * it was, and logs the correction as a Transaction (type 'admin', negative amount
 * equal to whatever was removed) so it shows up in that user's currency log same as
 * any other movement. ZetaBot Panel only (dashboard/routes/devilPanel.js).
 */
async function adminZeroBalance(userId, adminUserId, guildIdForLog = null) {
  const wallet = await getOrCreateWallet(userId);
  const removed = wallet.balance;
  if (removed <= 0) return wallet; // already zero — nothing to log

  const updated = await Wallet.findOneAndUpdate({ userId }, { $set: { balance: 0 } }, { new: true });
  await Transaction.create({
    guildId: guildIdForLog,
    fromUserId: userId,
    toUserId: adminUserId,
    amount: removed,
    type: 'admin'
  });
  return updated;
}

/**
 * Set or clear a user's transfer blacklist (ZetaBot Panel only). A blacklisted user can
 * still receive VC — this only blocks them as a SENDER (enforced in transfer() above).
 */
async function setBlacklist(userId, blacklisted, { reason = '', adminUserId = null } = {}) {
  const wallet = await getOrCreateWallet(userId);
  wallet.blacklisted = Boolean(blacklisted);
  wallet.blacklistReason = blacklisted ? reason : '';
  wallet.blacklistedBy = blacklisted ? adminUserId : null;
  wallet.blacklistedAt = blacklisted ? new Date() : null;
  await wallet.save();
  return wallet;
}

module.exports = {
  getOrCreateWallet,
  getGuildSettings,
  credit,
  debit,
  transfer,
  claimDaily,
  claimSalary,
  rewardVote,
  adminAdjust,
  adminZeroBalance,
  setBlacklist
};
