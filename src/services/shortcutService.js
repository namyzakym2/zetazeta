const GuildModel = require('../models/Guild');

/**
 * shortcutService — resolves a prefix shortcut (e.g. "!c" or "!رصيدي") to a real
 * slash command name for a specific guild. Backed by Guild.shortcuts.
 */

// Commands that always ship with a shortcut suggestion out of the box.
// Every command gets exactly TWO shortcuts: one English, one Arabic — so it's
// discoverable no matter which language a member types in. See /shortcuts to
// list these in Discord.
const DEFAULT_SHORTCUTS = [
  // economy
  { command: 'zeta', shortcut: 'w' },
  { command: 'zeta', shortcut: 'رصيدي' },
  { command: 'daily', shortcut: 'da' },
  { command: 'daily', shortcut: 'يومي' },
  { command: 'salary', shortcut: 'salary' },
  { command: 'salary', shortcut: 'راتب' },
  { command: 'vote', shortcut: 'vote' },
  { command: 'vote', shortcut: 'تصويت' },
  { command: 'tax', shortcut: 'tax' },
  { command: 'tax', shortcut: 'ضريبة' },

  // activity & leveling
  { command: 'speak', shortcut: 'speak' },
  { command: 'speak', shortcut: 'تكلم' },
  { command: 'top', shortcut: 'top' },
  { command: 'top', shortcut: 'توب' },
  { command: 'profile', shortcut: 'profile' },
  { command: 'profile', shortcut: 'بروفايل' },

  // moderation
  { command: 'warn', shortcut: 'warn' },
  { command: 'warn', shortcut: 'حذر' },
  { command: 'warnings', shortcut: 'warnings' },
  { command: 'warnings', shortcut: 'تحذيراتي' },
  { command: 'unwarn', shortcut: 'unwarn' },
  { command: 'unwarn', shortcut: 'شيل' },
  { command: 'clear', shortcut: 'clear' },
  { command: 'clear', shortcut: 'مسح' },
  { command: 'lock', shortcut: 'lock' },
  { command: 'lock', shortcut: 'قفل' },
  { command: 'unlock', shortcut: 'unlock' },
  { command: 'unlock', shortcut: 'افتح' },
  { command: 'lockdown', shortcut: 'lockdown' },
  { command: 'lockdown', shortcut: 'تجميع' },
  { command: 'unlockdown', shortcut: 'unlockdown' },
  { command: 'unlockdown', shortcut: 'فك-التجميع' },
  { command: 'hide', shortcut: 'hide' },
  { command: 'hide', shortcut: 'اخف' },
  { command: 'unhide', shortcut: 'unhide' },
  { command: 'unhide', shortcut: 'اظهر' },
  { command: 'kick', shortcut: 'kick' },
  { command: 'kick', shortcut: 'طرد' },
  { command: 'ban', shortcut: 'ban' },
  { command: 'ban', shortcut: 'حظر' },
  { command: 'unban', shortcut: 'unban' },
  { command: 'unban', shortcut: 'فك-الحظر' },
  { command: 'massban', shortcut: 'massban' },
  { command: 'massban', shortcut: 'حظر-جماعي' },
  { command: 'softban', shortcut: 'softban' },
  { command: 'softban', shortcut: 'طرد-وتنظيف' },
  { command: 'mute', shortcut: 'mute' },
  { command: 'mute', shortcut: 'اسكت' },
  { command: 'unmute', shortcut: 'unmute' },
  { command: 'unmute', shortcut: 'تكلم' },
  { command: 'timeout', shortcut: 'timeout' },
  { command: 'timeout', shortcut: 'سولف' },
  { command: 'untimeout', shortcut: 'untimeout' },
  { command: 'untimeout', shortcut: 'احكي' },
  { command: 'voice', shortcut: 'voice' },
  { command: 'voice', shortcut: 'صوتي' },
  { command: 'nickname', shortcut: 'nickname' },
  { command: 'nickname', shortcut: 'لقب' },
  { command: 'pin', shortcut: 'pin' },
  { command: 'pin', shortcut: 'ثبت' },
  { command: 'unpin', shortcut: 'unpin' },
  { command: 'unpin', shortcut: 'فك-التثبيت' },
  { command: 'role', shortcut: 'role' },
  { command: 'role', shortcut: 'رتبة' },
  { command: 'slowmode', shortcut: 'slowmode' },
  { command: 'slowmode', shortcut: 'بطيء' },
  { command: 'slowmode-all', shortcut: 'slowmode-all' },
  { command: 'slowmode-all', shortcut: 'تبطيء-الكل' },
  { command: 'serverstats', shortcut: 'serverstats' },
  { command: 'serverstats', shortcut: 'احصائيات' },

  // system
  { command: 'ticket-panel', shortcut: 'ticket-panel' },
  { command: 'ticket-panel', shortcut: 'لوحة-التذاكر' },
  { command: 'setup-ticket', shortcut: 'setup-ticket' },
  { command: 'setup-ticket', shortcut: 'انشاء-تذكرة' },
  { command: 'report', shortcut: 'report' },
  { command: 'report', shortcut: 'بلاغ' },
  { command: 'announce', shortcut: 'announce' },
  { command: 'announce', shortcut: 'إعلان' },
  { command: 'giveaway', shortcut: 'giveaway' },
  { command: 'giveaway', shortcut: 'قيف' },
  { command: 'invite', shortcut: 'invite' },
  { command: 'invite', shortcut: 'رابط' },
  { command: 'system', shortcut: 'system' },
  { command: 'system', shortcut: 'نظام' },
  { command: 'language', shortcut: 'language' },
  { command: 'language', shortcut: 'لغة' },
  { command: 'shortcuts', shortcut: 'shortcuts' },
  { command: 'shortcuts', shortcut: 'اختصارات' },
  { command: 'command-permission', shortcut: 'command-permission' },
  { command: 'command-permission', shortcut: 'صلاحيات' },
  { command: 'update-commands', shortcut: 'update-commands' },
  { command: 'update-commands', shortcut: 'تحديث' },
  { command: 'box', shortcut: 'box' },
  { command: 'box', shortcut: 'صندوق' }
];

