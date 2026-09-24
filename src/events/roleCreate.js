const logService = require('../services/logService');
const antiNuke = require('../systems/antiNuke');

module.exports = {
  name: 'roleCreate',
  async execute(role) {
    antiNuke.onRoleCreate(role).catch(() => {});
    await logService.log(role.client, role.guild.id, 'roleCreate', {
      Role: `${role.name} (${role.id})`,
      Color: role.hexColor
    });
  }
};
