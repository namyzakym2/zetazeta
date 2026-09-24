const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PermissionFlagsBits } = require('discord.js');
const { loadImage, createCanvas } = require('@napi-rs/canvas');

const SUPPORT_EMOJI_LIMITS = { 0: 50, 1: 100, 2: 150, 3: 250 };
const SUPPORT_STICKER_LIMITS = { 0: 5, 1: 15, 2: 30, 3: 60 };

function formatDiscordError(err) {
  return [
    err?.message,
    err?.code != null ? `code=${err.code}` : null,
    err?.status != null ? `status=${err.status}` : null
  ].filter(Boolean).join(' | ');
}

const ASSET_DIR = path.join(__dirname, '../../assets');
const EMOJI_DIR = path.join(ASSET_DIR, 'emojis');
const STICKER_DIR = path.join(ASSET_DIR, 'stickers');

// Every visual symbol used by ZETA should resolve to one of these application emojis.
// The names are intentionally stable so the IDs can be cached in memory and recreated
// automatically if an application emoji is deleted from the Developer Portal.
const EMOJI_FILES = {
  mascot_1: 'blue_bot.png',
  mascot_2: 'blue_bot.png',
  mascot_3: 'blue_bot.png',
  mascot_4: 'blue_bot.png',
  mascot_5: 'blue_bot.png',
  mascot_6: 'blue_bot.png',
  mascot_7: 'blue_bot.png',
  mascot_8: 'blue_bot.png',
  v: 'blue_diamond.png',
  zeta: 'blue_diamond.png',
  vgear: 'blue_settings.png',
  gears: 'blue_tools.png',
  gear: 'blue_settings.png',
  vcircle: 'blue_coin.png',
  vhex: 'blue_diamond.png',
  flag: 'blue_shield.png',
  yes: 'blue_success.png',
  no: 'blue_error.png',
  info: 'blue_info_more.png',
  warn: 'blue_warning.png',
  question: 'blue_support.png',
  lock: 'blue_lock.png',
  server: 'blue_database.png',
  crown: 'blue_crown.png',
  bolt: 'blue_fire.png',
  spark: 'blue_snowflake.png',
  discord: 'blue_message.png',
  users: 'blue_group.png',
  adduser: 'blue_add_user.png',
  shield: 'blue_shield.png',
  ticket: 'blue_paperclip.png',
  game: 'blue_game.png',
  timer: 'blue_clock.png',
  stats: 'blue_chart.png',
  settings: 'blue_settings.png',
  chat: 'blue_message.png',
  link: 'blue_link.png',
  like: 'blue_success.png',
  dislike: 'blue_error.png',
  fire: 'blue_fire.png',
  star: 'blue_star.png',
  heart: 'blue_heart.png',
  broken: 'blue_error.png',
  sleep: 'blue_clock.png',
  crown2: 'blue_crown.png',
  party: 'blue_gift.png',
  gift: 'blue_gift.png',
  voice: 'blue_message.png',
  online: 'blue_success.png',
  offline: 'blue_error.png',
  alert: 'blue_warning.png',
  danger: 'blue_error.png',
  clock: 'blue_clock.png',
  broom: 'blue_tools.png',
  door: 'blue_link.png',
  stop: 'blue_error.png',
  shop: 'blue_shop.png',
  cart: 'blue_cart.png',
  human: 'blue_add_user.png',
  puzzle: 'blue_tools.png',
  calculator: 'blue_chart.png',
  coin: 'blue_coin.png',
  eye: 'blue_info_more.png',
  pray: 'blue_heart.png',
  sad: 'blue_error.png',
  mute: 'blue_clock.png',
  speaker: 'blue_message.png',
  search: 'blue_search.png',
  bell: 'blue_bell.png',
  pin: 'blue_paperclip.png',
  paperclip: 'blue_paperclip.png',
  medal_gold: 'blue_trophy.png',
  medal_silver: 'blue_badge.png',
  medal_bronze: 'blue_badge.png',
  mic: 'blue_support.png',
  microphone: 'blue_support.png',
  cleanup: 'blue_trash.png',
  alert_red: 'blue_warning.png',
  money: 'blue_money.png',
  gem: 'blue_diamond.png',
  globe: 'blue_compass.png',
  world: 'blue_location.png',
  recycle: 'blue_tools.png',
  edit: 'blue_edit.png',
  trash: 'blue_trash.png',
  folder: 'blue_folder.png',
  rocket: 'blue_send.png',
  download: 'blue_download.png',
  upload: 'blue_upload.png',
  arrow_right: 'blue_link.png',
  balance: 'blue_balance.png',
  wallet: 'blue_wallet.png',
  currency: 'blue_currency.png',
  transfer: 'blue_transfer.png',
  send: 'blue_send.png',
  receive: 'blue_receive.png',
  unlock: 'blue_unlock.png',
  tools: 'blue_tools.png',
  file: 'blue_file.png',
  image: 'blue_image.png',
  document: 'blue_document.png',
  copy: 'blue_copy.png',
  add_user: 'blue_add_user.png',
  remove_user: 'blue_remove_user.png',
  list: 'blue_list.png',
  warning: 'blue_warning.png',
  minus: 'blue_minus.png',
  success: 'blue_success.png',
  error: 'blue_error.png',
  database: 'blue_database.png',
  chart: 'blue_chart.png',
  graph_up: 'blue_graph_up.png',
  graph_down: 'blue_graph_down.png',
  target: 'blue_target.png',
  trophy: 'blue_trophy.png',
  badge: 'blue_badge.png',
  support: 'blue_support.png',
  message: 'blue_message.png',
  info_more: 'blue_info_more.png',
  group: 'blue_group.png',
  add_user_2: 'blue_add_user_2.png',
  remove_user_2: 'blue_remove_user_2.png',
  notification: 'blue_notification.png',
  security: 'blue_security.png',
  skull: 'blue_skull.png',
  bug: 'blue_bug.png',
  security_2: 'blue_security_2.png',
  key: 'blue_key.png',
  key_2: 'blue_key_2.png',
  vip: 'blue_vip.png',
  badge_2: 'blue_badge_2.png',
  level: 'blue_level.png',
  compass: 'blue_compass.png',
  location: 'blue_location.png',
  calendar: 'blue_calendar.png',
  handshake: 'blue_handshake.png',
  handshake_check: 'blue_handshake_check.png',
  handshake_time: 'blue_handshake_time.png',
  money_bag: 'blue_money_bag.png',
  coins: 'blue_coins.png',
  cash_hand: 'blue_cash_hand.png',
  heartbeat: 'blue_heartbeat.png',
  snowflake: 'blue_snowflake.png',
  diamond: 'blue_diamond.png',
};

