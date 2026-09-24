'use strict';

const axios = require('axios');
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  Routes
} = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('botprofile')
  .setDescription('تغيير اسم وصورة البوت في هذا السيرفر فقط')
  .addStringOption(o =>
    o.setName('name')
      .setDescription('اسم البوت داخل هذا السيرفر فقط')
      .setRequired(false)
      .setMaxLength(32))
  .addAttachmentOption(o =>
    o.setName('avatar')
      .setDescription('صورة البوت داخل هذا السيرفر فقط')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function isSupportedImage(contentType, url = '') {
  if (/^image\/(png|jpeg|jpg|webp|gif)$/i.test(contentType || '')) return true;
  return /\.(png|jpe?g|webp|gif)(?:\?|$)/i.test(url);
}

async function downloadAsDataUri(attachment) {
  const response = await axios.get(attachment.url, {
    responseType: 'arraybuffer',
    timeout: 20_000,
    maxContentLength: 10 * 1024 * 1024,
    maxBodyLength: 10 * 1024 * 1024,
    validateStatus: status => status >= 200 && status < 300
  });

  const contentType = String(
    response.headers?.['content-type'] || attachment.contentType || 'image/png'
  ).split(';')[0].trim().toLowerCase();

  if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(contentType)) {
    throw new Error(`Unsupported image content-type: ${contentType}`);
  }

  const normalizedType = contentType === 'jpg' ? 'jpeg' : contentType;
  return `data:image/${normalizedType};base64,${Buffer.from(response.data).toString('base64')}`;
}

async function execute(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
  }

  const name = interaction.options.getString('name');
  const avatar = interaction.options.getAttachment('avatar');

  if (!name && !avatar) {
    return interaction.reply({
      content: 'حدد **name** أو ارفع **avatar**.',
      ephemeral: true
    });
  }

  if (avatar && !isSupportedImage(avatar.contentType, avatar.url)) {
    return interaction.reply({
      content: 'الصورة لازم تكون PNG أو JPG/JPEG أو WEBP أو GIF.',
      ephemeral: true
    });
  }

  try {
    const body = {};

    if (name) body.nick = name;
    if (avatar) body.avatar = await downloadAsDataUri(avatar);

    // Use Discord's current-member endpoint directly. This is important for
    // per-server bot avatars: the normal GuildMember.edit() API does not expose
    // the current-member avatar field in older discord.js 14 releases.
    await interaction.client.rest.patch(
      Routes.guildMember(interaction.guild.id, '@me'),
      {
        body,
        headers: { 'X-Audit-Log-Reason': 'ZETA /botprofile' }
      }
    );

    const changed = [];
    if (name) changed.push(`الاسم: **${name}**`);
    if (avatar) changed.push('الصورة: **تم تغييرها لهذا السيرفر فقط**');

    return interaction.reply({
      content: `تم تحديث بروفايل البوت في **${interaction.guild.name}** فقط.\n${changed.join('\n')}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('botprofile error:', error?.rawError || error?.response?.data || error);

    let message = 'ما قدرت أغيّر بروفايل البوت.';
    const status = error?.status || error?.response?.status;
    if (status === 403) {
      message += ' تأكد أن للبوت صلاحية **Change Nickname** إذا كنت تغيّر الاسم.';
    } else if (status === 400) {
      message += ' تأكد أن الصورة صالحة وحجمها ضمن حدود Discord.';
    }

    return interaction.reply({ content: message, ephemeral: true });
  }
}

module.exports = { data, execute };
