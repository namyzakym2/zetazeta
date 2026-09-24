const GuildModel = require('../models/Guild');
const Ticket = require('../models/Ticket');
const ticketService = require('../services/ticketService');
const staffRatingService = require('../services/staffRatingService');
const { t } = require('../services/translationService');
const { 
  AttachmentBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { buildV2Panel } = require('../utils/componentsV2');
const { setEmojiSafe } = require('../utils/emoji');

/**
 * فتح تذكرة جديدة
 */
async function handleOpen(interaction, panelId, buttonId) {
  // Opening a ticket may create a channel and post a panel, both of which can hit
  // Discord's API. Acknowledge the button immediately so a slow connection does not
  // cause Discord error 10062 (Unknown interaction).
  await interaction.deferReply({ ephemeral: true });
  const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
  const settings = ticketService.resolvePanelSettings(guildDoc, panelId);
  const button = buttonId === 'default' ? null : ticketService.findSub(settings?.buttons, buttonId);

  const ticketImage = button?.image || settings?.panelImage;

  try {
    const { channel } = await ticketService.createTicket(interaction.guild, interaction.member, button, {
      image: ticketImage
    }, panelId);

    return interaction.editReply({ 
      content: `✅ تم فتح التذكرة بنجاح: ${channel}`,  
    });
  } catch (err) {
    if (err.message === 'MAX_TICKETS_REACHED') {
      // إذا كان عند المستخدم تكت مفتوحة فعلًا، أرسل له رابط القناة وزر
      // حذف مباشر بدل رسالة عامة فقط. وإذا كان السجل يشير لتكت قديمة،
      // نحاول تنظيف السجل أولًا قبل إظهارها.
      const openTickets = await Ticket.find({
        guildId: interaction.guild.id,
        ownerId: interaction.user.id,
        status: 'open'
      }).sort({ createdAt: -1 });

      let activeTicket = null;
      for (const ticket of openTickets) {
        const channel = interaction.guild.channels.cache.get(ticket.channelId)
          || await interaction.guild.channels.fetch(ticket.channelId).catch(() => null);

        if (channel) {
          activeTicket = { ticket, channel };
          break;
        }

        ticket.status = 'closed';
        await ticket.save().catch(() => {});
      }

      if (activeTicket) {
        const deleteButton = new ButtonBuilder()
          .setCustomId(`ticket_delete_existing_${activeTicket.ticket._id}`)
          .setLabel('حذف التكت')
          .setStyle(ButtonStyle.Danger);
        setEmojiSafe(deleteButton, 'no');

        return interaction.editReply({
          content: `لديك تكت مفتوحة بالفعل: ${activeTicket.channel}\nلا يمكنك فتح تكت أخرى قبل حذف التكت الحالية.`,
          components: [new ActionRowBuilder().addComponents(deleteButton)],
        });
      }

      // في حال كانت كل السجلات القديمة تشير لقنوات محذوفة، اسمح بالفتح
      // مباشرة بدل إرجاع خطأ MAX_TICKETS_REACHED.
      try {
        return await handleOpen(interaction, panelId, buttonId);
      } catch (_) {
        // نكمل إلى الرسالة العامة في حال فشلت إعادة المحاولة.
      }

      return interaction.editReply({
        content: t(guildDoc?.locale || 'ar', 'ticket.alreadyOpen', { max: err.max }),
      });
    }
    return interaction.editReply({ content: '❌ ' + err.message, ephemeral: true });
  }
}

/**
 * التعامل مع تقييم الإدارة (يوصل بالخاص بعد إغلاق التذكرة) — الخطوة الأولى:
 * اختيار عدد النجوم يفتح مودال لكتابة ملاحظة نصية (اختيارية إلا إذا الإعدادات
 * تطلبها إجباريًا)، والحفظ الفعلي يصير بعد استلام المودال في handleRateModalSubmit.
 */
async function handleRate(interaction, ticketId) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return interaction.update({ content: '❌ هذه التذكرة ما عادت موجودة.', components: [] });
  }
  if (!ticket.claimedBy) {
    return interaction.update({ content: '❌ ما فيه إداري مستلم لهذه التذكرة عشان تقيّمه.', components: [] });
  }

  const score = Number(interaction.values[0]);

  const guildDoc = await GuildModel.findOne({ guildId: ticket.guildId });
  const settings = ticketService.resolvePanelSettings(guildDoc, ticket.panelId);

  const modal = new ModalBuilder()
    .setCustomId(`ticket_rate_modal_${ticketId}_${score}`)
    .setTitle('تقييم الإدارة');

  const commentInput = new TextInputBuilder()
    .setCustomId('comment')
    .setLabel(settings?.ratingRequireComment ? 'ملاحظتك (مطلوبة)' : 'ملاحظة (اختياري)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('اكتب ملاحظتك عن تعامل الإداري معك...')
    .setRequired(!!settings?.ratingRequireComment)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(commentInput));

  return interaction.showModal(modal);
}

