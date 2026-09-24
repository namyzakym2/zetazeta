const voiceActivityService = require('../services/voiceActivityService');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    await voiceActivityService.handleVoiceStateUpdate(oldState, newState).catch((err) => {
      console.error('[voiceStateUpdate]', err.message);
    });
  }
};
