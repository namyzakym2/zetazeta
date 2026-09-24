const autoRoleRules = require('../systems/autoRoleRules');

module.exports = {
  name: 'inviteDelete',
  async execute(invite) {
    autoRoleRules.trackInviteDelete(invite);
  }
};
