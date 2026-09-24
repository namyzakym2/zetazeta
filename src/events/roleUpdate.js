const logService = require('../services/logService');
const antiNuke = require('../systems/antiNuke');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    antiNuke.onRoleUpdate(oldRole, newRole).catch(() => {});
    const changes = [];
    if (oldRole.name !== newRole.name) changes.push(`Name: ${oldRole.name} → ${newRole.name}`);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`Color: ${oldRole.hexColor} → ${newRole.hexColor}`);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push('Permissions changed');
    if (oldRole.hoist !== newRole.hoist) changes.push(`Hoisted: ${oldRole.hoist} → ${newRole.hoist}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`Mentionable: ${oldRole.mentionable} → ${newRole.mentionable}`);
    if (!changes.length) return; // position-only reshuffles fire this event constantly — skip those

    await logService.log(newRole.client, newRole.guild.id, 'roleUpdate', {
      Role: `<@&${newRole.id}>`,
      Changes: changes.join('\n')
    });
  }
};