// Also discover every image physically present in assets/emojis. This guarantees
// that newly created ZETA emoji PNGs are uploaded automatically without having
// to remember to add another entry to EMOJI_FILES. Explicit entries keep their
// stable aliases/names; discovered files use their filename stem as the Discord name.
const DISCOVERED_EMOJI_FILES = fs.existsSync(EMOJI_DIR)
  ? Object.fromEntries(
      fs.readdirSync(EMOJI_DIR)
        .filter(f => /\.(png|apng|webp)$/i.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(f => [path.parse(f).name, f])
    )
  : {};
const ALL_EMOJI_FILES = { ...DISCOVERED_EMOJI_FILES, ...EMOJI_FILES };

// Sticker tags must be the Discord *name* of a unicode emoji (e.g. "robot"), not the emoji character.
// sticker_1..sticker_10 are ordered by priority: a level-0 support server only has 5 sticker slots,
// so the first five are the ones that get published.
const STICKER_META = {
  sticker_1:  { tags: 'robot',       description: 'ZETA holding the ZETA sign' },
  sticker_2:  { tags: 'video_game',  description: 'ZETA says GG' },
  sticker_3:  { tags: 'heart',       description: 'ZETA hugging a heart' },
  sticker_4:  { tags: 'sunglasses',  description: 'ZETA wearing cool shades' },
  sticker_5:  { tags: 'heart_eyes',  description: 'ZETA with heart eyes' },
  sticker_6:  { tags: 'crown',       description: 'ZETA wearing a crown' },
  sticker_7:  { tags: 'sparkles',    description: 'Happy ZETA with sparkles' },
  sticker_8:  { tags: 'question',    description: 'Confused ZETA' },
  sticker_9:  { tags: 'sweat_drop',  description: 'Nervous ZETA' },
  sticker_10: { tags: 'rage',        description: 'Angry ZETA' }
};

async function prepareStickerBuffer(full) {
  const source = fs.readFileSync(full);
  const ext = path.extname(full).toLowerCase();
  // Discord accepts static PNG stickers only. If the source is already a PNG
  // at or below 320x320, upload its original bytes unchanged.
  if (ext === '.png') {
    try {
      const image = await loadImage(source);
      if (image.width <= 320 && image.height <= 320) return source;
      const scale = Math.min(320 / image.width, 320 / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = createCanvas(320, 320);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 320, 320);
      const x = Math.floor((320 - width) / 2);
      const y = Math.floor((320 - height) / 2);
      ctx.drawImage(image, x, y, width, height);
      return canvas.toBuffer('image/png');
    } catch (err) {
      throw new Error(`Sticker image could not be prepared: ${err.message}`);
    }
  }
  throw new Error('ZETA stickers must be PNG files for Discord static stickers');
}

const STICKER_FILES = Object.fromEntries(
  fs.existsSync(STICKER_DIR)
    ? fs.readdirSync(STICKER_DIR)
        .filter(f => /\.(png|apng|webp)$/i.test(f))
        // numeric order (sticker_2 before sticker_10) so priority order is respected
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(f => [path.parse(f).name, f])
    : []
);

const UNICODE_TO_NAME = new Map([
  // Core actions / status — mapped to the supplied 50-emoji pack.
  ['😀','zeta'], ['😄','zeta'], ['😊','zeta'], ['🙂','zeta'], ['😉','zeta'], ['😏','zeta'],
  ['🥰','zeta'], ['😍','zeta'], ['😎','zeta'], ['🤖','zeta'], ['😇','zeta'], ['😈','zeta'],
  ['👑','crown'], ['⚙️','gear'], ['⚙','gear'], ['🔧','tools'], ['🔨','tools'],
  ['✅','yes'], ['❌','no'], ['⚠️','warn'], ['⚠','warn'], ['❓','question'], ['❔','question'],
  ['🔒','lock'], ['🔐','lock'], ['🔓','lock'], ['💬','chat'], ['📊','stats'], ['🎫','ticket'],
  ['🛡️','shield'], ['🛡','shield'], ['💰','coins'], ['🪙','coins'], ['💵','coins'], ['💳','card'],
  ['🎁','gift'], ['❤️','heart'], ['❤','heart'], ['💔','broken'], ['🔥','fire'], ['⭐','star'],
  ['🌟','star'], ['🎉','party'], ['🎊','party'], ['⚡','bolt'], ['✨','spark'], ['🔗','link'],
  ['👥','users'], ['👤','adduser'], ['🎮','game'], ['💤','sleep'], ['😴','sleep'], ['👍','like'],
  ['👎','dislike'], ['🖥️','server'], ['🖥','server'], ['📋','document'], ['📌','ticket'],
  ['💎','vcircle'], ['🔵','vcircle'], ['🔷','vhex'], ['🏆','crown2'], ['🏅','crown2'],
  ['♻','tools'], ['♻️','tools'], ['⚪','vcircle'], ['⛔','no'], ['✏','tools'], ['➕','adduser'],
  ['➖','dislike'], ['🆕','spark'], ['🌍','flag'], ['🌐','flag'], ['🍀','zeta'], ['🎖','crown2'],
  ['🎙','mic'], ['🎙️','mic'], ['🎨','spark'], ['🎭','zeta'], ['🏦','server'], ['🏧','server'],
  ['🐌','sleep'], ['👁','info'], ['👇','adduser'], ['👋','zeta'], ['👢','dislike'], ['💀','no'],
  ['💡','spark'], ['💼','server'], ['📁','server'], ['📄','document'], ['📅','hourglass'], ['📆','hourglass'],
  ['📈','stats'], ['📉','stats'], ['📎','link'], ['📜','document'], ['📝','document'], ['📢','speaker'],
  ['📨','chat'], ['📩','chat'], ['📭','chat'], ['🔁','tools'], ['🔄','tools'], ['🔇','sleep'],
  ['🔊','speaker'], ['🔎','info'], ['🔔','speaker'], ['🔘','vcircle'], ['🔴','no'], ['🗂','server'],
  ['🗄','server'], ['🗑','trash'], ['🗓','hourglass'], ['⏰','hourglass'], ['⏱️','hourglass'],
  ['⏱','hourglass'], ['⏳','hourglass'], ['🚀','bolt'], ['🚨','warn'], ['🚪','link'], ['🚫','no'],
  ['🛍','gift'], ['🛒','gift'], ['🟢','yes'], ['😢','broken'], ['🙈','sleep'], ['🙏','heart'],
  ['🥇','crown2'], ['🥈','crown2'], ['🥉','crown2'], ['🧑','adduser'], ['🧩','tools'], ['🧮','stats'],
  ['🧹','tools'], ['➡️','link'], ['➡','link'], ['⬇️','link'], ['⬇','link'], ['⬆️','link'], ['⬆','link']
]);

let applicationEmojiCache = new Map();
let supportEmojiCache = new Map();
let supportStickerCache = new Map();

function tagFromEmoji(emoji) {
  if (!emoji) return null;
  return emoji.toString();
}

function getZetaBotEmoji(name) {
  const e = applicationEmojiCache.get(name);
  return e ? tagFromEmoji(e) : null;
}

function resolveCustomEmoji(value) {
  if (typeof value !== 'string') return null;
  const exact = getZetaBotEmoji(value);
  if (exact) return exact;
  const name = UNICODE_TO_NAME.get(value);
  return name ? getZetaBotEmoji(name) : null;
}

function replaceZetaBotEmojiText(value) {
  if (typeof value !== 'string') return value;
  let out = value;
  // Longest first prevents the variation-selector form from being partially replaced.
  [...UNICODE_TO_NAME.keys()].sort((a,b) => b.length-a.length).forEach(unicode => {
    const custom = resolveCustomEmoji(unicode);
    if (custom) out = out.split(unicode).join(custom);
  });
  // Final safety net: any emoji not explicitly listed above is still replaced
  // by the branded ZETA emoji instead of leaving a native Unicode emoji behind.
  const generic = getZetaBotEmoji('zeta');
  if (generic) {
    try {
    } catch (_) {}
    try {
      out = out.replace(/\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])?)*/gu, m => {
        return UNICODE_TO_NAME.has(m) ? m : generic;
      });
    } catch (_) {}
  }
  return out;
}

