const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const GuildModel = require('../models/Guild');
const RankOrder = require('../models/RankOrder');
const logService = require('./logService');
const { setEmojiSafe } = require('../utils/emoji');
const { buildV2Panel } = require('../utils/componentsV2');

/**
 * بطاقة متجر الرتب — تُرسل عبر /rank-shop panel. قائمة منسدلة واحدة تحتوي كل
 * الرتب المعروضة (حتى 25 — حد الديسكورد لكل قائمة).
 */
function buildShopPanel(guildDoc) {
  const ranks = guildDoc.rankShop?.ranks || [];
  const currency = guildDoc.rankShop?.currency || '';

  const rows = [];
  if (ranks.length) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('rankshop_buy_select')
      .setPlaceholder('🛒 اختر رتبة للشراء...')
      .addOptions(
        ranks.slice(0, 25).map((r) => ({
          label: r.name.slice(0, 100),
          description: `${r.price} ${currency}`.slice(0, 100),
          value: r._id.toString()
        }))
      );
    rows.push(new ActionRowBuilder().addComponents(menu));
  }

  return buildV2Panel({
    title: '🛍️ متجر الرتب',
    color: '#0f2158',
    description:
      ranks.length
        ? 'اختر الرتبة التي ترغب بشرائها من القائمة أدناه 👇\nسيتم فتح روم خاص بك فيه تفاصيل الدفع.'
        : 'لا توجد رتب معروضة للبيع حاليًا.',
    fields: ranks.length
      ? ranks.slice(0, 25).map((r) => ({
          name: `${r.name} — ${r.price} ${currency}`,
          value: r.description || '\u200b'
        }))
      : [],
    timestamp: true,
    rows
  });
}

function buildOrderPanel(guildDoc, rank, order, rows = [], pingContent) {
  const bank = guildDoc.rankShop?.bank || {};
  const currency = guildDoc.rankShop?.currency || '';

  const bankLines = [
    bank.bankName ? `• **البنك:** ${bank.bankName}` : null,
    bank.accountHolder ? `• **صاحب الحساب:** ${bank.accountHolder}` : null,
    bank.accountNumber ? `• **رقم الحساب:** \`${bank.accountNumber}\`` : null,
    bank.notes ? `• **ملاحظات:** ${bank.notes}` : null
  ].filter(Boolean);

  return buildV2Panel({
    pingContent,
    title: `🛒 طلب شراء رتبة: ${rank.name}`,
    color: '#0f2158',
    description:
      `أهلًا بك! أنت على وشك شراء رتبة **${rank.name}**.\n\n` +
        `💰 **السعر:** ${rank.price} ${currency}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `**🏦 معلومات التحويل**\n` +
        (bankLines.length ? bankLines.join('\n') : 'لم يتم تحديد معلومات البنك بعد، تواصل مع الإدارة.') +
        `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `1️⃣ حوّل المبلغ إلى الحساب أعلاه.\n` +
        `2️⃣ اضغط زر **"لقد حوّلت"** بعد إتمام التحويل.\n` +
        `3️⃣ انتظر تأكيد الإدارة ليتم تسليمك الرتبة.`,
    fields: rank.description ? [{ name: 'وصف الرتبة', value: rank.description }] : [],
    footer: `رقم الطلب: ${order._id}`,
    timestamp: true,
    rows
  });
}

function buildOrderComponents() {
  const row = new ActionRowBuilder();

  const paidBtn = new ButtonBuilder()
    .setCustomId(`rankshop_paid_${'{ORDER_ID}'}`)
    .setLabel('لقد حوّلت')
    .setStyle(ButtonStyle.Success);
  setEmojiSafe(paidBtn, '✅');

  const confirmBtn = new ButtonBuilder()
    .setCustomId(`rankshop_confirm_${'{ORDER_ID}'}`)
    .setLabel('تأكيد وتسليم الرتبة')
    .setStyle(ButtonStyle.Primary);
  setEmojiSafe(confirmBtn, '🎁');

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`rankshop_cancel_${'{ORDER_ID}'}`)
    .setLabel('إلغاء الطلب')
    .setStyle(ButtonStyle.Danger);
  setEmojiSafe(cancelBtn, '❌');

  row.addComponents(paidBtn, confirmBtn, cancelBtn);
  return row;
}

// (Placeholder ids above get swapped for the real order id right after creation —
// simplest way to reuse one builder without threading the id through every arg.)
function componentsForOrder(orderId) {
  const row = buildOrderComponents();
  for (const btn of row.components) {
    btn.data.custom_id = btn.data.custom_id.replace('{ORDER_ID}', orderId.toString());
  }
  return [row];
}

async function countOpenOrders(guildId, buyerId) {
  return RankOrder.countDocuments({ guildId, buyerId, status: 'pending' });
}

