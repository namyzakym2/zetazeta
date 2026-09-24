const { Schema, model } = require('../db/mysqlCompat');

/**
 * Shield — ZETA's Wick-style protection suite (anti-nuke, anti-raid, heat anti-spam,
 * quarantine, whitelist, panic mode). One document per guild.
 * NOTE: never name a field `type` inside the nested blocks below — the DB layer treats it
 * as a schema-type marker.
 */
const limit = (max, windowSec, enabled = true) => ({
  enabled: { type: Boolean, default: enabled },
  limit: { type: Number, default: max },
  windowSec: { type: Number, default: windowSec }
});

const ShieldSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    logChannelId: { type: String, default: '' },
    quarantineRoleId: { type: String, default: '' },

    antiNuke: {
      enabled: { type: Boolean, default: false },
      punishment: { type: String, default: 'quarantine' }, // quarantine | kick | ban | strip
      revert: { type: Boolean, default: true },            // re-create deleted channels / roles
      panicOnTrigger: { type: Boolean, default: false },   // lock the server when a nuke is detected
      protectEveryone: { type: Boolean, default: true },   // revert dangerous perms on @everyone
      strictRoles: { type: Boolean, default: false },      // revert dangerous perms on ANY role
      blockBotAdd: { type: Boolean, default: false },      // kick bots added by non-whitelisted members
      channelCreate: limit(3, 10),
      channelDelete: limit(2, 10),
      roleCreate: limit(3, 10),
      roleDelete: limit(2, 10),
      ban: limit(3, 10),
      kick: limit(3, 10),
      webhookCreate: limit(2, 10)
    },

    antiRaid: {
      enabled: { type: Boolean, default: false },
      joinLimit: { type: Number, default: 8 },
      windowSec: { type: Number, default: 10 },
      action: { type: String, default: 'kick' },            // timeout | kick | ban
      raidModeMinutes: { type: Number, default: 10 },
      minAccountAgeDays: { type: Number, default: 0 },      // join gate
      blockNoAvatar: { type: Boolean, default: false },     // join gate
      autoLockdown: { type: Boolean, default: false },      // panic-lock channels when a raid starts
      raidActive: { type: Boolean, default: false },
      raidUntil: { type: Number, default: 0 }
    },

    antiSpam: {
      enabled: { type: Boolean, default: false },
      threshold: { type: Number, default: 100 },
      timeoutMinutes: { type: Number, default: 10 },
      deleteMessages: { type: Boolean, default: true }
    },

    whitelist: {
      userIds: { type: [String], default: () => [] },
      roleIds: { type: [String], default: () => [] }
    },
    trustedAdminIds: { type: [String], default: () => [] },

    quarantined: { type: Array, default: () => [] }, // [{ userId, roleIds, reason, by, at }]
    panic: {
      active: { type: Boolean, default: false },
      since: { type: Number, default: 0 },
      lockedChannelIds: { type: [String], default: () => [] }
    }
  },
  { timestamps: true }
);

module.exports = model('Shield', ShieldSchema);
