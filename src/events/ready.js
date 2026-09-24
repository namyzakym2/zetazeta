const BotGuild = require('../models/BotGuild');
const giveawaySystem = require('../systems/giveaways');
const voteReminder = require('../systems/voteReminder');
const autoRoleRules = require('../systems/autoRoleRules');
const tempBanSystem = require('../systems/tempBanSystem');
const { getOrCreateMuteRole } = require('../commands/moderation/mute');
const { deployGlobalCommands } = require('../utils/deployCommands');
const { updatePresence } = require('../utils/presence');
const { syncZetaBotAssets } = require('../utils/zetaEmojis');
const voiceActivityService = require('../services/voiceActivityService');
const shieldService = require('../services/shieldService');
const path = require('path');
const fs = require('fs');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`😈 ZETA is online as ${client.user.tag}`);
    await updatePresence(client);
    voiceActivityService.startAutoFlush();
    // ZETA Shield: expire raid mode automatically.
    setInterval(() => shieldService.tick(client).catch(() => {}), 30_000);
    // Recover members who were already in voice when ZETA restarted.
    for (const guild of client.guilds.cache.values()) {
      for (const state of guild.voiceStates.cache.values()) {
        if (state.channelId && !state.member?.user?.bot) {
          await voiceActivityService.handleVoiceStateUpdate(
            { guild, id: state.id, channelId: null, member: state.member },
            state
          ).catch(() => {});
        }
      }
    }

    // Do NOT set client.user avatar here: /botprofile intentionally supports per-server
    // nicknames/avatars and a global avatar update would overwrite the global identity.

    // ZETA branding: create application emojis on the bot itself, then mirror the
    // same pack into the official support server when ZETA_SUPPORT_GUILD_ID is set.
    await syncZetaBotAssets(client).catch((err) => console.error('⚠️ ZETA asset sync failed:', err.message));

    // ZETA manages its dedicated mute role automatically. It is intentionally
    // not exposed as a dashboard setting: the bot creates/reuses it per server.
    for (const guild of client.guilds.cache.values()) {
      await getOrCreateMuteRole(guild).catch((err) => {
        console.error(`⚠️ Failed to ensure mute role in ${guild.name}:`, err.message);
      });
    }

    // Auto Rules needs a starting snapshot of every guild's invite use-counts so it
    // can later diff against them to guess which invite a new member came through.
    for (const guild of client.guilds.cache.values()) {
      await autoRoleRules.cacheGuildInvites(guild);
    }

    // Keep the BotGuild collection in sync with reality on every startup, so the
    // dashboard's server picker never shows stale or missing servers.
    await syncGuilds(client).catch((err) => console.error('Guild sync failed:', err));

    // Auto-deploy slash commands on every boot, so a new/renamed command file is
    // live the moment the bot restarts — no more forgetting to run `npm run deploy`
    // (or waiting on it) after every change. Also available on-demand as /update-commands.
    try {
      const deployed = await deployGlobalCommands(client);
      console.log(`🚀 Auto-deployed ${deployed.data.size} valid slash commands.`);
      if (deployed.skipped.length) {
        console.warn(`⚠️ Removed/skipped ${deployed.skipped.length} invalid command file(s) from deployment.`);
      }
      if (deployed.removedGuildCommands.length) {
        console.log(`🧹 Removed ${deployed.removedGuildCommands.length} stale guild-local command(s).`);
      }
    } catch (err) {
      console.error('⚠️ Auto-deploy of slash commands failed:', err.message);
    }

    // Poll every 15s for giveaways whose timer ran out while nobody was watching,
    // and end them automatically (picks winners and sends a new result message; the original giveaway stays unchanged).
    await giveawaySystem.checkExpired(client).catch((err) => console.error('Giveaway check failed:', err));
    setInterval(() => {
      giveawaySystem.checkExpired(client).catch((err) => console.error('Giveaway check failed:', err));
    }, 15_000);

    // Every 30 minutes, DM anyone whose 12h vote cooldown has expired to remind
    // them they can vote again — keeps repeat votes (and bot visibility on vote
    // sites) going without relying on people remembering on their own.
    await voteReminder.checkAndRemind(client).catch((err) => console.error('Vote reminder check failed:', err));
    setInterval(() => {
      voteReminder.checkAndRemind(client).catch((err) => console.error('Vote reminder check failed:', err));
    }, 30 * 60_000);

    // Every minute, auto-unban anyone whose /tempban duration has expired.
    await tempBanSystem.checkExpired(client).catch((err) => console.error('Temp ban check failed:', err));
    setInterval(() => {
      tempBanSystem.checkExpired(client).catch((err) => console.error('Temp ban check failed:', err));
    }, 60_000);
  }
};

async function syncGuilds(client) {
  const currentIds = [...client.guilds.cache.keys()];

  for (const guild of client.guilds.cache.values()) {
    await BotGuild.findOneAndUpdate(
      { guildId: guild.id },
      {
        guildId: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 128 }) || '',
        memberCount: guild.memberCount
      },
      { upsert: true }
    );
  }

  // Remove any server the bot is no longer in (e.g. it was kicked while offline).
  await BotGuild.deleteMany({ guildId: { $nin: currentIds } });
  console.log(`🔄 Synced ${currentIds.length} guild(s) to BotGuild collection.`);
}
