const logService = require('../services/logService');

module.exports = {
  name: 'threadUpdate',
  async execute(oldThread, newThread) {
    const changes = [];
    if (oldThread.name !== newThread.name) changes.push(`Name: ${oldThread.name} → ${newThread.name}`);
    if (oldThread.archived !== newThread.archived) changes.push(`Archived: ${oldThread.archived} → ${newThread.archived}`);
    if (oldThread.locked !== newThread.locked) changes.push(`Locked: ${oldThread.locked} → ${newThread.locked}`);
    if (!changes.length) return;

    await logService.log(newThread.client, newThread.guild.id, 'threadUpdate', {
      Thread: `${newThread.name} (${newThread.id})`,
      Changes: changes.join('\n')
    });
  }
};
