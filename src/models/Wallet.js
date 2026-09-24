const { Schema, model } = require('../db/mysqlCompat');

/**
 * Wallet — VC (ZetaBot Coins) is a GLOBAL currency: one balance per Discord user, shared
 * across every server ZETA is in. This is intentionally its own collection, split
 * out from the per-server User model (which only tracks per-guild activity/XP and
 * warnings) — the economy and the activity system stay fully independent of each
 * other, but the economy itself is now single/global instead of per-server.
 */
const WalletSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },

    balance: { type: Number, default: 0, min: 0 },

    // Daily / streak — one global streak, claimable from any server. The reward
    // amount uses whichever server's configured Daily Base Reward / Streak Bonus you
    // claimed in (each server can still tune its own rates), but there is only ever
    // one balance and one streak per person.
    streak: { type: Number, default: 0 },
    lastDaily: { type: Date, default: null },

    // Vote
    lastVote: { type: Number, default: null }, // ms timestamp of last confirmed vote

    // Vote reminder — set true once a "you can vote again" DM has been sent for the
    // current cooldown window, so src/systems/voteReminder.js doesn't re-DM the same
    // person every poll cycle. Reset back to false as soon as a new vote comes in
    // (see voteService.handleIncomingVote).
    voteReminded: { type: Boolean, default: false },

    // Staff weekly salary
    lastSalary: { type: Date, default: null },

    // Custom profile card background — a personal cosmetic preference, so it lives
    // here (global, one per person) rather than on the per-guild User model. Set
    // from the dashboard (GET/POST /user/profile-background); empty string = use
    // the default card look. See src/utils/profileCard.js.
    profileBackground: { type: String, default: '' },

    // Transfer blacklist — set from the ZetaBot Panel (dashboard/routes/devilPanel.js,
    // gated on ensureDevilRole). A blacklisted user can still RECEIVE VC (daily, vote,
    // being sent money) but economyService.transfer() rejects them as a SENDER, so
    // they can't move VC out of their wallet. Fully separate from balance itself.
    blacklisted: { type: Boolean, default: false },
    blacklistReason: { type: String, default: '' },
    blacklistedBy: { type: String, default: null },
    blacklistedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = model('Wallet', WalletSchema);
