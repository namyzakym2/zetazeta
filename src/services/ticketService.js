const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder
} = require('discord.js');
const Ticket = require('../models/Ticket');
const GuildModel = require('../models/Guild');
const logService = require('./logService');
const staffPointsService = require('./staffPointsService');
const { setEmojiSafe } = require('../utils/emoji');
const { resolveCustomEmoji } = require('../utils/zetaEmojis');
const { buildV2Panel } = require('../utils/componentsV2');
const { buildHtmlTranscript } = require('../utils/transcriptHtml');

// Discord message components allow up to 5 action rows. This ticket UI
// reserves 2 rows for the main actions/menu, leaving room for 3 rows of
// custom buttons (5 buttons per row).
const MAX_CUSTOM_BUTTONS_PER_TICKET = 15;

function componentEmoji(value) {
  if (!value) return undefined;
  const resolved = resolveCustomEmoji(String(value));
  if (resolved) {
    const match = resolved.match(/^<(a?):([A-Za-z0-9_]{2,32}):(\d+)>$/);
    if (match) return { animated: Boolean(match[1]), name: match[2], id: match[3] };
  }
  // Never pass logical names such as "users" directly to Discord.
  // If a custom emoji cannot be resolved, omit the emoji rather than creating
  // an invalid component payload.
  return undefined;
}

/**
 * بديل آمن لـ array.id(x) — يشتغل على أي مصفوفة عادية حتى لو ما فيها دوال Mongoose.
 */
function findSub(list, id) {
  if (!Array.isArray(list) || id == null) return null;
  return list.find((item) => item && String(item._id) === String(id)) || null;
}

console.log('🎫 ticketService v20 loaded (claim/close/delete default ON, ticket limit default 1)');

function renderName(format, { username, userId, number }) {
  // MySQL documents created before the current ticket schema may not contain
  // ticketNameFormat. Never let a missing setting crash ticket creation.
  const template = typeof format === 'string' && format.trim()
    ? format
    : 'ticket-{username}';
  return template
    .replaceAll('{username}', String(username ?? 'user'))
    .replaceAll('{userId}', String(userId ?? ''))
    .replaceAll('{number}', String(number ?? ''));
}

async function countOpenTickets(guildId, ownerId, guild) {
  const openTickets = await Ticket.find({ guildId, ownerId, status: 'open' });

  // إذا القناة انحذفت يدويًا من Discord، لا نخلي سجلها القديم يمنع صاحبها
  // من فتح تذكرة جديدة. نتحقق من القنوات الحالية ونغلق السجلات اليتيمة.
  let validOpen = 0;
  for (const ticket of openTickets) {
    const channel = guild.channels.cache.get(ticket.channelId)
      || await guild.channels.fetch(ticket.channelId).catch(() => null);

    if (channel) {
      validOpen += 1;
    } else {
      ticket.status = 'closed';
      await ticket.save().catch(() => {});
    }
  }

  return validOpen;
}

/**
 * يرجع إعدادات بانل معين: 'main' يعني guildDoc.ticketSettings (البانل الرئيسي
 * القديم)، أي قيمة ثانية يبحث عنها داخل guildDoc.ticketPanels. يرجع البانل
 * الرئيسي كـ fallback إذا انحذف البانل المطلوب (بدل ما يطيح الكود).
 */
function resolvePanelSettings(guildDoc, panelId) {
  const fallback = guildDoc?.ticketSettings || {};
  if (!panelId || panelId === 'main') return fallback;
  return guildDoc?.ticketPanels?.id?.(panelId) || fallback;
}

/**
 * يبني صف/صفوف أزرار "فتح تذكرة" لبانل معين — إما أزرار عادية (حد أقصى 5،
 * قيد Discord) أو قائمة سلكت منسدلة توسّع الحد إلى 25 تصنيف.
 * يُستخدم في /ticket-panel وفي "إرسال" بانل إضافي من الداشبورد.
 */
