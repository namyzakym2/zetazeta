const { PermissionFlagsBits } = require('discord.js');
const rankShopService = require('../services/rankShopService');

const CLOSE_DELAY_MS = 10_000;

async function handleBuySelect(interaction) {
  const rankId = interaction.values[0];
  await interaction.deferReply({ ephemeral: true });

  try {
    const { channel } = await rankShopService.createOrderRoom(interaction.guild, interaction.member, rankId);
    return interaction.editReply({ content: `✅ تم فتح روم خاص لإتمام عملية الشراء: ${channel}` });
  } catch (err) {
    if (err.message === 'SHOP_DISABLED') {
      return interaction.editReply({ content: '❌ متجر الرتب غير مفعّل حاليًا.' });
    }
    if (err.message === 'RANK_NOT_FOUND') {
      return interaction.editReply({ content: '❌ هذه الرتبة لم تعد متوفرة، جرّب تحديث القائمة.' });
    }
    if (err.message === 'ALREADY_OWNED') {
      return interaction.editReply({ content: '❌ أنت تمتلك هذه الرتبة بالفعل.' });
    }
    if (err.message === 'ORDER_ALREADY_OPEN') {
      return interaction.editReply({ content: `⚠️ لديك طلب شراء مفتوح بالفعل: ${err.channel}` });
    }
    console.error('[rankShop] createOrderRoom error:', err);
    return interaction.editReply({ content: '❌ حدث خطأ أثناء فتح روم الشراء.' });
  }
}

async function handlePaid(interaction, orderId) {
  try {
    await rankShopService.markPaid(interaction.guild, orderId, interaction.user);
    return interaction.reply({
      content: `✅ <@${interaction.user.id}> أكّد أنه قام بالتحويل. بانتظار مراجعة الإدارة 🔎`
    });
  } catch (err) {
    if (err.message === 'NOT_BUYER') {
      return interaction.reply({ content: '❌ هذا الزر مخصص لصاحب الطلب فقط.', ephemeral: true });
    }
    if (err.message === 'ORDER_NOT_PENDING') {
      return interaction.reply({ content: '❌ هذا الطلب لم يعد نشطًا.', ephemeral: true });
    }
    return interaction.reply({ content: '❌ تعذر تحديث الطلب.', ephemeral: true });
  }
}

async function handleConfirm(interaction, orderId) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: '❌ هذا الزر مخصص للإدارة فقط.', ephemeral: true });
  }

  try {
    const order = await rankShopService.confirmOrder(interaction.guild, orderId, interaction.user);
    await interaction.reply({
      content:
        `🎁 تم تأكيد الطلب وتسليم رتبة **${order.rankName}** إلى <@${order.buyerId}>!\n` +
        `سيتم إغلاق هذا الروم خلال 10 ثوانٍ.`
    });
    setTimeout(() => interaction.channel.delete().catch(() => {}), CLOSE_DELAY_MS);
  } catch (err) {
    const messages = {
      ORDER_NOT_FOUND: '❌ لم يتم العثور على الطلب.',
      ALREADY_CONFIRMED: '❌ هذا الطلب مؤكّد بالفعل.',
      ORDER_CANCELLED: '❌ هذا الطلب ملغي.',
      MEMBER_NOT_FOUND: '❌ العضو غير موجود في السيرفر.',
      ROLE_NOT_FOUND: '❌ الرتبة لم تعد موجودة.',
      ROLE_TOO_HIGH: '❌ هذه الرتبة أعلى من رتبة البوت، رتّب الرولات بشكل صحيح.'
    };
    return interaction.reply({ content: messages[err.message] || '❌ تعذر تأكيد الطلب.', ephemeral: true });
  }
}

async function handleCancel(interaction, orderId) {
  const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

  try {
    await rankShopService.cancelOrder(interaction.guild, orderId, interaction.user, { force: isStaff });
    await interaction.reply({
      content: `❌ تم إلغاء الطلب من قبل <@${interaction.user.id}>. سيتم إغلاق هذا الروم خلال 10 ثوانٍ.`
    });
    setTimeout(() => interaction.channel.delete().catch(() => {}), CLOSE_DELAY_MS);
  } catch (err) {
    if (err.message === 'NOT_ALLOWED') {
      return interaction.reply({ content: '❌ فقط صاحب الطلب أو الإدارة يقدرون يلغون هذا الطلب.', ephemeral: true });
    }
    if (err.message === 'ORDER_NOT_PENDING') {
      return interaction.reply({ content: '❌ هذا الطلب لم يعد نشطًا.', ephemeral: true });
    }
    return interaction.reply({ content: '❌ تعذر إلغاء الطلب.', ephemeral: true });
  }
}

/**
 * Router الشامل — يُستدعى من interactionCreate لأي زر/قائمة يبدأ بـ rankshop_.
 */
async function route(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === 'rankshop_buy_select') {
    return handleBuySelect(interaction);
  }

  if (interaction.isButton()) {
    const id = interaction.customId;
    if (id.startsWith('rankshop_paid_')) return handlePaid(interaction, id.replace('rankshop_paid_', ''));
    if (id.startsWith('rankshop_confirm_')) return handleConfirm(interaction, id.replace('rankshop_confirm_', ''));
    if (id.startsWith('rankshop_cancel_')) return handleCancel(interaction, id.replace('rankshop_cancel_', ''));
  }

  return false;
}

module.exports = { route };
