const logService = require('../services/logService');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel) {
    if (!newChannel.guild) return;
    const changes = [];
    if (oldChannel.name !== newChannel.name) changes.push(`Name: ${oldChannel.name} → ${newChannel.name}`);
    if (oldChannel.topic !== newChannel.topic) changes.push('Topic changed');
    if (oldChannel.parentId !== newChannel.parentId) changes.push(`Category: ${oldChannel.parent?.name || '—'} → ${newChannel.parent?.name || '—'}`);
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) changes.push(`Slowmode: ${oldChannel.rateLimitPerUser || 0}s → ${newChannel.rateLimitPerUser || 0}s`);
    // Discord also emits channelUpdate when permission overwrites change.
    // Compare the old/new overwrite collections so permission changes get their
    // own dashboard-controlled log entry instead of being silently ignored.
    const oldOverwrites = oldChannel.permissionOverwrites?.cache;
    const newOverwrites = newChannel.permissionOverwrites?.cache;
    let permissionChanged = false;
    if (oldOverwrites && newOverwrites) {
      const ids = new Set([...oldOverwrites.keys(), ...newOverwrites.keys()]);
      for (const id of ids) {
        const a = oldOverwrites.get(id);
        const b = newOverwrites.get(id);
        if (!a || !b || a.allow?.bitfield !== b.allow?.bitfield || a.deny?.bitfield !== b.deny?.bitfield || a.type !== b.type) {
          permissionChanged = true;
          break;
        }
      }
    }

    if (!changes.length && !permissionChanged) return;
    if (permissionChanged) {
      await logService.log(newChannel.client, newChannel.guild.id, 'channelPermissionUpdate', {
        Channel: `<#${newChannel.id}>`,
        Changes: 'Channel permission overwrites changed'
      });
    }

    if (!changes.length) return;

    await logService.log(newChannel.client, newChannel.guild.id, 'channelUpdate', {
      Channel: `<#${newChannel.id}>`,
      Changes: changes.join('\n')
    });
  }
};
