const {
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  MessageFlags
} = require('discord.js');
const { sanitizeHexColor } = require('./emoji');

/**
 * يبني رسالة على نظام Components v2 (Container بلون + نص + بانر صورة + أزرار)
 * بدل نظام الـ Embeds القديم.
 *
 * @param {Object} opts
 * @param {string}  [opts.pingContent]   نص المنشن اللي يتحط فوق الكونتينر (يطلع تنبيه عادي)
 * @param {string}  [opts.title]         عنوان بولد
 * @param {string}  [opts.description]   الوصف
 * @param {{name: string, value: string, inline?: boolean}[]} [opts.fields] حقول تتحول لأسطر نص
 * @param {string}  [opts.thumbnail]     رابط صورة صغيرة جنب النص (بديل setThumbnail)
 * @param {string}  [opts.image]         رابط صورة البانر
 * @param {string}  [opts.color]         لون الكونتينر (هيكس)
 * @param {string}  [opts.footer]        سطر صغير يتحط بالأسفل (بديل setFooter)
 * @param {Date|boolean} [opts.timestamp] وقت يتحط بالفوتر (بديل setTimestamp)
 * @param {ActionRowBuilder[]} [opts.rows] صفوف الأزرار/القوائم
 * @returns {{ flags: number, components: any[] }} payload جاهز لـ channel.send / interaction.reply
 */
function buildV2Panel({ pingContent, title, description, fields = [], thumbnail, image, color, footer, timestamp, rows = [] }) {
  const container = new ContainerBuilder().setAccentColor(sanitizeHexColorToInt(color));

  let text = '';
  if (title) text += `## ${title}\n`;
  if (description) text += description;
  if (fields.length) {
    const fieldsText = fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n');
    text += text ? `\n\n${fieldsText}` : fieldsText;
  }

  if (text) {
    const textDisplay = new TextDisplayBuilder().setContent(text);
    if (thumbnail) {
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(textDisplay)
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail))
      );
    } else {
      container.addTextDisplayComponents(textDisplay);
    }
  }

  if (image) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image))
    );
  }

  let footerLine = footer ? `-# ${footer}` : '';
  if (timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date();
    const unix = Math.floor(date.getTime() / 1000);
    footerLine = footerLine ? `${footerLine} • <t:${unix}:f>` : `-# <t:${unix}:f>`;
  }
  if (footerLine) {
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerLine));
  }

  for (const row of rows) {
    if (row?.components?.length) container.addActionRowComponents(row);
  }

  const components = [];
  if (pingContent) {
    components.push(new TextDisplayBuilder().setContent(pingContent));
  }
  components.push(container);

  return { flags: MessageFlags.IsComponentsV2, components };
}

function sanitizeHexColorToInt(color) {
  const hex = sanitizeHexColor(color);
  if (typeof hex === 'number') return hex;
  if (typeof hex === 'string') {
    const n = parseInt(hex.replace('#', ''), 16);
    if (!Number.isNaN(n)) return n;
  }
  return 0x2b2d31;
}

/**
 * يضيف فلاق Ephemeral (خاص) على payload جاهز من buildV2Panel.
 * @param {{flags: number, components: any[]}} payload
 */
function ephemeralV2(payload) {
  return { ...payload, flags: payload.flags | MessageFlags.Ephemeral };
}

module.exports = { buildV2Panel, ephemeralV2 };