// Reserved words that can never be used as a shortcut.
const RESERVED = new Set(['help', 'ping', 'setup-ticket', 'system', 'language', 'shortcuts']);

async function resolveShortcut(guildId, prefix, rawContent) {
  if (!rawContent.startsWith(prefix)) return null;
  const withoutPrefix = rawContent.slice(prefix.length).trim();
  const [word, ...rest] = withoutPrefix.split(/\s+/);
  if (!word) return null;

  const guild = await GuildModel.findOne({ guildId });
  const custom = guild?.shortcuts || [];
  // Built-ins always remain available; custom shortcuts extend them.
  const shortcuts = [...DEFAULT_SHORTCUTS, ...custom];

  const match = shortcuts.find((s) => s.shortcut === word && s.enabled !== false);
  if (!match) return null;

  return { command: match.command, args: rest };
}

async function addShortcut(guildId, command, shortcut) {
  if (RESERVED.has(shortcut)) throw new Error('RESERVED_SHORTCUT');

  const guild = await GuildModel.findOne({ guildId }) || await GuildModel.create({ guildId });
  const duplicate = [...DEFAULT_SHORTCUTS, ...guild.shortcuts].find((s) => s.shortcut === shortcut);
  if (duplicate) throw new Error('DUPLICATE_SHORTCUT');

  guild.shortcuts.push({ command, shortcut, enabled: true });
  await guild.save();
  return guild.shortcuts;
}

async function updateShortcut(guildId, shortcutId, updates) {
  const guild = await GuildModel.findOne({ guildId });
  if (!guild) throw new Error('GUILD_NOT_FOUND');
  const entry = guild.shortcuts.id(shortcutId);
  if (!entry) throw new Error('SHORTCUT_NOT_FOUND');
  if (updates.shortcut) {
    const nextShortcut = String(updates.shortcut).trim();
    if (RESERVED.has(nextShortcut)) throw new Error('RESERVED_SHORTCUT');
    const duplicate = [...DEFAULT_SHORTCUTS, ...guild.shortcuts].some((s) => String(s._id) !== String(shortcutId) && s.shortcut === nextShortcut);
    if (duplicate) throw new Error('DUPLICATE_SHORTCUT');
    updates.shortcut = nextShortcut;
  }
  Object.assign(entry, updates);
  await guild.save();
  return entry;
}

async function deleteShortcut(guildId, shortcutId) {
  const guild = await GuildModel.findOne({ guildId });
  if (!guild) throw new Error('GUILD_NOT_FOUND');
  guild.shortcuts.pull(shortcutId);
  await guild.save();
}

module.exports = { DEFAULT_SHORTCUTS, resolveShortcut, addShortcut, updateShortcut, deleteShortcut };
