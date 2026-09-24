const { createCanvas } = require('@napi-rs/canvas');

const { ensureCanvasFonts, fontSpec } = require('../utils/canvasFonts');
/**
 * captchaService — protects VC transfers behind a scrambled-image code confirmation.
 * Pending transfers live in memory only (never persisted) and expire automatically.
 *
 * Confirmation is fully public and chat-based (no button, no modal): the captcha image
 * posts in the channel for everyone to see, and the sender confirms by typing the code
 * as a normal message in that same channel — messageCreate.js checks every incoming
 * message against this service. Because of that, pending transfers are keyed by
 * `channelId + fromUserId` (only one active transfer per person per channel at a time)
 * rather than a random ID tied to a button.
 */

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
const CODE_LENGTH = 6;
const EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const MAX_ATTEMPTS = 3;

const pending = new Map(); // `${channelId}:${fromUserId}` -> { code, guildId, channelId, fromUserId, toUserId, amount, reason, attempts, expiresAt }

// Periodic cleanup of expired/abandoned captchas.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pending.entries()) {
    if (entry.expiresAt < now) pending.delete(key);
  }
}, 30 * 1000).unref?.();

ensureCanvasFonts();

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[rand(0, CODE_CHARS.length - 1)];
  }
  return code;
}

function makeKey(channelId, fromUserId) {
  return `${channelId}:${fromUserId}`;
}

/**
 * Renders a distorted PNG (noise lines, random rotation/color per character, dot noise)
 * so the code can't be trivially OCR'd, and returns a Buffer ready for a Discord attachment.
 */
function renderCaptchaImage(code) {
  const width = 300;
  const height = 110;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#141014';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = `rgba(${rand(120, 255)},${rand(20, 90)},${rand(20, 90)},0.45)`;
    ctx.lineWidth = rand(1, 2);
    ctx.beginPath();
    ctx.moveTo(rand(0, width), rand(0, height));
    ctx.lineTo(rand(0, width), rand(0, height));
    ctx.stroke();
  }

  const cellWidth = width / code.length;
  for (let i = 0; i < code.length; i++) {
    ctx.save();
    const x = cellWidth * i + cellWidth / 2;
    const y = height / 2 + rand(-12, 12);
    ctx.translate(x, y);
    ctx.rotate((rand(-28, 28) * Math.PI) / 180);
    ctx.font = fontSpec('bold', rand(34, 46), code[i]);
    ctx.fillStyle = `rgb(${rand(190, 255)},${rand(60, 130)},${rand(60, 130)})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code[i], 0, 0);
    ctx.restore();
  }

  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`;
    ctx.fillRect(rand(0, width), rand(0, height), 2, 2);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Creates a new pending transfer confirmation for a specific channel + sender. Returns
 * { imageBuffer }. The actual VC movement does NOT happen until the sender's next
 * chat message in that channel matches the code (see verifyAndConsume).
 */
function createTransferRequest({ guildId, channelId, fromUserId, toUserId, amount, reason }) {
  const code = generateCode();

  pending.set(makeKey(channelId, fromUserId), {
    code,
    guildId,
    channelId,
    fromUserId,
    toUserId,
    amount,
    reason,
    attempts: 0,
    messageId: null, // set right after the captcha image is actually sent — see attachMessage()
    expiresAt: Date.now() + EXPIRY_MS
  });

  return { imageBuffer: renderCaptchaImage(code) };
}

/**
 * Records the ID of the message that carries the captcha image, once it's actually
 * been sent (createTransferRequest can't know it yet — the message doesn't exist
 * until after channel.send() returns). Lets handleMessage delete that image once the
 * transfer reaches a final outcome (success or definitive failure).
 */
function attachMessage(channelId, fromUserId, messageId) {
  const entry = pending.get(makeKey(channelId, fromUserId));
  if (entry) entry.messageId = messageId;
}

function getPending(channelId, fromUserId) {
  const key = makeKey(channelId, fromUserId);
  const entry = pending.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pending.delete(key);
    return null;
  }
  return entry;
}

/**
 * Verifies a user-submitted code (their plain chat message content) against the
 * pending captcha for that channel+user. On success, the entry is consumed (deleted)
 * and returned for the caller to actually execute the transfer. Throws
 * 'NOT_FOUND_OR_EXPIRED', 'MAX_ATTEMPTS_REACHED', or 'INVALID_CODE' (with .attemptsLeft).
 */
function verifyAndConsume(channelId, fromUserId, submittedCode) {
  const key = makeKey(channelId, fromUserId);
  const entry = getPending(channelId, fromUserId);
  if (!entry) {
    throw new Error('NOT_FOUND_OR_EXPIRED');
  }

  if (submittedCode.trim().toUpperCase() !== entry.code) {
    entry.attempts += 1;
    if (entry.attempts >= MAX_ATTEMPTS) {
      pending.delete(key);
      const err = new Error('MAX_ATTEMPTS_REACHED');
      // Definitive failure — carry the captcha message location so the caller can
      // delete the image (retries are no longer possible past this point).
      err.channelId = entry.channelId;
      err.messageId = entry.messageId;
      throw err;
    }
    const err = new Error('INVALID_CODE');
    err.attemptsLeft = MAX_ATTEMPTS - entry.attempts;
    throw err;
  }

  pending.delete(key);
  return entry;
}

function cancelPending(channelId, fromUserId) {
  pending.delete(makeKey(channelId, fromUserId));
}

module.exports = { createTransferRequest, attachMessage, getPending, verifyAndConsume, cancelPending, EXPIRY_MS, MAX_ATTEMPTS };