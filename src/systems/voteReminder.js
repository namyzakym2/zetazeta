const Wallet = require('../models/Wallet');
const voteService = require('../services/voteService');
const { buildV2Panel } = require('../utils/componentsV2');

// top.gg (and most vote sites) reset the vote cooldown every 12 hours.
const VOTE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

/**
 * voteReminder — polls the global Wallet collection for anyone whose 12h vote
 * cooldown has expired and who hasn't already been reminded this window, then DMs
 * them a "you can vote again" nudge with the vote link/button. This is what
 * actually drives repeat votes (and therefore bot visibility on vote sites) instead
 * of relying on people remembering on their own.
 *
 * Called on an interval from src/events/ready.js, the same pattern giveaways.js
 * uses for its expiry check.
 */
async function checkAndRemind(client) {
  const cutoff = Date.now() - VOTE_COOLDOWN_MS;

  const due = await Wallet.find({
    lastVote: { $ne: null, $lte: cutoff },
    voteReminded: { $ne: true }
  }).select('userId').lean();

  if (!due.length) return;

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  for (const wallet of due) {
    // Mark as reminded first (whether or not the DM actually lands) — an unreachable
    // DM (closed DMs, no shared server left) shouldn't get retried every poll cycle
    // forever. It resets automatically the next time they actually vote.
    await Wallet.updateOne({ userId: wallet.userId }, { voteReminded: true });

    try {
      const user = await client.users.fetch(wallet.userId);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('صوّت الآن').setStyle(ButtonStyle.Link).setURL(voteService.getVoteUrl())
      );
      const panel = buildV2Panel({
        title: '🔔 تقدر تصوّت مرة ثانية!',
        description: 'مرت 12 ساعة من آخر تصويت — صوّت الحين وخذ مكافأتك 🎁',
        color: '#0f2158',
        rows: [row]
      });
      await user.send(panel);
    } catch (err) {
      // DMs closed, bot blocked, etc. — silently skip, already marked as reminded above.
    }
  }
}

module.exports = { checkAndRemind };