/**
 * الخطوة الثانية: استلام المودال (النجوم + الملاحظة)، حفظ التقييم، وإشعار
 * روم التقييمات إذا كان محدد.
 */
async function handleRateModalSubmit(interaction, ticketId, score) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return interaction.reply({ content: '❌ هذه التذكرة ما عادت موجودة.', ephemeral: true });
  }

  const comment = interaction.fields.getTextInputValue('comment')?.trim() || '';

  try {
    await staffRatingService.rate(ticket.guildId, ticket.claimedBy, interaction.user.id, ticket._id, score, comment);
  } catch (err) {
    const failMsg = err.message === 'ALREADY_RATED'
      ? 'ℹ️ تم تقييم هذه التذكرة من قبل، شكرًا لك 🙏'
      : '❌ حدث خطأ أثناء حفظ التقييم.';
    return interaction.isFromMessage?.()
      ? interaction.update({ content: failMsg, components: [] })
      : interaction.reply({ content: failMsg, ephemeral: true });
  }

  const stars = '⭐'.repeat(score);

  // إشعار في روم التقييمات إذا كان محدد بإعدادات هذا البانل
  try {
    const guild = interaction.client.guilds.cache.get(ticket.guildId);
    const guildDoc = await GuildModel.findOne({ guildId: ticket.guildId });
    const settings = ticketService.resolvePanelSettings(guildDoc, ticket.panelId);
    if (guild && settings?.ratingChannelId) {
      const logChannel = guild.channels.cache.get(settings.ratingChannelId);
      if (logChannel?.isTextBased()) {
        let description = `الإداري: <@${ticket.claimedBy}>\nالتقييم: ${stars} (${score}/5)\nمن: <@${interaction.user.id}>`;
        if (comment) description += `\n📝 **ملاحظة:** ${comment}`;
        const panel = buildV2Panel({
          title: '📋 تقييم إداري جديد',
          description,
          color: '#F1C40F',
          timestamp: true
        });
        await logChannel.send(panel).catch(() => {});
      }
    }
  } catch (err) {
    // تجاهل أي خطأ هنا؛ التقييم محفوظ أصلاً في الداتابيز.
  }

  const thanksMsg = `✅ شكرًا لتقييمك! ${stars} (${score}/5) — تم إرساله إلى الإدارة.`;

  // إذا المودال جاء من رسالة (قائمة النجوم بالخاص)، نحدّث نفس الرسالة بدل
  // الرد بواحدة جديدة — نفس السلوك القديم قبل إضافة خطوة الملاحظة.
  return interaction.isFromMessage?.()
    ? interaction.update({ content: thanksMsg, components: [] })
    : interaction.reply({ content: thanksMsg, ephemeral: true });
}

/**
 * استلام التذكرة
 */
