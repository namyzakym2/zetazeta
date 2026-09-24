// Discord's ButtonBuilder#setEmoji throws immediately (synchronously) if it's given
// a string that isn't a real unicode emoji or a valid custom-emoji tag. Since ticket
// buttons/panels are built from admin-entered strings (dashboard form, /setup-ticket
// modal), one bad value used to crash the whole command with a generic error. This
// utility validates/sanitizes an emoji string before it ever reaches discord.js.

// Custom emoji: <:name:id> or <a:name:id>
const CUSTOM_EMOJI_RE = /^<a?:\w{2,32}:\d{17,20}>$/;

// Good-enough unicode emoji check (covers standard emoji ranges, ZWJ sequences,
// variation selectors, skin tone modifiers, regional indicators, keycaps).
const UNICODE_EMOJI_RE =
  /^(?:[\u{1F1E6}-\u{1F1FF}]{2}|(?:[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{2000}-\u{206F}])(?:\u{FE0F})?(?:\u{200D}(?:[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}])(?:\u{FE0F})?)*(?:[\u{1F3FB}-\u{1F3FF}])?|[0-9#*]\u{FE0F}?\u{20E3})$/u;

/**
 * Returns the emoji string if it's a safe/valid emoji, otherwise null.
 * Empty/undefined input returns null (caller should fall back to a default).
 */
function sanitizeEmoji(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (CUSTOM_EMOJI_RE.test(trimmed) || UNICODE_EMOJI_RE.test(trimmed)) return trimmed;
  return null;
}

/**
 * Applies an emoji to a discord.js ButtonBuilder safely — validates first, and
 * as a last line of defense, swallows any error setEmoji still throws (some valid
 * looking unicode sequences can still be rejected by Discord's own emoji parser)
 * so a single bad button emoji never takes the whole panel/command down.
 */
function setEmojiSafe(builder, value, fallback = '🎫') {
  let zeta = null;
  let zetaFallback = null;
  try {
    const pack = require('./zetaEmojis');
    zeta = pack.resolveCustomEmoji(value);
    zetaFallback = pack.resolveCustomEmoji(fallback);
  } catch {}
  const safe = zeta || zetaFallback || sanitizeEmoji(value) || fallback;
  try {
    builder.setEmoji(safe);
  } catch (err) {
    console.error(`⚠️ Invalid emoji "${value}", falling back to "${fallback}":`, err.message);
    try {
      builder.setEmoji(zetaFallback || fallback);
    } catch {
      // Even the fallback failed (shouldn't happen) — leave the button without an emoji.
    }
  }
  return builder;
}

const HEX_COLOR_RE = /^#?[0-9a-fA-F]{6}$/;

/**
 * EmbedBuilder#setColor throws on anything that isn't a valid hex string / int /
 * known color name — and the ticket panel color comes straight from user input
 * (dashboard field, /setup-ticket modal). Validate it before it ever reaches
 * discord.js so a typo like "red!!" can't crash the whole panel/embed.
 */
function sanitizeHexColor(value, fallback = '#0f2158') {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return fallback;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

module.exports = { sanitizeEmoji, setEmojiSafe, sanitizeHexColor };
