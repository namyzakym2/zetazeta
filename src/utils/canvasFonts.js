'use strict';

/**
 * ZETA Canvas font bootstrap.
 *
 * Bundled fonts:
 * - Noto Sans: Latin/European and broad Unicode coverage
 * - Noto Sans Arabic: Arabic-script text
 * - Noto Sans CJK: Chinese/Japanese/Korean glyph coverage
 *
 * @napi-rs/canvas exposes GlobalFonts.registerFromPath(), which registers
 * filesystem fonts before canvas text is rendered.
 */

const fs = require('fs');
const path = require('path');
let GlobalFonts = null;
try {
  ({ GlobalFonts } = require('@napi-rs/canvas'));
} catch (_) {
  // Font registration is optional; Canvas itself may still be available to the caller.
}

const FONT_DIR = path.join(__dirname, '../../assets/fonts');

const FONT_FILES = {
  latin: {
    normal: 'NotoSans-Regular.ttf',
    bold: 'NotoSans-Bold.ttf',
    family: 'ZETA Sans',
  },
  arabic: {
    normal: 'NotoSansArabic-Regular.ttf',
    bold: 'NotoSansArabic-Bold.ttf',
    family: 'ZETA Arabic',
  },
  cjk: {
    normal: 'NotoSansCJK-Regular.ttc',
    bold: 'NotoSansCJK-Bold.ttc',
    family: 'ZETA CJK',
  },
  display: {
    normal: 'RobotoSlab-Regular.otf',
    bold: 'RobotoSlab-Bold.otf',
    family: 'ZETA Display',
  },
  // A7med-style name font: based on the bundled Roboto Slab family.
  a7med: {
    normal: 'RobotoSlab-Regular.otf',
    bold: 'RobotoSlab-Bold.otf',
    family: 'ZETA A7med',
  },
  emoji: {
    normal: 'NotoColorEmoji.ttf',
    family: 'ZETA Emoji',
  },
};

let initialized = false;

function registerOne(file, family) {
  const full = path.join(FONT_DIR, file);
  if (!fs.existsSync(full)) return false;
  if (!GlobalFonts?.registerFromPath) return false;
  try {
    return !!GlobalFonts.registerFromPath(full, family);
  } catch (_) {
    return false;
  }
}

function ensureCanvasFonts() {
  if (initialized) return;
  initialized = true;

  for (const group of Object.values(FONT_FILES)) {
    registerOne(group.normal, group.family);
    if (group.bold) registerOne(group.bold, group.family);
  }
}

/**
 * Pick a font family based on the text's scripts.
 * Arabic and CJK families also contain Latin glyphs, so mixed strings
 * such as "مرحبا ZETA" and "你好 ZETA" remain readable.
 */
function familyForText(text) {
  const s = String(text ?? '');

  // Arabic + Arabic Presentation Forms
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(s)) {
    return FONT_FILES.arabic.family;
  }

  // Han, Hiragana, Katakana, Hangul
  if (/[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/u.test(s)) {
    return FONT_FILES.cjk.family;
  }

  return FONT_FILES.latin.family;
}

function fontSpec(weight, size, text) {
  ensureCanvasFonts();
  const w = typeof weight === 'number' ? weight : String(weight || 'normal');
  return `${w} ${size}px "${familyForText(text)}"`;
}

/**
 * Set ctx.font without requiring callers to know which script is present.
 */
function setFont(ctx, weight, size, text) {
  ctx.font = fontSpec(weight, size, text);
  return ctx.font;
}


function containsEmoji(text) {
  return /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(String(text ?? ''));
}

function displayFontSpec(weight, size) {
  ensureCanvasFonts();
  const w = typeof weight === 'number' ? weight : String(weight || 'normal');
  return `${w} ${size}px "${FONT_FILES.display.family}"`;
}

function a7medFontSpec(weight, size) {
  ensureCanvasFonts();
  const w = typeof weight === 'number' ? weight : String(weight || 'normal');
  return `${w} ${size}px "${FONT_FILES.a7med.family}"`;
}

function emojiFontSpec(size) {
  ensureCanvasFonts();
  return `${size}px "${FONT_FILES.emoji.family}"`;
}

module.exports = {
  ensureCanvasFonts,
  familyForText,
  fontSpec,
  setFont,
  containsEmoji,
  displayFontSpec,
  a7medFontSpec,
  emojiFontSpec,
};