async function handleClaim(interaction, ticketId) {
  const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });

  try {
    await ticketService.claimTicket(interaction.guild, ticketId, interaction.member);
    return interaction.reply({
      content: t(guildDoc?.locale || 'ar', 'ticket.claimed', { user: `<@${interaction.user.id}>` })
    });
  } catch (err) {
    if (err.message === 'CANNOT_CLAIM_OWN_TICKET') {
      return interaction.reply({ content: '❌ لا يمكنك استلام التذكرة الخاصة بك!', ephemeral: true });
    }
    if (err.message === 'ALREADY_CLAIMED') {
      return interaction.reply({ content: '❌ هذه التذكرة مستلمة بالفعل من قبل إداري آخر!', ephemeral: true });
    }
    return interaction.reply({ content: '❌ تعذر استلام التذكرة.', ephemeral: true });
  }
}

/**
 * إلغاء استلام التذكرة — يرجعها متاحة لأي إداري ثاني يستلمها.
 */
async function handleUnclaim(interaction, ticketId) {
  try {
    await ticketService.unclaimTicket(interaction.guild, ticketId, interaction.member);
    return interaction.reply({ content: `❌ <@${interaction.user.id}> ألغى استلامه للتذكرة — صارت متاحة لأي إداري ثاني.` });
  } catch (err) {
    if (err.message === 'NOT_CLAIMED') {
      return interaction.reply({ content: 'ℹ️ هذه التذكرة مو مستلمة أصلًا.', ephemeral: true });
    }
    return interaction.reply({ content: '❌ تعذر إلغاء الاستلام.', ephemeral: true });
  }
}

/**
 * "إعادة تحميل القائمة" — يعيد نشر نفس أزرار/قائمة إجراءات التذكرة برسالة
 * جديدة (مفيد لو القائمة القديمة صارت بعيدة بالمحادثة أو ما ردّت).
 */
async function handleRestart(interaction, ticketId) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return interaction.reply({ content: '❌ لم يتم العثور على التذكرة.', ephemeral: true });
  }

  const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
  const settings = ticketService.resolvePanelSettings(guildDoc, ticket.panelId);
  const rows = ticketService.buildTicketActionRows(ticket, settings);

  await interaction.reply({ content: '🔄 تم تحديث قائمة الخيارات:', components: rows });
}

/**
 * "تقييم مستلم التكت" — يرسل طلب التقييم يدويًا لصاحب التذكرة بالخاص بدون
 * ما يغلق التذكرة (بعكس التقييم التلقائي عند الإغلاق).
 */
async function handleManualRating(interaction, ticketId) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return interaction.reply({ content: '❌ لم يتم العثور على التذكرة.', ephemeral: true });
  }
  if (!ticket.claimedBy) {
    return interaction.reply({ content: '❌ ما فيه إداري مستلم لهذه التذكرة عشان تُقيّمه.', ephemeral: true });
  }

  const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
  const settings = ticketService.resolvePanelSettings(guildDoc, ticket.panelId);

  const sent = await ticketService.sendRatingRequest(interaction.guild, ticket, settings);
  return interaction.reply({
    content: sent ? '✅ تم إرسال طلب التقييم لصاحب التذكرة بالخاص.' : '❌ ما قدرنا نوصل خاص صاحب التذكرة (خاصه مقفول أو ما فيه سيرفر مشترك).',
    ephemeral: true
  });
}

/**
 * استدعاء الإدارة (ينادي المستلم إذا كانت مستلمة، أو رتبة الدعم إذا لم تكن مستلمة)
 */
async function handleCallAdmin(interaction, ticketId) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return interaction.reply({ content: '❌ لم يتم العثور على التذكرة.', ephemeral: true });
  }

  const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
  const settings = ticketService.resolvePanelSettings(guildDoc, ticket.panelId);
  const button = ticketService.findSub(settings?.buttons, ticket.buttonId);

  // إذا التكت مستلمة، نمنشن الإداري المستلم
  if (ticket.claimedBy) {
    return interaction.reply({
      content: `🔔 <@${interaction.user.id}> يستدعي الإداري المستلم للتذكرة: <@${ticket.claimedBy}>!`
    });
  }

  // إذا غير مستلمة، نمنشن كل رتب الدعم الفني المحددة لهذا التصنيف (يدعم أكثر
  // من رتبة الآن، مع فولباك للحقل القديم supportRoleId).
  const supportRoleIds = [...new Set([...(button?.supportRoleIds || []), button?.supportRoleId].filter(Boolean))];
  if (supportRoleIds.length) {
    return interaction.reply({
      content: `🔔 <@${interaction.user.id}> يستدعي طاقم الدعم الفني: ${supportRoleIds.map((id) => `<@&${id}>`).join(' ')}!`
    });
  }

  return interaction.reply({
    content: `🔔 <@${interaction.user.id}> قام بنداء الإدارة!`
  });
}

/**
 * إغلاق التذكرة
 */
// تتبع عمليات الإغلاق المعلّقة (خلال الـ 10 ثواني قبل التنفيذ الفعلي) — بالذاكرة
// فقط، يكفي لأن مدة الانتظار قصيرة جدًا. المفتاح: ticketId.
const pendingCloses = new Map();

/**
 * الخطوة 1: الضغط على "إغلاق" — يسأل تأكيد قبل أي إجراء فعلي.
 */
async function handleCloseRequest(interaction, ticketId) {
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close_confirm_${ticketId}`).setLabel('نعم، أغلق التذكرة').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket_close_cancel_${ticketId}`).setLabel('لا، تراجع').setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: '⚠️ هل أنت متأكد إنك تبي تغلق هذي التذكرة؟',
    components: [confirmRow]
  });
}

/**
 * الضغط على "لا" — يلغي التأكيد بدون أي تغيير.
 */
async function handleCloseCancel(interaction, ticketId) {
  return interaction.update({ content: '✅ تم التراجع — التذكرة لسه مفتوحة.', components: [] });
}

/**
 * الخطوة 2: تأكيد الإغلاق — ينشر عدّاد 10 ثواني بزر "تراجع" داخل التكت، ولا
 * ينفّذ الإغلاق الفعلي (closeTicket) إلا بعد انتهاء المهلة بدون تراجع.
 */
