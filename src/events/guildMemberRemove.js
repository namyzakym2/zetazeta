const leave = require('../systems/leave');
const inviteService = require('../services/inviteService');
const logService = require('../services/logService');
const antiNuke = require('../systems/antiNuke');
const activityService = require('../services/activityService');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    antiNuke.onMemberRemove(member).catch(() => {});
    await leave.handleMemberRemove(member);
    await inviteService.recordLeave(member);
    const levelSettings = await activityService.getLevelSettings(member.guild.id).catch(() => null);
    if (levelSettings?.resetOnLeave) await activityService.resetUser(member.guild.id, member.id);
    await logService.log(member.client, member.guild.id, 'memberLeave', {
      User: `${member.user.tag} (${member.id})`
    });
  }
};
