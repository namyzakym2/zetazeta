const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

const { ensureCanvasFonts, fontSpec } = require('./canvasFonts');
/**
 * welcomeCard — renders a welcome banner image (background photo the server admin
 * uploaded from the dashboard, + member avatar, name, and member count overlaid on
 * top). Used by src/systems/welcome.js whenever guildDoc.welcome.backgroundImage is
 * set; falls back to the old plain-text embed otherwise.
 */

ensureCanvasFonts();

async function fetchImage(url) {
  if (!url) return null;
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return await loadImage(Buffer.from(res.data));
  } catch (err) {
    return null;
  }
}

/**
 * Draws `img` covering the full w x h box (like CSS background-size: cover),
 * cropping whatever overflows instead of stretching it.
 */
function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx, sy, sw, sh;

  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Simple word-wrap: splits `text` into lines that fit within `maxWidth`, drawn with
 * the ctx's currently-set font. Returns the lines (doesn't draw anything itself).
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Maps a "top|center|bottom-left|center|right" position string to avatar center coords.
function resolveAvatarCenter(position, W, H, avR) {
  const pad = avR + 40;
  const [vPos, hPos] = (position || 'top-center').split('-');
  const x = hPos === 'left' ? pad : hPos === 'right' ? W - pad : W / 2;
  const y = vPos === 'center' ? H / 2 : vPos === 'bottom' ? H - pad : pad + 30;
  return { x, y };
}

// Precise placement from the dashboard's drag-to-position (or typed X/Y) picker.
// avatarX/avatarY are percentages (0-100) of the card's width/height, clamped so
// the circle (+ its shadow ring) can never be drawn partly off the card.
function resolveAvatarCenterExact(avatarX, avatarY, W, H, avR) {
  const pad = avR + 8;
  const rawX = (avatarX / 100) * W;
  const rawY = (avatarY / 100) * H;
  const x = Math.min(Math.max(rawX, pad), W - pad);
  const y = Math.min(Math.max(rawY, pad), H - pad);
  return { x, y };
}

async function generateWelcomeCard({
  backgroundURL,
  avatarURL,
  username,
  serverName,
  memberCount,
  cardText = '',
  avatarPosition = 'top-center',
  avatarX = null,
  avatarY = null
}) {
  const W = 1200, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background — uploaded image (cover-fit) or a dark gradient fallback if it
  // failed to load (e.g. the URL went dead).
  const bgImg = await fetchImage(backgroundURL);
  if (bgImg) {
    drawImageCover(ctx, bgImg, 0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1d2b53');
    grad.addColorStop(1, '#0e1628');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Dark overlay so text stays readable over any background photo.
  const overlay = ctx.createLinearGradient(0, 0, 0, H);
  overlay.addColorStop(0, 'rgba(3,6,17,0.35)');
  overlay.addColorStop(0.6, 'rgba(3,6,17,0.55)');
  overlay.addColorStop(1, 'rgba(3,6,17,0.85)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  // Avatar circle — position chosen by the server admin from the dashboard, either
  // by dragging the marker on the preview / typing exact X-Y% (avatarX/avatarY,
  // preferred when set) or via the legacy 9-spot preset (avatarPosition).
  const avR = 90;
  const hasExactPosition = typeof avatarX === 'number' && typeof avatarY === 'number';
  const { x: avX, y: avY } = hasExactPosition
    ? resolveAvatarCenterExact(avatarX, avatarY, W, H, avR)
    : resolveAvatarCenter(avatarPosition, W, H, avR);

  ctx.beginPath();
  ctx.arc(avX + 3, avY + 5, avR + 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const avatarImg = await fetchImage(avatarURL);
  if (avatarImg) {
    ctx.drawImage(avatarImg, avX - avR, avY - avR, avR * 2, avR * 2);
  } else {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Text block — placed opposite the avatar's vertical position so they never
  // overlap (avatar near bottom → text near top, otherwise text near bottom).
  const avatarIsBottom = hasExactPosition ? avY > H / 2 : (avatarPosition || '').startsWith('bottom');
  const textCenterY = avatarIsBottom ? 90 : H - 90;

  if (cardText && cardText.trim()) {
    // Custom text the admin typed in the dashboard, with the same {mention}/
    // {username}/{server}/{membercount} placeholders as the regular welcome message.
    const resolved = cardText
      .replaceAll('{mention}', username || '')
      .replaceAll('{username}', username || '')
      .replaceAll('{server}', serverName || '')
      .replaceAll('{membercount}', String(memberCount ?? ''));

    ctx.fillStyle = '#ffffff';
    ctx.font = fontSpec('bold', 40, resolved);
    const lines = wrapText(ctx, resolved, W - 160).slice(0, 3); // cap at 3 lines so it can't run off the card
    const lineHeight = 50;
    const startY = textCenterY - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * lineHeight));
  } else {
    // Default look — unchanged from before.
    ctx.fillStyle = '#38bdf8';
    ctx.font = fontSpec('bold', 28, 'WELCOME');
    ctx.fillText('WELCOME', W / 2, textCenterY - 50);

    const shownName = username && username.length > 22 ? username.slice(0, 21) + '…' : (username || 'user');
    ctx.fillStyle = '#ffffff';
    ctx.font = fontSpec('bold', 46, shownName);
    ctx.fillText(shownName, W / 2, textCenterY);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = fontSpec('normal', 26, `${serverName || ''} · العضو رقم ${memberCount ?? '—'}`);
    ctx.fillText(`${serverName || ''} · العضو رقم ${memberCount ?? '—'}`, W / 2, textCenterY + 50);
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateWelcomeCard };