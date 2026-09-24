const welcome = require('../systems/welcome');
const autoRoleRules = require('../systems/autoRoleRules');
const inviteService = require('../services/inviteService');
const logService = require('../services/logService');
const antiRaid = require('../systems/antiRaid');
const antiNuke = require('../systems/antiNuke');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    // ZETA Shield: unauthorized bot check + join gate / raid detection run first.
    antiNuke.onMemberAdd(member).catch(() => {});
    const blocked = await antiRaid.handleMemberAdd(member).catch(() => false);
    if (blocked) return;

    // Resolve the used invite exactly once — both autoRoleRules and
    // inviteService need it, and diffing the invite-use cache twice for the
    // same join would make the second read see zero delta.
    const usedInvite = await autoRoleRules.resolveUsedInvite(member.guild);

    await welcome.handleMemberAdd(member);
    await welcome.handleGreet(member, usedInvite);
    await autoRoleRules.handleMemberAdd(member, usedInvite);
    await inviteService.recordJoin(member, usedInvite);

    await logService.log(member.client, member.guild.id, 'memberJoin', {
      User: `<@${member.id}>`,
      Account: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`
    });
  }
};
