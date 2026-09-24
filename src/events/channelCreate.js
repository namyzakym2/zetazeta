const logService = require('../services/logService');
const GuildModel = require('../models/Guild');
const antiNuke = require('../systems/antiNuke');

module.exports = {
  name: 'channelCreate',
  async execute(channel) {
    antiNuke.onChannelCreate(channel).catch(() => {});
    if (!channel.guild) return;

    // Keep the automatically-managed mute role restricted in newly-created channels too.
    const guildDoc = await GuildModel.findOne({ guildId: channel.guild.id }).catch(() => null);
    if (guildDoc?.muteRoleId && channel.permissionOverwrites) {
      await channel.permissionOverwrites.edit(guildDoc.muteRoleId, {
        SendMessages: false, AddReactions: false, Speak: false, Stream: false
      }).catch(() => {});
    }
    await logService.log(channel.client, channel.guild.id, 'channelCreate', {
      Channel: `${channel.name} (${channel.id})`,
      Type: String(channel.type),
      Category: channel.parent?.name || '—'
    });
  }
};
