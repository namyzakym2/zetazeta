const BotGuild = require('../models/BotGuild');
const guildBlockService = require('../services/guildBlockService');
const autoRoleRules = require('../systems/autoRoleRules');
const { updatePresence } = require('../utils/presence');

module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    // Blocked servers (ZetaBot Panel) — leave immediately, never register in BotGuild.
    if (await guildBlockService.isBlocked(guild.id)) {
      console.log(`🚫 Blocked guild tried to add ZETA — leaving: ${guild.name} (${guild.id})`);
      await guild.leave().catch(() => {});
      await updatePresence(guild.client);
      return;
    }

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
    await autoRoleRules.cacheGuildInvites(guild);
    console.log(`➕ Joined guild: ${guild.name} (${guild.id})`);
    await updatePresence(guild.client);
  }
};