function buildOpenRows(settings, panelId) {
  const buttons = settings.buttons || [];

  if (settings.openDisplayType === 'menu' && buttons.length) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_open_menu_${panelId}`)
      .setPlaceholder('🎫 اختر نوع التذكرة اللي تبي تفتحها...')
      .addOptions(
        buttons.slice(0, 25).map((btn) => ({
          label: (btn.label || 'فتح تذكرة').slice(0, 100),
          value: String(btn._id),
          emoji: componentEmoji(btn.emoji),
          description: btn.description ? String(btn.description).slice(0, 100) : undefined
        }))
      );
    return [new ActionRowBuilder().addComponents(menu)];
  }

  const row = new ActionRowBuilder();
  if (buttons.length) {
    for (const btn of buttons.slice(0, 5)) {
      const style = ['Primary', 'Secondary', 'Success', 'Danger'].includes(btn.style) ? ButtonStyle[btn.style] : ButtonStyle.Primary;
      const button = new ButtonBuilder()
        .setCustomId(`ticket_open_${panelId}_${btn._id}`)
        .setLabel((btn.label || 'Open Ticket').slice(0, 80))
        .setStyle(style);
      setEmojiSafe(button, btn.emoji, 'ticket');
      row.addComponents(button);
    }
  } else {
    const button = new ButtonBuilder()
      .setCustomId(`ticket_open_${panelId}_default`)
      .setLabel('🎫 فتح تذكرة')
      .setStyle(ButtonStyle.Danger);
    setEmojiSafe(button, null, 'ticket');
    row.addComponents(button);
  }
  return [row];
}

/**
 * يبني رسالة بانل "فتح تذكرة" الكاملة (Components v2) لأي بانل — الرئيسي أو
 * أحد البانلات الإضافية — يستخدمها /ticket-panel وراوت "الإرسال" بالداشبورد
 * حتى ما يتكرر نفس المنطق بمكانين.
 */
function buildOpenPanelPayload(guild, settings, panelId) {
  const rows = buildOpenRows(settings, panelId);
  return buildV2Panel({
    title: `🎫  ${settings.panelTitle || guild.name}`,
    description: settings.panelDescription || 'هل تحتاج إلى مساعدة؟\nاضغط أحد الأزرار بالأسفل لفتح تذكرة جديدة.',
    image: settings.panelImage || settings.panelThumbnail || null,
    color: settings.panelColor,
    footer: settings.panelFooter || guild.name,
    rows
  });
}

/**
 * يبني صفوف أزرار/قائمة إجراءات التذكرة — يُستخدم عند فتح التذكرة وأيضًا عند
 * "Restart" (إعادة نشر نفس القائمة إذا صارت قديمة أو ما ردّت).
 */
function buildTicketActionRows(ticket, settings) {
  const rows = [];

  // زر "استلام" و"غلق" يبقوا أزرار مستقلة دايمًا (أهم إجراءين)، وباقي
  // الخيارات تتجمع بقائمة سلكت واحدة تحتها — بدل تبعثر الأزرار.
  const primaryRow = new ActionRowBuilder();

  // `!== false` (وليس truthy): الأزرار تظهر افتراضيًا، وتختفي فقط لو أحد طفّاها
  // صراحةً. بهذي الطريقة ما تختفي الأزرار لو إعدادات السيرفر المحفوظة قديمة وما
  // فيها الحقل أصلًا (undefined).
  if (settings.claimButton !== false) {
    const b = new ButtonBuilder().setCustomId(`ticket_claim_${ticket._id}`).setLabel('استلام').setStyle(ButtonStyle.Secondary);
    setEmojiSafe(b, 'adduser');
    primaryRow.addComponents(b);
  }

  if (settings.closeButton !== false) {
    const b = new ButtonBuilder().setCustomId(`ticket_close_${ticket._id}`).setLabel('غلق').setStyle(ButtonStyle.Danger);
    setEmojiSafe(b, 'lock');
    primaryRow.addComponents(b);
  }

  // زر حذف مستقل (يطلب تأكيد قبل ما يحذف) — يتحكم فيه الإعداد deleteButton.
  if (settings.deleteButton !== false) {
    const b = new ButtonBuilder().setCustomId(`ticket_delete_${ticket._id}`).setLabel('حذف').setStyle(ButtonStyle.Danger);
    setEmojiSafe(b, 'no');
    primaryRow.addComponents(b);
  }

  if (primaryRow.components.length) rows.push(primaryRow);

  // كل رموز قائمة التكت تستخدم إيموجيات ZETA المخصصة؛ لا نخلط بينها
  // وبين Unicode حتى يظهر شكل موحّد في كل السيرفرات.
  const moreOptions = [
    { label: 'استدعاء الإدارة', value: `ticket_call_${ticket._id}`, emoji: 'warn' },
    { label: 'إضافة شخص', value: `ticket_add_${ticket._id}`, emoji: 'users' },
    { label: 'إزالة شخص', value: `ticket_remove_${ticket._id}`, emoji: 'no' },
    { label: 'إعادة تسمية', value: `ticket_rename_${ticket._id}`, emoji: 'settings' },
    { label: 'تقييم مستلم التكت', value: `ticket_ratingnow_${ticket._id}`, emoji: 'star' }
  ];
  if (settings.transcriptButton !== false) {
    moreOptions.push({ label: 'نسخة المحادثة', value: `ticket_transcript_${ticket._id}`, emoji: 'link' });
  }
  if (settings.closeButton !== false) {
    moreOptions.push({ label: 'غلق التذكرة', value: `ticket_close_${ticket._id}`, emoji: 'lock' });
  }
  if (settings.deleteButton !== false) {
    moreOptions.push({ label: 'حذف التذكرة', value: `ticket_delete_${ticket._id}`, emoji: 'no' });
  }
  if (ticket.claimedBy) {
    moreOptions.push({ label: 'إلغاء استلام التكت', value: `ticket_unclaim_${ticket._id}`, emoji: 'no' });
  }
  moreOptions.push({ label: 'إعادة تحميل القائمة', value: `ticket_restart_${ticket._id}`, emoji: 'gear' });

  const moreMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_actions_menu_${ticket._id}`)
    .setPlaceholder('خيارات التكت')
    .addOptions(moreOptions.map(option => ({ ...option, emoji: componentEmoji(option.emoji) })));
  rows.push(new ActionRowBuilder().addComponents(moreMenu));

  // زر واحد لكل زر جاهز (quickButtons) في صف/صفوف إضافية بعد أزرار الإجراءات —
  // Discord يسمح بحد أقصى 5 أزرار بكل صف.
  if (ticket.customButtons?.length) {
    let currentRow = new ActionRowBuilder();
    for (const qb of ticket.customButtons) {
      if (currentRow.components.length >= 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      const b = new ButtonBuilder()
        .setCustomId(`ticket_custom_${ticket._id}_${qb._id}`)
        .setLabel(qb.label.slice(0, 80))
        .setStyle(ButtonStyle[qb.style] || ButtonStyle.Secondary);
      if (qb.emoji) setEmojiSafe(b, qb.emoji, '🔘');
      currentRow.addComponents(b);
    }
    if (currentRow.components.length) rows.push(currentRow);
  }

  return rows;
}