function transformPayload(value, key = '', seen = new WeakSet()) {
  if (typeof value === 'string') {
    // Never rewrite IDs, URLs, file paths, custom IDs, or asset names.
    if (/id$|url$|^custom_id$|^name$|path|file/i.test(key)) return value;

    // Discord component emojis must be API emoji objects, not raw Unicode strings.
    if (key === 'emoji') {
      // Component payloads may contain Unicode OR a ZETA logical emoji name.
      // Always resolve them to an actual custom Application Emoji.
      const logicalName = UNICODE_TO_NAME.get(value) || value.trim();
      const custom = applicationEmojiCache.get(logicalName);
      if (custom) return { id: custom.id, name: custom.name };
      const fallback = applicationEmojiCache.get('zeta') || applicationEmojiCache.values().next().value;
      if (fallback) return { id: fallback.id, name: fallback.name };
    }
    return replaceZetaBotEmojiText(value);
  }

  if (key === 'emoji' && value && typeof value === 'object' && !Array.isArray(value)) {
    const unicodeName = typeof value.name === 'string' ? UNICODE_TO_NAME.get(value.name) : null;
    const logicalName = unicodeName || (typeof value.name === 'string' ? value.name.trim() : null);
    const custom = logicalName ? applicationEmojiCache.get(logicalName) : null;
    if (custom) return { id: custom.id, name: custom.name };
    const fallback = applicationEmojiCache.get('zeta') || applicationEmojiCache.values().next().value;
    if (fallback) return { id: fallback.id, name: fallback.name };
    if (typeof value.name === 'string' && /\p{Extended_Pictographic}/u.test(value.name)) {
      const fallback = applicationEmojiCache.get('zeta');
      if (fallback) return { id: fallback.id, name: fallback.name };
    }
    return value;
  }

  if (Array.isArray(value)) return value.map(v => transformPayload(v, key, seen));
  if (!value || typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return value;

  // Avoid the recursive/circular traversal that was causing the repeated
  // transformPayload() stack trace in the hosting console. Only walk plain
  // payload objects and each object at most once.
  if (seen.has(value)) return value;
  seen.add(value);

  // discord.js builders expose their mutable payload through `.data`.
  // Transform that payload once, but never recursively walk arbitrary class
  // instances such as Client, Collection, Message, etc.
  if (value.data && typeof value.data === 'object' && value.data !== value) {
    transformPayload(value.data, key, seen);
  }

  const proto = Object.getPrototypeOf(value);
  const isPlain = proto === Object.prototype || proto === null;
  if (!isPlain) return value;

  for (const [k, v] of Object.entries(value)) {
    if (k === 'data' || k === 'client' || k === 'guild' || k === 'channel' || k === 'user') continue;
    const next = transformPayload(v, k, seen);
    if (next !== v) value[k] = next;
  }
  return value;
}

function patchSendMethods(discord) {
  const classes = [discord.BaseInteraction, discord.Message, discord.TextChannel, discord.ThreadChannel,
    discord.DMChannel, discord.NewsChannel, discord.StageChannel, discord.BaseGuildTextChannel].filter(Boolean);
  const methods = ['reply', 'editReply', 'followUp', 'send'];
  for (const Klass of classes) {
    for (const method of methods) {
      const original = Klass.prototype?.[method];
      if (typeof original !== 'function' || original.__zetaEmojiPatched) continue;
      const wrapped = function(payload, ...rest) {
        if (method === 'reply' || method === 'editReply' || method === 'followUp' || method === 'send') {
          payload = transformPayload(payload);
        }
        return original.call(this, payload, ...rest);
      };
      wrapped.__zetaEmojiPatched = true;
      Klass.prototype[method] = wrapped;
    }
  }
}

function discordSafeEmojiName(name) {
  // Discord Application Emoji names must be 2–32 characters.
  // Keep the internal ZETA key stable while using a valid Discord name.
  if (typeof name !== 'string') return 'zeta_emoji';
  const safe = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return safe.length >= 2 ? safe.slice(0, 32) : `v_${safe || 'emoji'}`.slice(0, 32);
}

function isZetaBotApplicationEmoji(emoji) {
  return Boolean(emoji?.name);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function applicationEmojiMatchesFile(emoji, fullPath) {
  try {
    if (!emoji?.url || !fs.existsSync(fullPath)) return false;
    const response = await fetch(emoji.url);
    if (!response.ok) return false;
    const remote = Buffer.from(await response.arrayBuffer());
    const local = fs.readFileSync(fullPath);
    return sha256(remote) === sha256(local);
  } catch (_) {
    return false;
  }
}

function isZetaBotSupportEmoji(emoji) {
  const name = String(emoji?.name || '');
  return name.startsWith('zeta_') || Object.prototype.hasOwnProperty.call(EMOJI_FILES, name);
}

function isZetaBotSupportSticker(sticker) {
  return String(sticker?.name || '').startsWith('zeta_');
}

async function syncApplicationEmojis(client) {
  if (!client.application) return { created: 0, existing: 0, deleted: 0, failed: 0, reason: 'application unavailable' };
  try { await client.application.fetch(); } catch (err) {
    console.error(`⚠️ ZETA application fetch failed: ${formatDiscordError(err)}`);
  }
  if (!client.application.emojis) return { created: 0, existing: 0, deleted: 0, failed: 0, reason: 'application emoji manager unavailable' };

  const existing = await client.application.emojis.fetch().catch(() => client.application.emojis.cache);
  applicationEmojiCache = new Map();

  // Bundled ZETA emojis are synchronized, but application emojis created from
  // the dashboard are preserved. This makes the custom-emoji manager non-destructive.
  const desired = new Map();
  for (const [name, file] of Object.entries(ALL_EMOJI_FILES)) {
    const full = path.join(EMOJI_DIR, file);
    if (!fs.existsSync(full)) continue;
    const discordName = discordSafeEmojiName(name);
    if (!desired.has(discordName)) desired.set(discordName, { name, file, full });
  }

  let created = 0, existingCount = 0, deleted = 0, failed = 0;

  const byName = new Map();
  for (const emoji of existing.values()) {
    if (emoji?.name && desired.has(String(emoji.name))) byName.set(emoji.name, emoji);
  }

  const seenApplicationFiles = new Set();
  for (const [name, file] of Object.entries(ALL_EMOJI_FILES)) {
    const full = path.join(EMOJI_DIR, file);
    if (!fs.existsSync(full)) continue;

    if (seenApplicationFiles.has(file)) {
      const canonicalName = Object.keys(ALL_EMOJI_FILES).find(k => ALL_EMOJI_FILES[k] === file);
      const canonical = applicationEmojiCache.get(canonicalName);
      if (canonical) applicationEmojiCache.set(name, canonical);
      continue;
    }
    seenApplicationFiles.add(file);

    const discordName = discordSafeEmojiName(name);
    let already = byName.get(discordName);

    // Same name is not enough: if the image differs from the supplied PNG,
    // remove it and recreate it from the pack.
    if (already) {
      const matches = await applicationEmojiMatchesFile(already, full);
      if (!matches) {
        try {
          await already.delete('ZETA sync: replace application emoji with supplied asset');
          deleted++;
          byName.delete(discordName);
          already = null;
        } catch (err) {
          failed++;
          console.error(`⚠️ ZETA application emoji ${name} replace/delete failed: ${formatDiscordError(err)}`);
        }
      }
    }

    if (already) {
      applicationEmojiCache.set(name, already);
      for (const [alias, aliasFile] of Object.entries(ALL_EMOJI_FILES)) {
        if (aliasFile === file) applicationEmojiCache.set(alias, already);
      }
      existingCount++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(full);
      const emoji = await client.application.emojis.create({
        attachment: buffer,
        name: discordName,
        reason: 'ZETA sync: restore exact supplied emoji asset'
      });
      applicationEmojiCache.set(name, emoji);
      for (const [alias, aliasFile] of Object.entries(ALL_EMOJI_FILES)) {
        if (aliasFile === file) applicationEmojiCache.set(alias, emoji);
      }
      byName.set(discordName, emoji);
      created++;
    } catch (err) {
      // Discord can report a name collision even when the initial collection
      // returned by the application emoji manager is stale/empty. Recover by
      // refreshing the application emoji collection and reusing the existing
      // emoji instead of trying to create a duplicate on every startup.
      const isNameTaken = String(err?.message || '').includes('APPLICATION_EMOJI_NAME_ALREADY_TAKEN');
      if (isNameTaken) {
        try {
          const refreshed = await client.application.emojis.fetch();
          const recovered = refreshed.find(e => String(e?.name || '') === discordName);
          if (recovered) {
            const matches = await applicationEmojiMatchesFile(recovered, full);
            if (!matches) {
              await recovered.delete('ZETA sync: replace stale application emoji with supplied asset');
              deleted++;
              const buffer = fs.readFileSync(full);
              const recreated = await client.application.emojis.create({
                attachment: buffer,
                name: discordName,
                reason: 'ZETA sync: restore exact supplied emoji asset'
              });
              applicationEmojiCache.set(name, recreated);
              for (const [alias, aliasFile] of Object.entries(ALL_EMOJI_FILES)) {
                if (aliasFile === file) applicationEmojiCache.set(alias, recreated);
              }
              byName.set(discordName, recreated);
              created++;
            } else {
              applicationEmojiCache.set(name, recovered);
              for (const [alias, aliasFile] of Object.entries(ALL_EMOJI_FILES)) {
                if (aliasFile === file) applicationEmojiCache.set(alias, recovered);
              }
              byName.set(discordName, recovered);
              existingCount++;
            }
            continue;
          }
        } catch (recoverErr) {
          console.error(`⚠️ ZETA application emoji ${name} recovery failed: ${formatDiscordError(recoverErr)}`);
        }
      }
      failed++;
      console.error(`⚠️ ZETA application emoji ${name} failed: ${formatDiscordError(err)}`);
    }
  }

  return { created, existing: existingCount, deleted, failed };
}

async function syncSupportGuildAssets(client) {
  let guildId = process.env.ZETA_SUPPORT_GUILD_ID || process.env.SUPPORT_GUILD_ID;
  let guild = guildId ? (client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null)) : null;
  if (!guild) {
    const inviteCode = process.env.ZETA_SUPPORT_INVITE || 'm8c2mUEMj';
    const invite = await client.fetchInvite(inviteCode).catch(() => null);
    guildId = invite?.guild?.id;
    guild = guildId ? (client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null)) : null;
  }
  if (!guild) return { skipped: true, reason: 'support guild not found' };

  const me = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
  if (!me) return { skipped: true, reason: 'bot is not a member of the support guild' };

  const canCreateExpressions = me.permissions.has(PermissionFlagsBits.CreateGuildExpressions);
  const canManageExpressions = me.permissions.has(PermissionFlagsBits.ManageGuildExpressions);
  if (!canCreateExpressions) {
    return {
      skipped: true,
      reason: `support guild permission missing: Create Expressions=false, Manage Expressions=${canManageExpressions}. Give the bot Manage Expressions (or Create Expressions + Manage Expressions).`
    };
  }

  // STRICT NON-DESTRUCTIVE SYNC: never delete, replace, or recreate an existing
  // custom emoji. If the exact source name already exists, it is always reused
  // and the upload is skipped, even if its image differs. New uploads use the
  // exact asset file from assets/emojis (same name, pixels, transparency, and quality).
  const existingEmoji = await guild.emojis.fetch().catch(() => guild.emojis.cache);
  supportEmojiCache = new Map();
  const existingEmojiByName = new Map();
  for (const emoji of existingEmoji.values()) {
    if (emoji?.name) existingEmojiByName.set(emoji.name, emoji);
  }

  let emojisCreated = 0, emojisExisting = 0, emojiFailed = 0;
  const seenSupportFiles = new Set();
  const uniqueEmojiEntries = Object.entries(ALL_EMOJI_FILES).filter(([name, file]) => {
    if (!fs.existsSync(path.join(EMOJI_DIR, file)) || seenSupportFiles.has(file)) return false;
    seenSupportFiles.add(file);
    return true;
  });
  const emojiLimit = SUPPORT_EMOJI_LIMITS[Number(guild.premiumTier)] ?? 50;
  const missingEmojiEntries = [];
  for (const [name, file] of uniqueEmojiEntries) {
    const discordName = discordSafeEmojiName(name).slice(0, 32);
    const already = existingEmojiByName.get(discordName);
    if (already) {
      supportEmojiCache.set(name, already);
      for (const [alias, aliasFile] of Object.entries(ALL_EMOJI_FILES)) {
        if (aliasFile === file) supportEmojiCache.set(alias, already);
      }
      emojisExisting++;
    } else {
      missingEmojiEntries.push([name, file, discordName]);
    }
  }
  const availableEmojiSlots = Math.max(0, emojiLimit - existingEmoji.size);
  if (availableEmojiSlots < missingEmojiEntries.length) {
    console.warn(`⚠️ Support server emoji capacity: ${availableEmojiSlots}/${missingEmojiEntries.length} missing ZETA emojis can be added (limit ${emojiLimit}, existing ${existingEmoji.size}).`);
  }
  for (const [name, file, discordName] of missingEmojiEntries.slice(0, availableEmojiSlots)) {
    const full = path.join(EMOJI_DIR, file);
    try {
      const buffer = fs.readFileSync(full);
      const emoji = await guild.emojis.create({
        attachment: buffer,
        name: discordName,
        reason: 'ZETA startup: add missing branded emoji only (non-destructive sync)'
      });
      supportEmojiCache.set(name, emoji);
      for (const [alias, aliasFile] of Object.entries(ALL_EMOJI_FILES)) {
        if (aliasFile === file) supportEmojiCache.set(alias, emoji);
      }
      emojisCreated++;
    } catch (err) {
      emojiFailed++;
      console.error(`⚠️ Support emoji ${name} failed: ${formatDiscordError(err)}`);
    }
  }
  emojiFailed += Math.max(0, missingEmojiEntries.length - Math.min(availableEmojiSlots, missingEmojiEntries.length));

  const existingStickers = await guild.stickers.fetch().catch(() => guild.stickers.cache);
  // STRICT NON-DESTRUCTIVE SYNC: never delete, replace, or recreate an existing
  // sticker. Same exact source name => reuse and skip upload. New stickers use the exact
  // asset file from assets/stickers.
  const existingStickerByName = new Map();
  for (const sticker of existingStickers.values()) {
    if (sticker?.name) existingStickerByName.set(sticker.name, sticker);
  }
  supportStickerCache = new Map();

  let stickersCreated = 0, stickersExisting = 0, stickerFailed = 0;
  const stickerLimit = SUPPORT_STICKER_LIMITS[Number(guild.premiumTier)] ?? 5;
  const stickerEntries = Object.entries(STICKER_FILES);
  // ZETA sticker sources are kept as 320x320 transparent PNGs. We upload the
  // exact source bytes so Discord receives the same pixels/alpha/compression
  // quality as the bundled asset; no resize, JPEG conversion, or re-encode is done.
  console.log(`🖼️ ZETA sticker sources ready: ${stickerEntries.length} PNG assets (exact-byte upload)`);
  const missingStickerEntries = [];
  for (const [name, file] of stickerEntries) {
    const stickerName = discordSafeEmojiName(name).slice(0, 30);
    const already = existingStickerByName.get(stickerName);
    if (already) {
      supportStickerCache.set(name, already);
      stickersExisting++;
    } else {
      missingStickerEntries.push([name, file, stickerName]);
    }
  }
  const availableStickerSlots = Math.max(0, stickerLimit - existingStickers.size);
  if (availableStickerSlots < missingStickerEntries.length) {
    console.warn(`⚠️ Support server sticker capacity: ${availableStickerSlots}/${missingStickerEntries.length} missing ZETA stickers can be added (limit ${stickerLimit}, existing ${existingStickers.size}).`);
  }
  for (const [name, file, stickerName] of missingStickerEntries.slice(0, availableStickerSlots)) {
    const full = path.join(STICKER_DIR, file);
    try {
      const buffer = await prepareStickerBuffer(full);
      const sticker = await guild.stickers.create({
        // Discord static stickers have a 320x320 maximum. Keep already-valid
        // 320px PNGs byte-for-byte, but automatically downscale larger HQ
        // sources (such as 1280x1280) in memory before upload.
        file: { attachment: buffer, name: path.basename(full, path.extname(full)) + '.png' },
        name: stickerName,
        description: (STICKER_META[name]?.description || `Official ZETA sticker — ${name}`).slice(0, 100),
        tags: STICKER_META[name]?.tags || 'robot',
        reason: 'ZETA startup: add missing branded sticker only (non-destructive sync)'
      });
      supportStickerCache.set(name, sticker);
      stickersCreated++;
    } catch (err) {
      stickerFailed++;
      console.error(`⚠️ Support sticker ${name} failed: ${formatDiscordError(err)}`);
    }
  }
  stickerFailed += Math.max(0, missingStickerEntries.length - Math.min(availableStickerSlots, missingStickerEntries.length));

  return {
    skipped: false,
    guild: guild.name,
    emojisCreated,
    emojisExisting,
    emojiFailed,
    emojisDeleted: 0,
    stickersCreated,
    stickersExisting,
    stickerFailed,
    stickersDeleted: 0
  };
}

