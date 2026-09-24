const antiNuke = require('../systems/antiNuke');

module.exports = {
  name: 'webhooksUpdate',
  async execute(channel) {
    await antiNuke.onWebhooksUpdate(channel).catch(() => {});
  }
};