async function createTicket(guild, member, button, options = {}, panelId = 'main') {
  const guildDoc = await GuildModel.findOne({ guildId: guild.id }) || await GuildModel.create({ guildId: guild.id });
  const settings = resolvePanelSettings(guildDoc, panelId);

  const openCount = await countOpenTickets(guild.id, member.id, guild);
  // undefined / 0 / NaN (إعدادات قديمة بدون الحقل) = الحد الافتراضي 1. قبل كذا كانت
  // المقارنة مع undefined دايمًا false، فالمستخدم يقدر يفتح تكتات بلا حد.
  const configuredMax = Number(settings.maxTicketsPerUser);
  const maxTickets = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 1;
  if (openCount >= maxTickets) {
    const err = new Error('MAX_TICKETS_REACHED');
    err.max = maxTickets;
    throw err;
  }

  const totalTickets = await Ticket.countDocuments({ guildId: guild.id });
  const channelName = renderName(settings.ticketNameFormat, {
    username: member.user.username,
    userId: member.id,
    number: totalTickets + 1
  });

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
  ];

  // رتب الدعم الفني المسموح لها ترى هذا التصنيف من التذاكر — يدعم أكثر من
  // رتبة (supportRoleIds)، مع فولباك للحقل القديم (supportRoleId) للتصنيفات
  // اللي انحفظت قبل هذا التحديث.
  const supportRoleIds = [...new Set([...(button?.supportRoleIds || []), button?.supportRoleId].filter(Boolean))];
  for (const roleId of supportRoleIds) {
    overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  const channel = await guild.channels.create({
    name: channelName.slice(0, 90),
    type: ChannelType.GuildText,
    parent: button?.categoryId || undefined,
    permissionOverwrites: overwrites
  });

  const ticket = await Ticket.create({
    guildId: guild.id,
    channelId: channel.id,
    ownerId: member.id,
    buttonId: button?._id?.toString() || '',
    panelId
  });

  // أزرار "جاهزة" مُعدّة مسبقًا من إعدادات هذا البانل بالداشبورد (بدل تشغيل
  // /ticket-button-add يدويًا) — تنضاف لنفس customButtons حتى تشتغل بنفس
  // معالج الضغط الموجود أصلًا (handleCustom في tickets.js).
  if (settings.quickButtons?.length) {
    for (const qb of settings.quickButtons) {
      ticket.customButtons.push({
        label: qb.label,
        style: qb.style,
        emoji: qb.emoji,
        response: qb.response,
        addedBy: 'panel'
      });
    }
    await ticket.save();
  }

  const image = options.image || button?.image || settings?.panelImage;

  let welcomeText = button?.description || 'أهلاً بك في نظام الدعم الفني الخاص بنا. يرجى توضيح استفسارك أو مشكلتك بالتفصيل وسيقوم الطاقم الإداري بالرد عليك ومساعدتك في أقرب وقت.';
  if (settings?.ticketWelcomeTemplate) {
    welcomeText = settings.ticketWelcomeTemplate
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{username}/g, member.user.username)
      .replace(/{label}/g, button?.label || 'عام')
      .replace(/{server}/g, guild.name);
  }

  const description =
    `👋 **أهلاً بك في تذكرتك يا <@${member.id}>!**\n\n` +
    `> ${welcomeText}\n\n` +
    `✨ **تفاصيل التذكرة / Ticket Information:**\n` +
    `👤 **صاحب التذكرة:** <@${member.id}>\n` +
    `📁 **القسم الحالي:** \`${button?.label || 'عام'}\`\n` +
    `🕒 **تاريخ الفتح:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n` +
    `⚠️ **تعليمات هامة / General Rules:**\n` +
    `• يرجى كتابة استفسارك كاملاً وبشكل مباشر في رسالة واحدة لضمان سرعة خدمتك.\n` +
    `• سيتم إخطار فريق الدعم، يرجى التحلي بالصبر وتجنب تكرار الإشارة للإدارة.`;

  const rows = buildTicketActionRows(ticket, settings);

  let pingContent = `<@${member.id}>`;
  for (const roleId of supportRoleIds) {
    pingContent += ` <@&${roleId}>`;
  }

  const payload = buildV2Panel({
    pingContent,
    title: '🎫  تذكرة دعم جديدة',
    description,
    image,
    color: settings.panelColor,
    footer: settings.panelFooter || guild.name,
    rows
  });

  // Discord can transiently time out while creating the ticket. Retry only
  // connection timeouts so the ticket itself is not duplicated on normal API errors.
  let sent = false;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await channel.send(payload);
      sent = true;
      break;
    } catch (err) {
      lastError = err;
      const code = err?.code || err?.cause?.code;
      const timeout = code === 'UND_ERR_CONNECT_TIMEOUT' || /Connect Timeout|ETIMEDOUT/i.test(String(err?.message || ''));
      if (!timeout || attempt === 3) break;
      await new Promise(resolve => setTimeout(resolve, 750 * attempt));
    }
  }
  if (!sent) throw lastError || new Error('DISCORD_SEND_FAILED');

  await logService.log(guild.client, guild.id, 'ticketCreate', {
    User: `<@${member.id}>`,
    Channel: `<#${channel.id}>`
  });

  return { channel, ticket };
}

