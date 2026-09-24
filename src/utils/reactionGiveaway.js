'use strict';

/**
 * Static reaction giveaway.
 *
 * The original giveaway message is sent once and is NEVER edited.
 * At the end, a NEW result message is sent.
 *
 * By default the giveaway prize is 2 ريال and the entry reaction is the
 * ZETA custom `party` emoji when it can be resolved from the bot's
 * application emojis. If unavailable, it returns the requested custom tag so
 * callers can handle the missing asset without inserting Unicode.
 */
async function resolvePartyReaction(channel, requested) {
  if (requested && requested !== 'party') return requested;

  try {
    const client = channel?.client;
    const guild = channel?.guild;
    const guildParty = guild?.emojis?.cache?.find(e => e?.name === 'party');
    if (guildParty) return `<${guildParty.animated ? 'a' : ''}:${guildParty.name}:${guildParty.id}>`;

    if (client?.application?.emojis?.fetch) {
      const emojis = await client.application.emojis.fetch();
      const party = emojis.find(e => e?.name === 'party');
      if (party) return `<${party.animated ? 'a' : ''}:${party.name}:${party.id}>`;
    }
  } catch (_) {}

  // If the caller passed an already formatted custom emoji, keep it.
  if (requested && /^<a?:[^:>]+:\d+>$/.test(requested)) return requested;
  return requested || 'party';
}

function reactionCacheKey(reaction) {
  // Discord reaction cache keys custom emoji reactions by emoji identifier.
  const m = /^<a?:([^:>]+):(\d+)>$/.exec(reaction || '');
  return m ? m[2] : reaction;
}

async function startReactionGiveaway(channel, {
  prize = '2 ريال',
  durationMs,
  winners = 1,
  embed = {},
  reaction = 'party',
  resultPrefix = 'Giveaway ended!',
  excludeBots = true
} = {}) {
  if (!channel?.send) throw new TypeError('channel.send is required');
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('durationMs must be > 0');
  }
  if (!Number.isInteger(winners) || winners < 1) {
    throw new Error('winners must be >= 1');
  }

  const resolvedReaction = await resolvePartyReaction(channel, reaction);
  const displayReaction = resolvedReaction;

  // SEND ONLY — never message.edit(), interaction.editReply(), or embed updates.
  const giveawayMessage = await channel.send({
    embeds: [{
      title: embed.title || 'ZETA Giveaway',
      description: embed.description ||
        `الجائزة: **${prize}**\n\nتفاعل بـ ${displayReaction} للدخول.`,
      ...embed
    }]
  });

  await giveawayMessage.react(resolvedReaction);

  await new Promise(resolve => setTimeout(resolve, durationMs));

  const reactionObject =
    giveawayMessage.reactions.cache.get(resolvedReaction) ||
    giveawayMessage.reactions.cache.get(reactionCacheKey(resolvedReaction));

  const users = reactionObject
    ? await reactionObject.users.fetch()
    : new Map();

  const entries = [...users.values()].filter(user => !excludeBots || !user.bot);

  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  const selected = entries.slice(0, Math.min(winners, entries.length));
  const mentions = selected.map(user => `<@${user.id}>`);
  const result = selected.length
    ? `${resultPrefix}\n**${prize}**\nWinner${selected.length > 1 ? 's' : ''}: ${mentions.join(', ')}`
    : `${resultPrefix}\nNo valid entries were received for **${prize}**.`;

  // NEW MESSAGE ONLY — the original embed is never touched.
  await channel.send(result);

  return {
    message: giveawayMessage,
    winners: selected,
    users: entries,
    reaction: resolvedReaction,
    prize
  };
}

module.exports = { startReactionGiveaway, resolvePartyReaction };
