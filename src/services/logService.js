const GuildModel = require('../models/Guild');
const { buildV2Panel } = require('../utils/componentsV2');

/**
 * logService — every log event goes through here so channel routing / enable-disable
 * toggles live in one place. Each log "type" maps to a channel + a boolean toggle
 * inside Guild.logSettings (see models/Guild.js).
 *
 * `channelField`/`toggleField` may be an array — e.g. ['banChannelId', 'moderationChannelId'] —
 * meaning "use the specific one if the server configured it, otherwise fall back to the
 * general moderation channel/toggle". This lets servers that don't care about granular
 * routing just set one moderation log and have everything land there, while servers that
 * want ban/kick/timeout/roles/channels/threads/invites split out can do so.
 */

const TYPE_MAP = {
  memberJoin: { channelField: 'memberChannelId', toggleField: 'memberLogs', color: 0x57f287, title: '👋 Member Join' },
  memberLeave: { channelField: 'memberChannelId', toggleField: 'memberLogs', color: 0xed4245, title: '👋 Member Leave' },
  autoRoleAssign: { channelField: 'memberChannelId', toggleField: 'memberLogs', color: 0x7c3aed, title: '🎭 Auto Rules — Role Assigned' },

  // --- Invites ---------------------------------------------------------
  inviteJoin: { channelField: ['inviteChannelId', 'memberChannelId'], toggleField: 'inviteLogs', color: 0x57f287, title: '📨 Invite — New Join' },
  inviteFake: { channelField: ['inviteChannelId', 'memberChannelId'], toggleField: 'inviteLogs', color: 0xfaa61a, title: '📨 Invite — Fake (New Account)' },
  inviteLeave: { channelField: ['inviteChannelId', 'memberChannelId'], toggleField: 'inviteLogs', color: 0xed4245, title: '📨 Invite — Invited Member Left' },

  // --- Ban / Kick / Timeout (own channel, fall back to moderation) -----
  ban: { channelField: ['banChannelId', 'moderationChannelId'], toggleField: 'banLogs', color: 0xed4245, title: '🔨 Ban' },
  unban: { channelField: ['banChannelId', 'moderationChannelId'], toggleField: 'banLogs', color: 0x57f287, title: '🔓 Unban' },
  softban: { channelField: ['banChannelId', 'moderationChannelId'], toggleField: 'banLogs', color: 0xed4245, title: '🔨 Softban' },
  massban: { channelField: ['banChannelId', 'moderationChannelId'], toggleField: 'banLogs', color: 0xed4245, title: '🔨 Mass Ban' },

  kick: { channelField: ['kickChannelId', 'moderationChannelId'], toggleField: 'kickLogs', color: 0xed4245, title: '👢 Kick' },

  timeout: { channelField: ['timeoutChannelId', 'moderationChannelId'], toggleField: 'timeoutLogs', color: 0xfaa61a, title: '⏱️ Timeout' },
  untimeout: { channelField: ['timeoutChannelId', 'moderationChannelId'], toggleField: 'timeoutLogs', color: 0x57f287, title: '⏱️ Timeout Removed' },
  mute: { channelField: ['timeoutChannelId', 'moderationChannelId'], toggleField: 'timeoutLogs', color: 0xfaa61a, title: '🔇 Mute' },
  unmute: { channelField: ['timeoutChannelId', 'moderationChannelId'], toggleField: 'timeoutLogs', color: 0x57f287, title: '🔊 Unmute' },

  // --- Nickname ----------------------------------------------------------
  nickChange: { channelField: ['nicknameChannelId', 'moderationChannelId'], toggleField: 'nicknameLogs', color: 0x5865f2, title: '✏️ Nickname Changed' },

  // --- Member <-> role assignment (give/take a role from a member) -------
  roleAdd: { channelField: ['roleChannelId', 'moderationChannelId'], toggleField: 'roleLogs', color: 0x57f287, title: '➕ Role Given' },
  roleRemove: { channelField: ['roleChannelId', 'moderationChannelId'], toggleField: 'roleLogs', color: 0xed4245, title: '➖ Role Removed' },

  // --- Guild role management (create/delete/update the role itself) ------
  roleCreate: { channelField: ['roleChannelId', 'moderationChannelId'], toggleField: 'roleLogs', color: 0x57f287, title: '🆕 Role Created' },
  roleDelete: { channelField: ['roleChannelId', 'moderationChannelId'], toggleField: 'roleLogs', color: 0xed4245, title: '🗑️ Role Deleted' },
  roleUpdate: { channelField: ['roleChannelId', 'moderationChannelId'], toggleField: 'roleLogs', color: 0x5865f2, title: '✏️ Role Updated' },

  // --- Channel (room) management ------------------------------------------
  channelCreate: { channelField: ['channelChannelId', 'moderationChannelId'], toggleField: 'channelLogs', color: 0x57f287, title: '🆕 Channel Created' },
  channelDelete: { channelField: ['channelChannelId', 'moderationChannelId'], toggleField: 'channelLogs', color: 0xed4245, title: '🗑️ Channel Deleted' },
  channelUpdate: { channelField: ['channelChannelId', 'moderationChannelId'], toggleField: 'channelLogs', color: 0x5865f2, title: '✏️ Channel Updated' },
  channelPermissionUpdate: { channelField: ['channelChannelId', 'moderationChannelId'], toggleField: 'channelLogs', color: 0x7c5cff, title: '🔐 Channel Permissions Updated' },

  // --- Threads --------------------------------------------------------------
  threadCreate: { channelField: ['threadChannelId', 'moderationChannelId'], toggleField: 'threadLogs', color: 0x57f287, title: '🆕 Thread Created' },
  threadDelete: { channelField: ['threadChannelId', 'moderationChannelId'], toggleField: 'threadLogs', color: 0xed4245, title: '🗑️ Thread Deleted' },
  threadUpdate: { channelField: ['threadChannelId', 'moderationChannelId'], toggleField: 'threadLogs', color: 0x5865f2, title: '✏️ Thread Updated' },

  // --- Remaining moderation actions (still share the general channel) ----
  warn: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0xfaa61a, title: '⚠️ Warn' },
  unwarn: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0x57f287, title: '✅ Unwarn' },
  slowmode: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0x5865f2, title: '🐌 Slowmode Changed' },
  vcKick: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0xed4245, title: '🔊 Voice Kick' },
  vcMute: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0xfaa61a, title: '🔇 Voice Mute' },
  vcUnmute: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0x57f287, title: '🔊 Voice Unmute' },
  reportSubmitted: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0xfaa61a, title: '🚨 Report Submitted' },
  reportReviewed: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0x57f287, title: '✅ Report Reviewed' },
  hide: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0xed4245, title: '🙈 Channel Hidden' },
  unhide: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0x57f287, title: '👁️ Channel Shown' },
  pin: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0x5865f2, title: '📌 Message Pinned' },
  unpin: { channelField: 'moderationChannelId', toggleField: 'moderationLogs', color: 0x5865f2, title: '📌 Message Unpinned' },

  // --- System / general -----------------------------------------------------
  announce: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x5865f2, title: '📢 Announcement Sent' },
  caseLookup: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x5865f2, title: '🔎 Warnings Lookup' },
  lockdown: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0xed4245, title: '🚨 Server Lockdown' },
  unlockdown: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x57f287, title: '✅ Lockdown Lifted' },
  giveawayStart: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x0f2158, title: '🎉 Giveaway Started' },
  giveawayEnd: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x57f287, title: '🎉 Giveaway Ended' },
  giveawayReroll: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x5865f2, title: '🔁 Giveaway Rerolled' },
  devilGuildBlocked: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x0f2158, title: '💀 ZetaBot Panel — Server Blocked' },
  devilGuildUnblocked: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x57f287, title: '💀 ZetaBot Panel — Server Unblocked' },
  sellerRoomContact: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x57f287, title: '📩 روم البيع — طلب تواصل' },
  systemConfigChange: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x5865f2, title: '⚙️ System Configuration Change' },
  shortcutChange: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x5865f2, title: '⚡ Shortcut Change' },
  ticketConfigChange: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x5865f2, title: '🎫 Ticket Configuration Change' },
  autoResponderTrigger: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x5865f2, title: '🤖 Auto-Responder Triggered' },
  autoResponderChange: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x5865f2, title: '🤖 Auto-Responder Configuration Change' },
  salaryClaim: { channelField: 'systemChannelId', toggleField: 'systemLogs', color: 0x0f2158, title: '💼 Staff Salary Claimed' },

  // --- Messages --------------------------------------------------------------
  messageDelete: { channelField: 'messageChannelId', toggleField: 'messageLogs', color: 0xed4245, title: '🗑️ Message Delete' },
  messageEdit: { channelField: 'messageChannelId', toggleField: 'messageLogs', color: 0xfaa61a, title: '✏️ Message Edit' },

  // --- Tickets -----------------------------------------------------------
  ticketCreate: { channelField: 'ticketChannelId', toggleField: 'ticketLogs', color: 0x0f2158, title: '🎫 Ticket Created' },
  ticketClaim: { channelField: 'ticketChannelId', toggleField: 'ticketLogs', color: 0x0f2158, title: '🎫 Ticket Claimed' },
  ticketClose: { channelField: 'ticketChannelId', toggleField: 'ticketLogs', color: 0x0f2158, title: '🎫 Ticket Closed' },
  ticketDelete: { channelField: 'ticketChannelId', toggleField: 'ticketLogs', color: 0x0f2158, title: '🎫 Ticket Deleted' },

  // --- AutoMod / seller room -----------------------------------------------
  shield: { channelField: ['automodChannelId', 'moderationChannelId'], toggleField: 'automodLogs', color: 0xed4245, title: '🛡️ ZETA Shield' },
  automod: { channelField: 'automodChannelId', toggleField: 'automodLogs', color: 0xed4245, title: '🛡️ AutoMod Action' },
  sellerRoomBlock: { channelField: 'automodChannelId', toggleField: 'automodLogs', color: 0xed4245, title: '🚫 روم البيع — رسالة محذوفة' }

  // NOTE: economy log and vote log were intentionally removed — economy/vote/rank-shop
  // events no longer route anywhere. log() silently no-ops for any type not in this map.
};

