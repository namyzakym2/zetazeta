const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require('axios');

const { ensureCanvasFonts, fontSpec, a7medFontSpec } = require('./canvasFonts');
/**
 * profileCard — Renders the profile rank card.
 *  - Small top-center circle  -> SERVER Icon (guildIconURL)
 *  - Big left circle badge    -> MEMBER Avatar (avatarURL)
 *  - Right curved panel       -> Decorative Background
 *  - Left column              -> LVL / VC / RANK
 *  - Bottom pill              -> XP Progress Bar
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

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r;
  ctx.beginPath();
  ctx.moveTo(x + rad.tl, y);
  ctx.lineTo(x + w - rad.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad.tr);
  ctx.lineTo(x + w, y + h - rad.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad.br, y + h);
  ctx.lineTo(x + rad.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad.bl);
  ctx.lineTo(x, y + rad.tl);
  ctx.quadraticCurveTo(x, y, x + rad.tl, y);
  ctx.closePath();
}

function formatShort(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000) return (n % 1_000_000 === 0 ? n / 1_000_000 : (n / 1_000_000).toFixed(1)) + 'M';
  if (n >= 1_000) return (n % 1_000 === 0 ? n / 1_000 : (n / 1_000).toFixed(1)) + 'K';
  return String(n);
}

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

async function generateProfileCard({
  username,
  avatarURL,
  guildIconURL,
  level = 0,
  xp = 0,
  xpNeeded = 200,
  dc = 0,
  rank = null,
  backgroundURL = ''
}) {
  const W = 1000, H = 1000;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // 1. خلفية الصفحة الرئيسية — صورة رفعها العضو من جهازه (إن وجدت)، وإلا اللون الافتراضي
  const bgImg = backgroundURL ? await fetchImage(backgroundURL) : null;
  if (bgImg) {
    drawImageCover(ctx, bgImg, 0, 0, W, H);
    // تعتيم خفيف عشان النصوص والعناصر تبقى واضحة فوق أي صورة
    ctx.fillStyle = 'rgba(3,6,17,0.55)';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#030611';
    ctx.fillRect(0, 0, W, H);
  }

  // 2. الكارد الخارجي — شبه شفاف لو فيه خلفية مخصصة عشان الصورة تبان، معتم عادي لو ما فيه
  roundRectPath(ctx, 20, 20, W - 40, H - 40, 40);
  ctx.fillStyle = bgImg ? 'rgba(9,15,30,0.45)' : '#090f1e';
  ctx.fill();

  // 3. الإطار الداخلي الأزرق
  roundRectPath(ctx, 35, 35, W - 70, H - 70, 32);
  ctx.strokeStyle = '#152442';
  ctx.lineWidth = 4;
  ctx.stroke();

  // ---- 4. اللوحة الكبيرة المموجة (يمين الكارد) ----
  const panelX = 270, panelY = 210, panelW = 680, panelH = 720;
  
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(panelX + 80, panelY);
  ctx.bezierCurveTo(panelX + 300, panelY - 30, panelX + 500, panelY + 60, panelX + panelW, panelY + 20);
  ctx.lineTo(panelX + panelW, panelY + panelH - 40);
  ctx.quadraticCurveTo(panelX + panelW, panelY + panelH, panelX + panelW - 40, panelY + panelH);
  ctx.lineTo(panelX + 40, panelY + panelH);
  ctx.quadraticCurveTo(panelX - 10, panelY + panelH, panelX - 10, panelY + panelH - 40);
  ctx.bezierCurveTo(panelX - 10, panelY + 400, panelX + 160, panelY + 300, panelX + 80, panelY);
  ctx.closePath();
  ctx.clip();

  // خلفية نيون متموجة للوحة اليمنى
  const bgGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
  bgGrad.addColorStop(0, '#1d2b53');
  bgGrad.addColorStop(0.5, '#121d38');
  bgGrad.addColorStop(1, '#0e1628');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(panelX - 20, panelY - 20, panelW + 40, panelH + 40);
  ctx.restore();

  // ---- 5. الدائرة الصغيرة فوق في الوسط: صورة السيرفر (SERVER ICON) ----
  const topX = 520, topY = 38, topR = 40;
  
  ctx.save();
  ctx.beginPath();
  ctx.arc(topX, topY, topR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const guildImg = await fetchImage(guildIconURL);
  if (guildImg) {
    ctx.drawImage(guildImg, topX - topR, topY - topR, topR * 2, topR * 2);
  } else {
    ctx.fillStyle = '#030611';
    ctx.fillRect(topX - topR, topY - topR, topR * 2, topR * 2);
  }
  ctx.restore();

  // إطار الدائرة العلوية
  ctx.beginPath();
  ctx.arc(topX, topY, topR, 0, Math.PI * 2);
  ctx.strokeStyle = '#152442';
  ctx.lineWidth = 4;
  ctx.stroke();

  // ---- 6. الدائرة الكبيرة (أعلى اليسار): صورة بروفايل العضو (USER AVATAR) ----
  const avX = 195, avY = 175, avR = 140;
  
  // ظل الدائرة
  ctx.beginPath();
  ctx.arc(avX + 4, avY + 6, avR + 10, 0, Math.PI * 2);
  ctx.fillStyle = '#030611';
  ctx.fill();

  // قص دائري ورسم الأفاتار
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

  // إطار نيون للأفاتار
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 6;
  ctx.stroke();

  // ---- 7. اسم المستخدم (USERNAME) ----
  const shownName = username && username.length > 13 ? username.slice(0, 12) + '…' : (username || 'user');
  ctx.fillStyle = '#38bdf8';
  // Use the A7med-style display font for Latin names; keep Arabic/CJK fallback.
  const hasArabicOrCjk = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/u.test(shownName);
  ctx.font = hasArabicOrCjk ? fontSpec('bold', 64, shownName) : a7medFontSpec('bold', 64);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(shownName, 400, 175);

  // ---- 8. الإحصائيات (LVL / VC / RANK) على اليسار ----
  function drawStat(labelY, label, valueY, value) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = fontSpec('bold', 30, label);
    ctx.textAlign = 'left';
    ctx.fillText(label, 65, labelY);

    ctx.fillStyle = '#00a3ff';
    ctx.font = fontSpec('bold', 58, value);
    ctx.fillText(value, 65, valueY);
  }

  drawStat(420, 'LVL', 475, String(level));
  drawStat(575, 'Zeta', 630, formatShort(dc));
  drawStat(730, 'RANK', 785, rank ? `#${rank}` : '—');

  // ---- 9. شريط تقدم الـ XP (البار الأسفل) ----
  const barX = 415, barY = 815, barW = 490, barH = 52;

  roundRectPath(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = '#060b17';
  ctx.fill();
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 3;
  ctx.stroke();

  const pct = xpNeeded > 0 ? Math.max(0, Math.min(1, xp / xpNeeded)) : 0;
  if (pct > 0) {
    const fillW = Math.max(barH, barW * pct);
    roundRectPath(ctx, barX, barY, fillW, barH, barH / 2);
    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    barGrad.addColorStop(0, '#1d4ed8');
    barGrad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = barGrad;
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = fontSpec('bold', 26, `${formatShort(xp)} / ${formatShort(xpNeeded)}`);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${formatShort(xp)} / ${formatShort(xpNeeded)}`, barX + barW / 2, barY + barH / 2);

  return canvas.toBuffer('image/png');
}

module.exports = { generateProfileCard };