async function createOrderRoom(guild, member, rankId) {
  const guildDoc = await GuildModel.findOne({ guildId: guild.id });
  if (!guildDoc?.rankShop?.enabled) throw new Error('SHOP_DISABLED');

  const rank = guildDoc.rankShop.ranks.id(rankId);
  if (!rank) throw new Error('RANK_NOT_FOUND');

  if (member.roles.cache.has(rank.roleId)) throw new Error('ALREADY_OWNED');

  const existing = await RankOrder.findOne({
    guildId: guild.id,
    buyerId: member.id,
    roleId: rank.roleId,
    status: 'pending'
  });
  if (existing) {
    const channel = guild.channels.cache.get(existing.channelId);
    if (channel) {
      const err = new Error('ORDER_ALREADY_OPEN');
      err.channel = channel;
      throw err;
    }
    // Room got deleted somehow without going through our flow — clean up and retry.
    existing.status = 'cancelled';
    await existing.save();
  }

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: guild.members.me.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
    }
  ];
  if (guildDoc.rankShop.staffRoleId) {
    overwrites.push({
      id: guildDoc.rankShop.staffRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  const safeName = `rank-${member.user.username}`
    .toLowerCase()
    .replace(/[^a-z0-9أ-ي\-]+/gi, '-')
    .slice(0, 90);

  const channel = await guild.channels.create({
    name: safeName || `rank-${member.id}`,
    type: ChannelType.GuildText,
    parent: guildDoc.rankShop.categoryId || undefined,
    permissionOverwrites: overwrites
  });

  const order = await RankOrder.create({
    guildId: guild.id,
    channelId: channel.id,
    buyerId: member.id,
    rankId: rank._id.toString(),
    roleId: rank.roleId,
    rankName: rank.name,
    price: rank.price
  });

  const components = componentsForOrder(order._id);

  let pingContent = `<@${member.id}>`;
  if (guildDoc.rankShop.staffRoleId) pingContent += ` <@&${guildDoc.rankShop.staffRoleId}>`;

  const panel = buildOrderPanel(guildDoc, rank, order, components, pingContent);
  await channel.send(panel);

  await logService.log(guild.client, guild.id, 'rankShopOrderCreate', {
    Buyer: `<@${member.id}>`,
    Rank: rank.name,
    Price: `${rank.price} ${guildDoc.rankShop.currency || ''}`,
    Channel: `<#${channel.id}>`
  });

  return { channel, order, guildDoc };
}

async function markPaid(guild, orderId, buyerUser) {
  const order = await RankOrder.findById(orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status !== 'pending') throw new Error('ORDER_NOT_PENDING');
  if (order.buyerId !== buyerUser.id) throw new Error('NOT_BUYER');

  order.markedPaidAt = new Date();
  await order.save();

  await logService.log(guild.client, guild.id, 'rankShopOrderPaidMarked', {
    Buyer: `<@${order.buyerId}>`,
    Rank: order.rankName,
    Channel: `<#${order.channelId}>`
  });

  return order;
}

async function confirmOrder(guild, orderId, moderator) {
  const order = await RankOrder.findById(orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status === 'confirmed') throw new Error('ALREADY_CONFIRMED');
  if (order.status === 'cancelled') throw new Error('ORDER_CANCELLED');

  const buyerMember = await guild.members.fetch(order.buyerId).catch(() => null);
  if (!buyerMember) throw new Error('MEMBER_NOT_FOUND');

  const role = guild.roles.cache.get(order.roleId);
  if (!role) throw new Error('ROLE_NOT_FOUND');

  const botMember = guild.members.me;
  if (role.position >= botMember.roles.highest.position) throw new Error('ROLE_TOO_HIGH');

  if (!buyerMember.roles.cache.has(role.id)) {
    await buyerMember.roles.add(role, `Rank purchase confirmed by ${moderator.tag}`);
  }

  order.status = 'confirmed';
  order.confirmedBy = moderator.id;
  order.confirmedAt = new Date();
  await order.save();

  await logService.log(guild.client, guild.id, 'rankShopConfirmed', {
    Buyer: `<@${order.buyerId}>`,
    Rank: order.rankName,
    Price: order.price,
    Moderator: `<@${moderator.id}>`
  });

  return order;
}

async function cancelOrder(guild, orderId, actorUser, { force = false } = {}) {
  const order = await RankOrder.findById(orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.status !== 'pending') throw new Error('ORDER_NOT_PENDING');

  const isBuyer = order.buyerId === actorUser.id;
  if (!isBuyer && !force) throw new Error('NOT_ALLOWED');

  order.status = 'cancelled';
  await order.save();

  await logService.log(guild.client, guild.id, 'rankShopCancelled', {
    Buyer: `<@${order.buyerId}>`,
    Rank: order.rankName,
    By: `<@${actorUser.id}>`
  });

  return order;
}

/**
 * منح يدوي — لأي حالة دفع خارج التذكرة (تحويل تم التأكد منه بطريقة أخرى، هدية، إلخ).
 * إذا كان هناك طلب مفتوح مطابق يتم تأكيده تلقائيًا حتى تُغلق غرفته بشكل نظيف.
 */
async function manualGrant(guild, targetMember, role, moderator) {
  if (targetMember.roles.cache.has(role.id)) throw new Error('ALREADY_OWNED');

  const botMember = guild.members.me;
  if (role.position >= botMember.roles.highest.position) throw new Error('ROLE_TOO_HIGH');

  await targetMember.roles.add(role, `Rank granted manually by ${moderator.tag}`);

  const order = await RankOrder.findOne({
    guildId: guild.id,
    buyerId: targetMember.id,
    roleId: role.id,
    status: 'pending'
  });
  if (order) {
    order.status = 'confirmed';
    order.confirmedBy = moderator.id;
    order.confirmedAt = new Date();
    await order.save();
  }

  await logService.log(guild.client, guild.id, 'rankShopManualGrant', {
    Buyer: `<@${targetMember.id}>`,
    Role: `<@&${role.id}>`,
    Moderator: `<@${moderator.id}>`
  });

  return order;
}

async function manualRevoke(guild, targetMember, role, moderator) {
  if (!targetMember.roles.cache.has(role.id)) throw new Error('NOT_OWNED');

  await targetMember.roles.remove(role, `Rank revoked manually by ${moderator.tag}`);

  await logService.log(guild.client, guild.id, 'rankShopRevoke', {
    Buyer: `<@${targetMember.id}>`,
    Role: `<@&${role.id}>`,
    Moderator: `<@${moderator.id}>`
  });
}

module.exports = {
  buildShopPanel,
  createOrderRoom,
  markPaid,
  confirmOrder,
  cancelOrder,
  manualGrant,
  manualRevoke,
  countOpenOrders
};