async function syncZetaBotAssets(client) {
  const app = await syncApplicationEmojis(client);
  const support = await syncSupportGuildAssets(client);
  console.log(`🎨 ZETA assets synced | App emojis: existing ${app.existing || 0}, added +${app.created || 0}, deleted ${app.deleted || 0}, failed ${app.failed || 0}`);
  if (!support.skipped) {
    console.log(`🧩 Support assets [${support.guild}]: emojis deleted ${support.emojisDeleted || 0}, created +${support.emojisCreated}, failed ${support.emojiFailed || 0}; stickers deleted ${support.stickersDeleted || 0}, created +${support.stickersCreated}, failed ${support.stickerFailed || 0}`);
  } else if (support.reason !== 'support guild not found') {
    console.warn(`⚠️ Support assets skipped: ${support.reason}`);
  }
  return { app, support };
}

module.exports = {
  EMOJI_FILES,
  ALL_EMOJI_FILES,
  STICKER_FILES,
  prepareStickerBuffer,
  UNICODE_TO_NAME,
  getZetaBotEmoji,
  resolveCustomEmoji,
  replaceZetaBotEmojiText,
  transformPayload,
  patchSendMethods,
  syncApplicationEmojis,
  syncSupportGuildAssets,
  syncZetaBotAssets
};
