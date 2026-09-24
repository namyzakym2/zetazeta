const { EmbedBuilder } = require('discord.js');
const Giveaway = require('../models/Giveaway');
const logService = require('../services/logService');
const { resolvePartyReaction } = require('../utils/reactionGiveaway');
const { getZetaBotEmoji } = require('../utils/zetaEmojis');

function pickWinners(participants, count, exclude = []) {
  const pool = participants.filter((id) => !exclude.includes(id));
  const source = pool.length >= count ? pool : participants;
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

async function getReactionParticipants(message, reactionString) {
  const reactionId = /^<a?:[^:>]+:(\d+)>$/.exec(reactionString || '')?.[1] || reactionString;
  const reaction = message.reactions.cache.get(reactionId) ||
    message.reactions.cache.find(r => r.emoji?.id === reactionId || r.emoji?.name === 'party');
  if (!reaction) return [];
  const users = await reaction.users.fetch().catch(() => new Map());
  return [...users.values()].filter(u => !u.bot).map(u => u.id);
}

async function startGiveaway(interaction, { prize, winnersCount, durationMs, channel }) {
  const endsAt = new Date(Date.now() + durationMs);
  const giveaway = await Giveaway.create({
    guildId: interaction.guild.id,
    channelId: channel.id,
    messageId: 'pending',
    hostId: interaction.user.id,
    prize,
    winnersCount,
    endsAt,
    reaction: 'party',
    roleId: null
  });

  // The giveaway uses the ZETA custom `party` emoji everywhere: header + entry reaction.
  // This keeps the look consistent with the reference design and avoids a Unicode/custom mix.
  const reaction = await resolvePartyReaction(channel, 'party');
  const endsUnix = Math.floor(endsAt.getTime() / 1000);
  const botAvatar = interaction.client.user?.displayAvatarURL({ extension: 'png', size: 128 });
  const hostAvatar = interaction.user?.displayAvatarURL({ extension: 'png', size: 64 });

  const embed = new EmbedBuilder()
    .setAuthor({
      name: 'ZETA',
      iconURL: botAvatar
    })
    .setTitle(`${reaction}  GIVEAWAY  ${reaction}`)
    .setDescription(`**Price**\n**${giveaway.prize}**`)
    .addFields(
      { name: `${getZetaBotEmoji('gift') || ''} Hosted by`, value: `<@${interaction.user.id}>`, inline: false },
      { name: `${getZetaBotEmoji('timer') || ''} Duration`, value: `<t:${endsUnix}:R>`, inline: true },
      { name: `${getZetaBotEmoji('users') || ''} Winners`, value: `${winnersCount}`, inline: true }
    )
    .setColor(0x5865F2)
    .setFooter({ text: 'React with the custom party emoji to enter' });

  if (hostAvatar) embed.setThumbnail(hostAvatar);

  // Static message: never edit it later. The entry reaction is the same custom wave.
  const sent = await channel.send({
    embeds: [embed]
  });
  await sent.react(reaction).catch(err => console.error('Giveaway reaction failed:', err.message));

  giveaway.messageId = sent.id;
  giveaway.reaction = reaction;
  await giveaway.save();

  await logService.log(interaction.client, interaction.guild.id, 'giveawayStart', {
    Prize: giveaway.prize,
    Winners: `${winnersCount}`,
    Channel: `<#${channel.id}>`,
    Host: `<@${interaction.user.id}>`,
    EndsAt: `<t:${endsUnix}:f>`
  });

  return giveaway;
}

async function handleButton() {
  // Legacy button IDs are intentionally no longer used. Giveaway entry is by reaction.
  return true;
}

async function endGiveaway(client, giveaway, { reroll = false } = {}) {
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  const message = channel ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;

  if (message) {
    const reaction = giveaway.reaction || await resolvePartyReaction(channel, 'party');
    giveaway.participants = await getReactionParticipants(message, reaction);
  }

  const winners = pickWinners(
    giveaway.participants,
    giveaway.winnersCount,
    reroll ? giveaway.winners : []
  );

  giveaway.ended = true;
  giveaway.winners = winners;
  await giveaway.save();

  // The original embed used to be left untouched forever, so anyone looking at the
  // giveaway message itself never saw that it ended or who won — the only trace was
  // a separate chat message, which is easy to miss/scroll past, especially on longer
  // giveaways. Now the original embed itself gets updated to show the result too.
  if (message) {
    try {
      const endedEmbed = EmbedBuilder.from(message.embeds[0] || {})
        .setFooter({ text: winners.length ? 'انتهى السحب 🎉' : 'انتهى السحب — لا يوجد مشاركون' })
        .addFields(
          winners.length
            ? [{ name: `${getZetaBotEmoji('crown2') || ''} الفائز${winners.length > 1 ? 'ون' : ''}`, value: winners.map(w => `<@${w}>`).join(', ') }]
            : [{ name: `${getZetaBotEmoji('sad') || ''} النتيجة`, value: 'لم يشارك أحد' }]
        );
      await message.edit({ embeds: [endedEmbed] });
    } catch (err) {
      console.error(`⚠️ Failed to update giveaway embed (message ${giveaway.messageId}):`, err.message);
    }
  } else {
    console.error(`⚠️ Giveaway ${giveaway._id} ended but its message (${giveaway.messageId}) could not be fetched — channel deleted or message removed?`);
  }

  if (channel) {
    if (winners.length) {
      await channel.send(
        `${getZetaBotEmoji('party') || ''} **انتهى الجيف أواي!**\n` +
        `الجائزة: **${giveaway.prize}**\n` +
        `${getZetaBotEmoji('crown2') || ''} الفائز${winners.length > 1 ? 'ون' : ''}: ${winners.map(w => `<@${w}>`).join(', ')}` +
        `${reroll ? `\n${getZetaBotEmoji('recycle') || ''} إعادة سحب` : ''}`
      ).catch(err => console.error('⚠️ Failed to send giveaway result message:', err.message));
    } else {
      await channel.send(`${getZetaBotEmoji('sad') || ''} انتهى سحب **${giveaway.prize}** ولم يشارك أحد.`).catch(err => console.error('⚠️ Failed to send empty-giveaway message:', err.message));
    }
  } else {
    console.error(`⚠️ Giveaway ${giveaway._id} ended but its channel (${giveaway.channelId}) could not be fetched.`);
  }

  await logService.log(client, giveaway.guildId, reroll ? 'giveawayReroll' : 'giveawayEnd', {
    Prize: giveaway.prize,
    Winners: winners.length ? winners.map(w => `<@${w}>`).join(', ') : 'لا يوجد',
    Channel: `<#${giveaway.channelId}>`
  });

  return winners;
}

async function checkExpired(client) {
  const expired = await Giveaway.find({ ended: false, endsAt: { $lte: new Date() } });
  for (const giveaway of expired) {
    await endGiveaway(client, giveaway).catch(err => console.error('Giveaway auto-end failed:', err));
  }
}

module.exports = { startGiveaway, handleButton, endGiveaway, checkExpired };
