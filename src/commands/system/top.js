const leaderboard = require('../activity/leaderboard');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('top').setDescription('اختصار للـ leaderboard')
    .addStringOption(o => o.setName('type').setDescription('نوع الترتيب').setRequired(false)
      .addChoices({name:'شامل',value:'all'},{name:'تكت',value:'ticket_points'},{name:'تفاعل',value:'interaction_points'}))
    .addRoleOption(o => o.setName('role').setDescription('الرتبة').setRequired(false)),
  async execute(i) { return leaderboard.execute(i); }
};