async function claimTicket(guild, ticketId, moderator) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error('TICKET_NOT_FOUND');

  if (ticket.ownerId === moderator.id) {
    throw new Error('CANNOT_CLAIM_OWN_TICKET');
  }

  if (ticket.claimedBy) {
    throw new Error('ALREADY_CLAIMED');
  }

  ticket.claimedBy = moderator.id;
  await ticket.save();

  await logService.log(guild.client, guild.id, 'ticketClaim', {
    Ticket: `<#${ticket.channelId}>`,
    Moderator: `<@${moderator.id}>`
  });

  await staffPointsService
    .awardTicketPoints(guild.client, guild.id, moderator.id, 'claim', ticket._id.toString(), ticket.ownerId)
    .catch(() => {});

  return ticket;
}

/**
 * إلغاء استلام التذكرة — يرجعها "غير مستلمة" حتى يقدر أي إداري ثاني يستلمها
 * من جديد (مفيدة إذا الإداري المستلم انشغل أو ما قدر يكمل).
 */
async function unclaimTicket(guild, ticketId, moderator) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error('TICKET_NOT_FOUND');
  if (!ticket.claimedBy) throw new Error('NOT_CLAIMED');

  const previousClaimer = ticket.claimedBy;
  ticket.claimedBy = null;
  await ticket.save();

  await logService.log(guild.client, guild.id, 'ticketClaim', {
    Ticket: `<#${ticket.channelId}>`,
    Moderator: `<@${moderator.id}> (إلغاء استلام — كانت مع <@${previousClaimer}>)`
  });

  return ticket;
}

