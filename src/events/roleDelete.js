const logService = require('../services/logService');
const antiNuke = require('../systems/antiNuke');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    antiNuke.onRoleDelete(role).catch(() => {});
    await logService.log(role.client, role.guild.id, 'roleDelete', {
      Role: `${role.name} (${role.id})`
    });
  }
};