async function handleCloseConfirm(interaction, ticketId) {
  await interaction.update({ content: '⏳ جاري تجهيز الإغلاق...', components: [] });

  const undoRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close_undo_${ticketId}`).setLabel('تراجع عن الإغلاق').setStyle(ButtonStyle.Secondary)
  );

  const notice = await interaction.channel.send({
    content: '🔒 سيتم إغلاق هذي التذكرة خلال **10 ثواني**...\nاضغط الزر بالأسفل لو تبي تلغي الإغلاق.',
    components: [undoRow]
  });

  const timeout = setTimeout(async () => {
    pendingCloses.delete(ticketId);
    try {
      const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
      await notice.edit({ content: t(guildDoc?.locale || 'ar', 'ticket.closed'), components: [] }).catch(() => {});
      await ticketService.closeTicket(interaction.guild, ticketId, interaction.member);
    } catch (err) {
      console.error('❌ فشل إغلاق التذكرة بعد انتهاء العدّاد:', err);
    }
  }, 10_000);

  pendingCloses.set(ticketId, { timeout, messageId: notice.id, channelId: notice.channel.id });
}

/**
 * الضغط على "تراجع عن الإغلاق" خلال الـ 10 ثواني — يلغي المؤقّت والتذكرة تبقى مفتوحة.
 */
async function handleCloseUndo(interaction, ticketId) {
  const pending = pendingCloses.get(ticketId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingCloses.delete(ticketId);
  }

  return interaction.update({
    content: '✅ تم التراجع — التذكرة لسه مفتوحة ومارح تُغلق.',
    components: []
  });
}

/**
 * الخطوة 1 لزر "حذف" المستقل: يسأل تأكيد (رسالة خاصة بالضاغط فقط) قبل أي حذف فعلي.
 */
async function handleDeleteRequest(interaction, ticketId) {
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_delete_confirm_${ticketId}`).setLabel('نعم، احذف التذكرة').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket_delete_cancel_${ticketId}`).setLabel('لا، تراجع').setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: '⚠️ متأكد إنك تبي تحذف هذي التذكرة نهائيًا؟ (بدون نسخة محادثة)',
    components: [confirmRow],
    ephemeral: true
  });
}

async function handleDeleteCancel(interaction) {
  return interaction.update({ content: '✅ تم التراجع — التذكرة ما انحذفت.', components: [] });
}

/**
 * حذف التذكرة فورًا — يغلق سجلها في قاعدة البيانات ثم يحذف قناة التذكرة.
 *
 * مهم: نحذف قناة التذكرة نفسها (ticket.channelId) وليس interaction.channel. زر
 * "حذف التكت" الذي يظهر عند محاولة فتح تذكرة ثانية يُضغط داخل قناة البانل، فلو
 * حذفنا interaction.channel لانحذفت قناة البانل بدل التذكرة.
 */
async function handleDeleteTicket(interaction, ticketId) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    return interaction.reply({ content: '❌ هذه التذكرة ما عادت موجودة.', ephemeral: true });
  }

  const inTicketChannel = interaction.channelId === ticket.channelId;

  // الضغط من خارج قناة التذكرة (زر "حذف التكت" في رسالة "لديك تكت مفتوحة") مسموح لصاحبها فقط.
  if (!inTicketChannel && interaction.user.id !== ticket.ownerId) {
    return interaction.reply({ content: '❌ هذا الزر لصاحب التذكرة فقط.', ephemeral: true });
  }

  const pending = pendingCloses.get(ticketId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingCloses.delete(ticketId);
  }

  ticket.status = 'closed';
  await ticket.save().catch(() => {});

  const ticketChannel = inTicketChannel
    ? interaction.channel
    : (interaction.guild?.channels.cache.get(ticket.channelId)
        || await interaction.guild?.channels.fetch(ticket.channelId).catch(() => null));

  if (inTicketChannel) {
    await interaction.reply({ content: '🗑️ سيتم حذف التذكرة الآن.' }).catch(() => {});
  } else {
    await interaction.update({ content: '🗑️ تم حذف تذكرتك، تقدر تفتح تذكرة جديدة الحين.', components: [] }).catch(() => {});
  }

  await ticketChannel?.delete().catch(() => {});
}

/**
 * استخراج نص المحادثة (Transcript)
 */
async function handleTranscript(interaction, ticketId) {
  await interaction.deferReply({ ephemeral: true });

  const transcript = await ticketService.buildTranscript(interaction.channel);
  const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { 
    name: `transcript-${ticketId}.txt` 
  });

  await interaction.editReply({ 
    content: '📄 ملف نص التذكرة (Transcript):', 
    files: [attachment] 
  });
}

/**
 * Modal إضافة عضو
 */
async function handleAddModal(interaction, ticketId) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_add_${ticketId}`)
    .setTitle('إضافة شخص إلى التذكرة');

  const userInput = new TextInputBuilder()
    .setCustomId('user_id')
    .setLabel('آيدي العضو (User ID)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('أدخل آيدي الشخص هنا...')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(userInput));
  await interaction.showModal(modal);
}

async function handleAddSubmit(interaction) {
  const userId = interaction.fields.getTextInputValue('user_id');
  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!member) {
    return interaction.reply({ content: '❌ لم يتم العثور على هذا العضو في السيرفر.', ephemeral: true });
  }

  await interaction.channel.permissionOverwrites.edit(member.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  });

  return interaction.reply({ content: `✅ تم إضافة العضو <@${member.id}> إلى التذكرة بنجاح.` });
}

/**
 * Modal إزالة عضو
 */
