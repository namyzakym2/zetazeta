const BotGuild = require('../models/BotGuild');
const { updatePresence } = require('../utils/presence');

module.exports = {
  name: 'guildDelete',
  async execute(guild) {
    await BotGuild.deleteOne({ guildId: guild.id });
    console.log(`➖ Left guild: ${guild.name} (${guild.id})`);
    await updatePresence(guild.client);
  }
};
