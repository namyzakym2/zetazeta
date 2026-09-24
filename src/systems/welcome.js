const { AttachmentBuilder } = require('discord.js');
const GuildModel = require('../models/Guild');
const { t } = require('../services/translationService');
const { generateWelcomeCard } = require('../utils/welcomeCard');
const { buildV2Panel } = require('../utils/componentsV2');

async function handleMemberAdd(member) {
  const guildDoc = await GuildModel.findOne({ guildId: member.guild.id });
  if (!guildDoc) return;

  // Auto Role
  if (guildDoc.autoRoleId) {
    const role = member.guild.roles.cache.get(guildDoc.autoRoleId);
    if (role) await member.roles.add(role).catch(() => {});
  }

  if (!guildDoc.welcome?.enabled || !guildDoc.welcome.channelId) return;
  const channel = member.guild.channels.cache.get(guildDoc.welcome.channelId);
  if (!channel?.isTextBased()) return;

  const message = guildDoc.welcome.message
    .replaceAll('{mention}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));

  // If the server uploaded a custom background from the dashboard, send a
  // generated image card instead of the plain embed. Falls back to the embed
  // if card generation fails for any reason (e.g. background URL went dead).
  if (guildDoc.welcome.backgroundImage) {
    try {
      const buffer = await generateWelcomeCard({
        backgroundURL: guildDoc.welcome.backgroundImage,
        avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
        username: member.user.username,
        serverName: member.guild.name,
        memberCount: member.guild.memberCount,
        cardText: guildDoc.welcome.cardText,
        avatarPosition: guildDoc.welcome.avatarPosition,
        avatarX: guildDoc.welcome.avatarX,
        avatarY: guildDoc.welcome.avatarY
      });
      const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });
      await channel.send({ content: message, files: [attachment] }).catch(() => {});
      return;
    } catch (err) {
      console.error('Welcome card generation failed, falling back to embed:', err.message);
    }
  }

  const panel = buildV2Panel({
    title: t(guildDoc.locale, 'welcome.title'),
    description: message,
    color: '#0f2158',
    thumbnail: member.user.displayAvatarURL()
  });

  await channel.send(panel).catch(() => {});
}

async function handleGreet(member, usedInvite) {
  const guildDoc = await GuildModel.findOne({ guildId: member.guild.id });
  const config = guildDoc?.greet;
  if (!config?.enabled || !config.channelId || !config.message) return;

  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel?.isTextBased()) return;

  const invited = usedInvite?.inviterId ? `<@${usedInvite.inviterId}>` : 'غير معروف';
  const content = String(config.message)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{invited}', invited);

  try {
    const sent = await channel.send({ content });
    const seconds = Number(config.deleteAfterSeconds) || 0;
    if (seconds > 0) {
      setTimeout(() => sent.delete().catch(() => {}), seconds * 1000);
    }
  } catch (err) {
    console.error('Greet message failed:', err.message);
  }
}

module.exports = { handleMemberAdd, handleGreet };
