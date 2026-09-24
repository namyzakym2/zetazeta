const logService = require('../services/logService');

module.exports = {
  name: 'threadDelete',
  async execute(thread) {
    await logService.log(thread.client, thread.guild.id, 'threadDelete', {
      Thread: `${thread.name} (${thread.id})`,
      Parent: thread.parent ? `<#${thread.parent.id}>` : '—'
    });
  }
};