function pickFirstConfigured(logSettings, field) {
  const fields = Array.isArray(field) ? field : [field];
  for (const f of fields) {
    if (logSettings[f]) return f;
  }
  return null;
}

async function log(client, guildId, type, fields = {}, { footer = null } = {}) {
  const conf = TYPE_MAP[type];
  if (!conf) return;
  // client is optional: the dashboard runs as a separate process without a live
  // Discord connection unless CLIENT_SHARING is set up, so guard against null.
  if (!client) return;

  const guildDoc = await GuildModel.findOne({ guildId });
  if (!guildDoc || !guildDoc.logSettings) return;

  const { logSettings } = guildDoc;
  const eventOverride = logSettings.logEvents?.get?.(type) || logSettings.logEvents?.[type] || null;
  if (eventOverride && eventOverride.enabled === false) return;
  if (!eventOverride && !logSettings[conf.toggleField]) return;

  const overrideChannel = eventOverride?.channelId || '';
  const channelField = overrideChannel ? null : pickFirstConfigured(logSettings, conf.channelField);
  if (!overrideChannel && !channelField) return;
  const channelId = overrideChannel || logSettings[channelField];

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return;

  const logFields = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    logFields.push({ name, value: String(value) });
  }

  const chosenColor = eventOverride?.color || conf.color;
  const normalizedColor = typeof chosenColor === 'string' && /^#?[0-9a-fA-F]{6}$/.test(chosenColor)
    ? parseInt(chosenColor.replace('#', ''), 16)
    : chosenColor;
  const panel = buildV2Panel({
    title: conf.title,
    color: normalizedColor,
    fields: logFields,
    footer: footer || undefined,
    timestamp: true
  });

  await channel.send(panel).catch(() => {});
}

module.exports = { log, TYPE_MAP };
