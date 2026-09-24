const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const GuildModel = require('../models/Guild');
const logService = require('../services/logService');

// الوقت المتبقي للتحذير قبل الحذف
const WARN_TTL_MS = 10_000;

// اسم الويب هوك
const ROOM_WEBHOOK_NAME = 'ZETA — بيع';

/**
 * قاموس الاستبدال للتشفير والتفريق (Anti-Scrape)
 */
const OBFUSCATION_MAP = [
  { target: /مطلوب/g, replacement: 'مـطــلــوب' },
  { target: /خاص/g, replacement: 'خــاص' },
  { target: /متجري/g, replacement: 'مــتـجـري' },
  { target: /متجر/g, replacement: 'مــتــجــر' },
  { target: /كريديت|كردت/g, replacement: 'كــريــديــت' },
  { target: /بيع/g, replacement: 'بــيــع' },
  { target: /شراء/g, replacement: 'شــراء' },
  { target: /شحن/g, replacement: 'شــحــن' },
  { target: /ضمان/g, replacement: 'ضــمــان' },
  { target: /عرض/g, replacement: 'عــرض' },
  { target: /خصم/g, replacement: 'خــصــم' },
  { target: /أسعار|اسعار/g, replacement: 'اســعــار' },
  { target: /رخيص/g, replacement: 'رخــيــص' },
  { target: /سريع/g, replacement: 'ســريــع' },
  { target: /تواصل/g, replacement: 'تــواصــل' },
  { target: /افتح تذكرة/g, replacement: 'افــتــح تــذكــرة' },
  { target: /تيكت/g, replacement: 'تـيـكـت' },
  { target: /خدمات/g, replacement: 'خـدمـات' },
  { target: /خدمة/g, replacement: 'خـدمـة' },
  { target: /تصميم/g, replacement: 'تـصـمـيـم' },
  { target: /برمجة/g, replacement: 'بـرمـجـة' },
  { target: /برودكاست/g, replacement: 'بـرودكـاسـت' },
  { target: /ديسكورد/g, replacement: 'ديـسـكورد' },
  { target: /نيترو/g, replacement: 'نـيـتـرو' },
  { target: /دعم/g, replacement: 'دعـم' },
  { target: /توصيل/g, replacement: 'تـوصـيـل' },
  { target: /VIP|vip/gi, replacement: 'V. I. P.' },
  { target: /مجاني/g, replacement: 'مـجـانـي' },
  { target: /لفترة محدودة/g, replacement: 'لـفـتـرة مـحـدودة' },
  { target: /متوفر/g, replacement: 'مــتــوفــر' },
  { target: /مزادات/g, replacement: 'مــز1دات' },
  { target: /متاجر/g, replacement: 'مـــتٓـــاجــر' },
  { target: /مقابل/g, replacement: 'مـقـابـل' }
];

/**
 * دالة لتطبيق التشفير والمراوغة على النص
 */
function obfuscateText(text) {
  if (!text) return '';
  let obfuscated = text;
  for (const { target, replacement } of OBFUSCATION_MAP) {
    obfuscated = obfuscated.replace(target, replacement);
  }
  return obfuscated;
}

/**
 * جلب أو إنشاء الويب هوك
 */
async function getSellerWebhook(channel) {
  const targetChannel = channel.isThread() ? channel.parent : channel;
  if (!targetChannel) return null;

  const perms = targetChannel.permissionsFor(targetChannel.client.user);
  if (!perms?.has(PermissionFlagsBits.ManageWebhooks)) return null;

  const webhooks = await targetChannel.fetchWebhooks().catch(() => null);
  let hook = webhooks?.find((w) => w.name === ROOM_WEBHOOK_NAME && w.owner?.id === targetChannel.client.user.id);
  if (!hook) {
    hook = await targetChannel
      .createWebhook({ name: ROOM_WEBHOOK_NAME, avatar: targetChannel.client.user.displayAvatarURL() })
      .catch(() => null);
  }
  return hook;
}

/**
 * إرسال الإعلان عبر الويب هوك مع زر رابط يفتح بروفايل البائع
 */
async function postListing(message) {
  // 1. حذف الرسالة الأصلية فوراً
  const deleted = await message.delete().catch((err) => {
    console.error(`[sellerRoom] فشل حذف الرسالة الأصلية ${message.id}:`, err.message);
    return false;
  });

  const hook = await getSellerWebhook(message.channel);

  if (!hook) {
    console.warn(`[sellerRoom] لا توجد صلاحية Manage Webhooks في الروم ${message.channel.id}. تم إلغاء الإرسال.`);
    return false;
  }

  const attachments = [...message.attachments.values()];

  // زر رابط يوجه لبروفايل البائع مباشرة
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('📩 تواصل مع البائع')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/users/${message.author.id}`)
  );

  // 2. تشفير النص باستبدال الكلمات الدلالية
  const rawContent = message.content || '';
  const encryptedContent = rawContent ? obfuscateText(rawContent) : '*(مرفق بدون نص)*';

  // 3. الإرسال عبر الويب هوك
  const sent = await hook
    .send({
      content: encryptedContent,
      username: message.member.displayName.slice(0, 80),
      avatarURL: message.author.displayAvatarURL({ extension: 'png', size: 256 }),
      files: attachments.length ? attachments : undefined,
      components: [row],
      threadId: message.channel.isThread() ? message.channel.id : undefined
    })
    .catch((err) => {
      console.error(`[sellerRoom] فشل إرسال الويب هوك في الروم ${message.channel.id}:`, err.message);
      return null;
    });

  return !!sent;
}

async function blockNonSeller(message, room) {
  await message.delete().catch(() => {});

  const warnMsg = await message.channel
    .send({
      content:
        `⚠️ <@${message.author.id}> هذا الروم مخصص لإعلانات البائعين الموثّقين فقط. ` +
        `إذا عندك سلعة تبيعها، تواصل مع الإدارة عشان توثيق حسابك كبائع.`
    })
    .catch(() => null);
  if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), WARN_TTL_MS);

  await message.author
    .send(
      `⚠️ رسالتك في <#${message.channel.id}> بسيرفر **${message.guild.name}** تم حذفها — ` +
        `هذا الروم مخصص لإعلانات البائعين الموثّقين فقط.`
    )
    .catch(() => {});

  await logService.log(message.client, message.guild.id, 'sellerRoomBlock', {
    User: `${message.author.tag} (${message.author.id})`,
    Channel: `<#${message.channel.id}>`,
    Content: message.content?.slice(0, 500) || '(بدون نص / مرفق فقط)'
  });

  return true;
}

async function handleMessage(message) {
  if (message.webhookId) return false;

  const guildDoc = await GuildModel.findOne({ guildId: message.guild.id });
  const room = guildDoc?.sellerRoom;
  if (!room?.enabled || room.channelId !== message.channel.id) return false;
  if (!room.sellerRoleId) return false;

  if (!message.member) return false;

  const isStaff = message.member?.permissions.has(PermissionFlagsBits.ManageGuild);
  if (isStaff) return false;

  const isSeller = message.member?.roles.cache.has(room.sellerRoleId);
  if (isSeller) return postListing(message);

  return blockNonSeller(message, room);
}

module.exports = { handleMessage };