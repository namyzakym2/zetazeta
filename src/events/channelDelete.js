const logService = require('../services/logService');
const antiNuke = require('../systems/antiNuke');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    antiNuke.onChannelDelete(channel).catch(() => {});
    if (!channel.guild) return;
    await logService.log(channel.client, channel.guild.id, 'channelDelete', {
      Channel: `${channel.name} (${channel.id})`,
      Type: String(channel.type)
    });
  }
};
