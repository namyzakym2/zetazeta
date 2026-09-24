const autoRoleRules = require('../systems/autoRoleRules');

module.exports = {
  name: 'inviteCreate',
  async execute(invite) {
    autoRoleRules.trackInviteCreate(invite);
  }
};
