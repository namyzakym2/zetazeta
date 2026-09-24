const GuildModel = require('../models/Guild');

/**
 * Auto Responder — replies automatically when a message matches a configured
 * trigger word/phrase. Configured per-guild via the dashboard
 * (dashboard/routes/admin.js -> GET/POST /:guildId/autoresponder) and stored
 * on GuildModel.autoResponders (see src/models/Guild.js).
 *
 * Unlike sellerRoom/suggestions, this does NOT consume the message — it just
 * sends an extra reply, so it never blocks XP tracking or shortcut commands.
 * Called from messageCreate.js as a fire-and-forget step near the end of the
 * pipeline.
 */

function matches(rule, content) {
  const haystack = rule.caseSensitive ? content : content.toLowerCase();
  const needle = rule.caseSensitive ? rule.trigger : rule.trigger.toLowerCase();
  if (!needle) return false;

  switch (rule.matchType) {
    case 'exact':
      return haystack.trim() === needle.trim();
    case 'startsWith':
      return haystack.startsWith(needle);
    case 'contains':
    default:
      return haystack.includes(needle);
  }
}

function applyPlaceholders(text, message) {
  return text
    .replaceAll('{user}', `<@${message.author.id}>`)
    .replaceAll('{username}', message.author.username)
    .replaceAll('{server}', message.guild.name);
}

// Probot-style whitelist/blacklist check: if an "enabled" list is set for roles or
// channels, ONLY those roles/channels may trigger the rule; a "disabled" list always
// blocks, even if something also appears on the enabled list. Both empty (the
// default) means unrestricted.
function passesRestrictions(rule, message) {
  const channelId = message.channel.id;
  if (rule.enabledChannelIds?.length && !rule.enabledChannelIds.includes(channelId)) return false;
  if (rule.disabledChannelIds?.length && rule.disabledChannelIds.includes(channelId)) return false;

  const memberRoleIds = message.member?.roles?.cache ? [...message.member.roles.cache.keys()] : [];
  if (rule.enabledRoleIds?.length && !memberRoleIds.some((id) => rule.enabledRoleIds.includes(id))) return false;
  if (rule.disabledRoleIds?.length && memberRoleIds.some((id) => rule.disabledRoleIds.includes(id))) return false;

  return true;
}

// Picks one reply at random out of the rule's response list, so servers with
// multiple canned answers to the same trigger don't sound repetitive. Falls back
// to the legacy singular `response` field for rules saved before `responses`
// existed.
function pickResponse(rule) {
  const pool = (rule.responses?.length ? rule.responses : [rule.response]).filter((r) => r && r.trim());
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function handleMessage(message) {
  const guildDoc = await GuildModel.findOne({ guildId: message.guild.id });
  const rules = guildDoc?.autoResponders;
  if (!rules?.length) return false;

  const content = message.content || '';
  if (!content) return false;

  // First matching enabled rule wins — same "first match" contract shortcuts use,
  // so behaviour stays predictable when someone's message could match more than
  // one trigger.
  const rule = rules.find((r) => r.enabled && matches(r, content) && passesRestrictions(r, message));
  if (!rule) return false;

  const response = pickResponse(rule);
  if (!response) return false;

  await message
    .reply({
      content: applyPlaceholders(response, message).slice(0, 2000),
      allowedMentions: { repliedUser: rule.mentionUser !== false }
    })
    .catch((err) => console.error(`[autoResponder] failed to send reply in channel ${message.channel.id}:`, err.message));

  return true;
}

module.exports = { handleMessage };