async function handleRemoveModal(interaction, ticketId) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_remove_${ticketId}`)
    .setTitle('إزالة شخص من التذكرة');

  const userInput = new TextInputBuilder()
    .setCustomId('user_id')
    .setLabel('آيدي العضو المراد إزالته')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('أدخل آيدي الشخص هنا...')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(userInput));
  await interaction.showModal(modal);
}

async function handleRemoveSubmit(interaction) {
  const userId = interaction.fields.getTextInputValue('user_id');
  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!member) {
    return interaction.reply({ content: '❌ لم يتم العثور على هذا العضو في السيرفر.', ephemeral: true });
  }

  await interaction.channel.permissionOverwrites.delete(member.id);

  return interaction.reply({ content: `🚫 تم إزالة العضو <@${member.id}> من التذكرة بنجاح.` });
}

/**
 * Modal إعادة تسمية
 */
async function handleRenameModal(interaction, ticketId) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_rename_${ticketId}`)
    .setTitle('إعادة تسمية التذكرة');

  const nameInput = new TextInputBuilder()
    .setCustomId('channel_name')
    .setLabel('الاسم الجديد للقناة')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('أدخل الاسم الجديد...')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
  await interaction.showModal(modal);
}

async function handleRenameSubmit(interaction) {
  const newName = interaction.fields.getTextInputValue('channel_name');
  await interaction.channel.setName(newName.slice(0, 90));

  return interaction.reply({ content: `✏️ تم تغيير اسم القناة إلى: **${newName}**` });
}

/**
 * التعامل مع الأزرار المخصصة
 */
async function handleCustom(interaction, rest) {
  const [ticketId, buttonId] = rest.split('_');
  const ticket = await Ticket.findById(ticketId);
  const button = ticketService.findSub(ticket?.customButtons, buttonId);

  if (!ticket || !button) {
    return interaction.reply({ 
      content: '❌ هذا الزر ما عاد موجود.', 
      ephemeral: true 
    });
  }

  const payload = buildV2Panel({
    description: `💬 <@${interaction.user.id}>\n${button.response}`,
    image: button.image || null
  });

  return interaction.reply(payload);
}

/**
 * Router الشامل للتفاعلات
 */