async function addCustomButton(ticketId, { label, style, emoji, response, addedBy }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error('TICKET_NOT_FOUND');
  if (ticket.status !== 'open') throw new Error('TICKET_CLOSED');
  if (ticket.customButtons.length >= MAX_CUSTOM_BUTTONS_PER_TICKET) {
    const err = new Error('MAX_CUSTOM_BUTTONS_REACHED');
    err.max = MAX_CUSTOM_BUTTONS_PER_TICKET;
    throw err;
  }

  ticket.customButtons.push({ label, style, emoji, response, addedBy });
  await ticket.save();

  return { ticket, button: ticket.customButtons[ticket.customButtons.length - 1] };
}

async function buildTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();
  const lines = sorted.map((m) => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`);
  return lines.join('\n') || 'No messages.';
}

/**
 * يرسل طلب تقييم الإدارة لصاحب التذكرة بالخاص (نجوم 1-5) — يُستخدم تلقائيًا
 * عند إغلاق التذكرة، وأيضًا يدويًا عبر خيار "تقييم مستلم التكت" بالقائمة.
 * يرجع true لو انبعث فعليًا، false لو تم تجاوزه (خاص مقفول، ما فيه مستلم...).
 */
async function sendRatingRequest(guild, ticket, settings, owner = null) {
  if (!ticket.claimedBy) return false;

  try {
    const ratingOwner = owner || (await guild.client.users.fetch(ticket.ownerId));
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_rate_${ticket._id}`)
      .setPlaceholder('⭐ قيّم تعامل الإدارة معك...')
      .addOptions([
        { label: '⭐ (1) سيء جدًا', value: '1' },
        { label: '⭐⭐ (2) سيء', value: '2' },
        { label: '⭐⭐⭐ (3) متوسط', value: '3' },
        { label: '⭐⭐⭐⭐ (4) جيد', value: '4' },
        { label: '⭐⭐⭐⭐⭐ (5) ممتاز', value: '5' }
      ]);
    const payload = buildV2Panel({
      title: '📋 تقييم الإدارة',
      description: `تذكرتك في **${guild.name}**.\nكيف كان تعامل الإداري <@${ticket.claimedBy}> معك؟`,
      color: settings?.panelColor,
      rows: [new ActionRowBuilder().addComponents(menu)]
    });
    await ratingOwner.send(payload);
    return true;
  } catch (err) {
    // الخاص مقفول أو ما فيه سيرفر مشترك — نتجاهل بهدوء.
    return false;
  }
}

