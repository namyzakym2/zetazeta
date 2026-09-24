const { AttachmentBuilder } = require('discord.js');
const captchaService = require('../services/captchaService');
const economyService = require('../services/economyService');
const logService = require('../services/logService');
const { formatMoney } = require('../utils/formatMoney');
const { buildV2Panel } = require('../utils/componentsV2');

/**
 * publicCaptchaTransfer — the shared engine behind every VC transfer, whether started
 * from the /wallet slash command or the "c" prefix shortcut. There is no button and no
 * modal: the captcha image posts PUBLICLY in the channel, and the sender confirms by
 * typing the code as a normal chat message — handleMessage() below is wired into
 * messageCreate.js and checks every incoming message against it.
 */

// Anti-fraud: accounts younger than this can't send transfers. Uses each Discord
// user's real account-creation timestamp (from their snowflake ID via discord.js's
// built-in `createdTimestamp`), not anything client-supplied.
const MIN_ACCOUNT_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Runs all pre-checks (self-transfer, bot target, invalid amount, account age,
 * sufficient balance) and, if everything passes, posts the public captcha image in
 * `channel` and registers the pending transfer. Returns one of:
 *   { ok: true }
 *   { error: 'SELF' | 'BOT' | 'INVALID_AMOUNT' | 'ACCOUNT_TOO_NEW' | 'INSUFFICIENT' }
 */
async function requestTransfer({ channel, sender, target, amount, reason, guildId }) {
  if (target.id === sender.id) return { error: 'SELF' };
  if (target.bot) return { error: 'BOT' };
  if (!Number.isInteger(amount) || amount <= 0) return { error: 'INVALID_AMOUNT' };

  const accountAge = Date.now() - sender.createdTimestamp;
  if (accountAge < MIN_ACCOUNT_AGE_MS) {
    return { error: 'ACCOUNT_TOO_NEW' };
  }

  const senderWallet = await economyService.getOrCreateWallet(sender.id);
  if (senderWallet.blacklisted) return { error: 'SENDER_BLACKLISTED' };
  if (senderWallet.balance < amount) return { error: 'INSUFFICIENT' };

  const guildDoc = await economyService.getGuildSettings(guildId);
  const taxPercent = guildDoc.transferTaxPercent ?? 2.5;
  const estimatedNet = Math.floor(amount - amount * (taxPercent / 100));

  const { imageBuffer } = captchaService.createTransferRequest({
    guildId,
    channelId: channel.id,
    fromUserId: sender.id,
    toUserId: target.id,
    amount,
    reason
  });

  const attachment = new AttachmentBuilder(imageBuffer, { name: 'captcha.png' });

  const panel = buildV2Panel({
    title: '🔐 تأكيد التحويل / Confirm Transfer',
    description:
      `<@${sender.id}> على وشك تحويل **${formatMoney(amount)}** إلى <@${target.id}>\n` +
        `السبب: ${reason}\n` +
        `الضريبة: ${taxPercent}% — تقريبًا **${formatMoney(estimatedNet)}** هيوصل فعليًا\n\n` +
        `✏️ اكتب الرمز الظاهر في الصورة هنا في نفس الشات خلال دقيقتين لتأكيد التحويل.`,
    color: '#0f2158',
    image: 'attachment://captcha.png'
  });

  const sentMessage = await channel.send({ ...panel, files: [attachment] });
  // Record which message actually holds the captcha image so it can be deleted once
  // the transfer resolves (success or definitive failure) — see deleteCaptchaImage().
  captchaService.attachMessage(channel.id, sender.id, sentMessage.id);

  return { ok: true };
}

/**
 * Best-effort delete of the public captcha image message. Safe to call even if the
 * message was already removed or the bot lacks permission — never throws.
 */
async function deleteCaptchaImage(channel, messageId) {
  if (!messageId) return;
  try {
    const msg = channel.messages.cache.get(messageId) || (await channel.messages.fetch(messageId));
    await msg.delete();
  } catch {
    // Already deleted, or missing Manage Messages — nothing more we can do.
  }
}

/**
 * Called from messageCreate.js for EVERY message. If the author has a pending public
 * captcha transfer in this exact channel, this message is treated as their code
 * attempt. Returns true if the message was consumed as a captcha response (caller
 * should stop further processing of it — activity XP, shortcuts, automod, etc — since
 * it's a confirmation code, not a normal chat message).
 */
async function handleMessage(message) {
  const pendingEntry = captchaService.getPending(message.channel.id, message.author.id);
  if (!pendingEntry) return false;

  let entry;
  try {
    entry = captchaService.verifyAndConsume(message.channel.id, message.author.id, message.content);
  } catch (err) {
    if (err.message === 'INVALID_CODE') {
      // Wrong code but attempts remain — the captcha image is still valid, keep it up.
      await message.reply(`❌ رمز غلط. حاول تاني (محاولات متبقية: ${err.attemptsLeft}).`).catch(() => {});
      return true;
    }
    if (err.message === 'MAX_ATTEMPTS_REACHED') {
      // Definitive failure — delete the captcha image, the transfer is dead.
      await deleteCaptchaImage(message.channel, err.messageId);
      await message.reply('❌ تجاوزت عدد المحاولات المسموح بها. اتلغى التحويل — ابدأ من جديد.').catch(() => {});
      return true;
    }
    return false; // expired/not found — let the message pass through normally
  }

  const { guildId, fromUserId, toUserId, amount, reason, messageId: captchaMessageId } = entry;

  let result;
  try {
    result = await economyService.transfer(guildId, fromUserId, toUserId, amount);
  } catch (err) {
    // Code matched but the transfer itself failed at confirm time — still a
    // definitive outcome, so the captcha image comes down either way.
    await deleteCaptchaImage(message.channel, captchaMessageId);
    if (err.message === 'INSUFFICIENT_FUNDS') {
      await message.reply('❌ رصيدك ما عاد كافي وقت التأكيد — اتلغى التحويل.').catch(() => {});
    } else if (err.message === 'SENDER_BLACKLISTED') {
      await message.reply('❌ حسابك ممنوع من تحويل Zeta حاليًا.').catch(() => {});
    } else {
      await message.reply('❌ ' + err.message).catch(() => {});
    }
    return true;
  }

  // Transfer succeeded — captcha image has done its job, clean it up.
  await deleteCaptchaImage(message.channel, captchaMessageId);

  const { netAmount, taxAmount } = result;

  await logService.log(message.client, guildId, 'dcTransfer', {
    From: `<@${fromUserId}>`,
    To: `<@${toUserId}>`,
    Gross: formatMoney(amount),
    Tax: formatMoney(taxAmount),
    Net: formatMoney(netAmount),
    Reason: reason || 'No reason provided'
  });

  await message
    .reply(`✅ مبروك! 💰 | **<@${fromUserId}>, has transferred \`${netAmount} Zeta\` 😈to <@${toUserId}>**`)
    .catch(() => {});

  // DM the recipient a Transfer Receipt.
  try {
    const recipientUser = await message.client.users.fetch(toUserId);
    const senderUser = await message.client.users.fetch(fromUserId);
    const recipientWallet = await economyService.getOrCreateWallet(toUserId);
    const guildDoc = await economyService.getGuildSettings(guildId);

    const receipt =
      `🏧 | Transfer Receipt\n` +
      '```\n' +
      `You have received ${formatMoney(netAmount)} from ${senderUser.tag} (ID: ${senderUser.id})\n` +
      `Reason: ${reason || 'No reason provided'}\n` +
      `Tax: ${guildDoc.transferTaxPercent}% (${formatMoney(taxAmount)}) was deducted from this transfer.\n` +
      `New Global Balance: ${formatMoney(recipientWallet.balance)}\n` +
      '```';

    await recipientUser.send(receipt);
  } catch {
    // Recipient may have DMs closed — the transfer itself already succeeded.
  }

  return true;
}

module.exports = { requestTransfer, handleMessage, MIN_ACCOUNT_AGE_MS };
