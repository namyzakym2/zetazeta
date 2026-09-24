const logService = require('../services/logService');

module.exports = {
  name: 'threadCreate',
  async execute(thread, newlyCreated) {
    if (!newlyCreated) return;
    await logService.log(thread.client, thread.guild.id, 'threadCreate', {
      Thread: `${thread.name} (${thread.id})`,
      Parent: thread.parent ? `<#${thread.parent.id}>` : '—',
      Owner: thread.ownerId ? `<@${thread.ownerId}>` : '—'
    });
  }
};