async function closeTicket(guild, ticketId, moderator) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error('TICKET_NOT_FOUND');

  const guildDoc = await GuildModel.findOne({ guildId: guild.id });
  const settings = resolvePanelSettings(guildDoc, ticket.panelId);

  const channel = guild.channels.cache.get(ticket.channelId);
  let owner = null;

  if (channel) {
    owner = await guild.client.users.fetch(ticket.ownerId).catch(() => null);

    // أرشيف HTML كامل للمحادثة (بديل ملف txt القديم) — يُبنى مرة وحدة ويُعاد
    // استخدامه لكل من روم الأرشيف وخاص صاحب التذكرة.
    const html = await buildHtmlTranscript(channel, {
      channelName: channel.name,
      ownerTag: owner?.tag || ticket.ownerId,
      guildName: guild.name
    }).catch(() => null);

    if (html) {
      const transcriptChannelId = settings?.transcriptChannelId || guildDoc?.logSettings?.ticketChannelId;
      if (transcriptChannelId) {
        const logChannel = guild.channels.cache.get(transcriptChannelId);
        if (logChannel?.isTextBased()) {
          const attachment = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `transcript-${ticket._id}.html` });
          await logChannel.send({
            content: `📄 نسخة محادثة التذكرة <#${channel.id}> (صاحبها: <@${ticket.ownerId}>)`,
            files: [attachment]
          }).catch(() => {});
        }
      }

      // نسخة تُرسل لصاحب التذكرة نفسه بالخاص، قبل حذف القناة — حتى لو مقفول
      // خاصه أو ما فيه سيرفر مشترك نتجاهل بهدوء وما نوقف إغلاق التذكرة.
      if (settings?.sendTranscriptToOwner !== false && owner) {
        const attachment = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `transcript-${ticket._id}.html` });
        await owner.send({
          content: `📄 هذي نسخة محادثة تذكرتك في **${guild.name}**.`,
          files: [attachment]
        }).catch(() => {});
      }
    }
  }

  ticket.status = 'closed';
  await ticket.save();

  await logService.log(guild.client, guild.id, 'ticketClose', {
    Ticket: ticket.channelId,
    Moderator: `<@${moderator.id}>`
  });

  await staffPointsService
    .awardTicketPoints(guild.client, guild.id, moderator.id, 'close', ticket._id.toString(), ticket.ownerId)
    .catch(() => {});

  // طلب تقييم الإدارة: يُرسل في الخاص لصاحب التذكرة، فقط إذا فيه إداري
  // استلم التذكرة فعليًا (ما فيه معنى لتقييم "لا أحد").
  if (settings?.ratingEnabled !== false) {
    await sendRatingRequest(guild, ticket, settings, owner);
  }

  if (channel) {
    await channel.delete().catch(() => {});
  }

  await logService.log(guild.client, guild.id, 'ticketDelete', {
    TicketId: ticket._id.toString(),
    Moderator: `<@${moderator.id}>`
  });

  return ticket;
}

async function checkAutoClose(client) {
  try {
    const openTickets = await Ticket.find({ status: 'open' });
    for (const ticket of openTickets) {
      const guild = client.guilds.cache.get(ticket.guildId);
      if (!guild) continue;
      
      const guildDoc = await GuildModel.findOne({ guildId: ticket.guildId });
      if (!guildDoc) continue;
      
      const settings = resolvePanelSettings(guildDoc, ticket.panelId);
      if (!settings?.autoCloseEnabled || !settings?.autoCloseMinutes) continue;
      
      const channel = guild.channels.cache.get(ticket.channelId)
        || await guild.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) {
        ticket.status = 'closed';
        await ticket.save().catch(() => {});
        continue;
      }
      
      let lastMsgTime = ticket.createdAt || channel.createdAt || Date.now();
      try {
        const messages = await channel.messages.fetch({ limit: 1 }).catch(() => null);
        if (messages && messages.size > 0) {
          lastMsgTime = messages.first().createdAt;
        }
      } catch (err) {
        // Fallback to ticket.createdAt
      }
      
      const diffMinutes = (Date.now() - new Date(lastMsgTime).getTime()) / 60_000;
      if (diffMinutes >= settings.autoCloseMinutes) {
        console.log(`🎫 Auto-closing inactive ticket ${ticket._id} in guild ${guild.name} (inactive for ${Math.round(diffMinutes)} mins)`);
        const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
        await closeTicket(guild, ticket._id, botMember || { id: client.user.id }).catch((err) => {
          console.error(`⚠️ Failed to auto-close ticket ${ticket._id}:`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('⚠️ Error checking ticket auto-close:', err);
  }
}

module.exports = {
  createTicket,
  claimTicket,
  unclaimTicket,
  closeTicket,
  sendRatingRequest,
  buildTranscript,
  countOpenTickets,
  addCustomButton,
  resolvePanelSettings,
  findSub,
  buildOpenPanelPayload,
  buildTicketActionRows,
  MAX_CUSTOM_BUTTONS_PER_TICKET,
  checkAutoClose
};