async function route(interaction) {
  // 1. التعامل مع القوائم المنسدلة (Menu)
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_actions_menu_')) {
    const selectedValue = interaction.values[0];
    if (selectedValue.startsWith('ticket_claim_')) return handleClaim(interaction, selectedValue.replace('ticket_claim_', ''));
    if (selectedValue.startsWith('ticket_call_')) return handleCallAdmin(interaction, selectedValue.replace('ticket_call_', ''));
    if (selectedValue.startsWith('ticket_add_')) return handleAddModal(interaction, selectedValue.replace('ticket_add_', ''));
    if (selectedValue.startsWith('ticket_remove_')) return handleRemoveModal(interaction, selectedValue.replace('ticket_remove_', ''));
    if (selectedValue.startsWith('ticket_rename_')) return handleRenameModal(interaction, selectedValue.replace('ticket_rename_', ''));
    if (selectedValue.startsWith('ticket_transcript_')) return handleTranscript(interaction, selectedValue.replace('ticket_transcript_', ''));
    if (selectedValue.startsWith('ticket_close_')) return handleCloseRequest(interaction, selectedValue.replace('ticket_close_', ''));
    if (selectedValue.startsWith('ticket_delete_')) return handleDeleteTicket(interaction, selectedValue.replace('ticket_delete_', ''));
    if (selectedValue.startsWith('ticket_unclaim_')) return handleUnclaim(interaction, selectedValue.replace('ticket_unclaim_', ''));
    if (selectedValue.startsWith('ticket_restart_')) return handleRestart(interaction, selectedValue.replace('ticket_restart_', ''));
    if (selectedValue.startsWith('ticket_ratingnow_')) return handleManualRating(interaction, selectedValue.replace('ticket_ratingnow_', ''));
  }

  // 1.b التعامل مع قائمة "فتح تذكرة" السلكت (بدل الأزرار) في بانل الفتح
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_open_menu_')) {
    const panelId = interaction.customId.replace('ticket_open_menu_', '');
    return handleOpen(interaction, panelId, interaction.values[0]);
  }

  // 1.c التعامل مع قائمة تقييم الإدارة (تصل بالخاص بعد إغلاق التذكرة)
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_rate_')) {
    return handleRate(interaction, interaction.customId.replace('ticket_rate_', ''));
  }

  // 2. التعامل مع النوافذ التفاعلية (Modals)
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;
    if (id.startsWith('ticket_modal_add_')) return handleAddSubmit(interaction);
    if (id.startsWith('ticket_modal_remove_')) return handleRemoveSubmit(interaction);
    if (id.startsWith('ticket_modal_rename_')) return handleRenameSubmit(interaction);
    if (id.startsWith('ticket_rate_modal_')) {
      const rest = id.replace('ticket_rate_modal_', '');
      const score = Number(rest.slice(rest.lastIndexOf('_') + 1));
      const ticketId = rest.slice(0, rest.lastIndexOf('_'));
      return handleRateModalSubmit(interaction, ticketId, score);
    }
  }

  // 3. التعامل مع الأزرار (Buttons)
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id.startsWith('ticket_open_')) {
      const rest = id.replace('ticket_open_', '');
      const parts = rest.split('_');
      // الصيغة الجديدة: ticket_open_<panelId>_<buttonId>
      // الصيغة القديمة (رسائل منشورة قبل التحديث): ticket_open_<buttonId> أو ticket_open_default
      if (parts.length >= 2) {
        const buttonId = parts.pop();
        const panelId = parts.join('_');
        return handleOpen(interaction, panelId, buttonId);
      }
      return handleOpen(interaction, 'main', rest);
    }
    if (id.startsWith('ticket_claim_')) return handleClaim(interaction, id.replace('ticket_claim_', ''));
    if (id.startsWith('ticket_call_')) return handleCallAdmin(interaction, id.replace('ticket_call_', ''));
    if (id.startsWith('ticket_add_')) return handleAddModal(interaction, id.replace('ticket_add_', ''));
    if (id.startsWith('ticket_remove_')) return handleRemoveModal(interaction, id.replace('ticket_remove_', ''));
    if (id.startsWith('ticket_rename_')) return handleRenameModal(interaction, id.replace('ticket_rename_', ''));
    if (id.startsWith('ticket_transcript_')) return handleTranscript(interaction, id.replace('ticket_transcript_', ''));
    if (id.startsWith('ticket_close_confirm_')) return handleCloseConfirm(interaction, id.replace('ticket_close_confirm_', ''));
    if (id.startsWith('ticket_close_cancel_')) return handleCloseCancel(interaction, id.replace('ticket_close_cancel_', ''));
    if (id.startsWith('ticket_close_undo_')) return handleCloseUndo(interaction, id.replace('ticket_close_undo_', ''));
    if (id.startsWith('ticket_close_')) return handleCloseRequest(interaction, id.replace('ticket_close_', ''));
    // الترتيب مهم: الأطول أولًا (existing/confirm/cancel) قبل ticket_delete_ العامة.
    if (id.startsWith('ticket_delete_existing_')) return handleDeleteTicket(interaction, id.replace('ticket_delete_existing_', ''));
    if (id.startsWith('ticket_delete_confirm_')) return handleDeleteTicket(interaction, id.replace('ticket_delete_confirm_', ''));
    if (id.startsWith('ticket_delete_cancel_')) return handleDeleteCancel(interaction);
    if (id.startsWith('ticket_delete_')) return handleDeleteRequest(interaction, id.replace('ticket_delete_', ''));
    if (id.startsWith('ticket_custom_')) return handleCustom(interaction, id.replace('ticket_custom_', ''));
  }

  return false;
}

module.exports = { route };