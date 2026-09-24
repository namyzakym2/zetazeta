const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('عرض قائمة أوامر TREBIZOND EMPIRE'),
  async execute(i) {
    const groups = {
      '🛡️ الإدارة': ['ban','kick','timeout','warn','unwarn','warnings','clearwarnings','purge','clear','lock','unlock','hide','unhide','lockdown','unlockdown'],
      '🎫 الأنظمة': ['setup-ticket','ticket-panel','ticket-panels','tickets-reset','setup-application','application-panel','suggestions','ai-channel'],
      '📊 المعلومات': ['serverinfo','userinfo','channelinfo','membercount','rolelist','ping','uptime','botinfo','leaderboard','profile'],
      '🎉 الترفيه': ['8ball','coinflip','joke','random','rate','roll','ship','slap','wyr'],
      '🔧 الأدوات': ['say','embed','poll','choose','avatar','permissions','afk','remind','invite','suggest','broadcast'],
    };
    const available = new Set([...i.client.commands.keys()]);
    const fields = Object.entries(groups).map(([name, list]) => ({
      name,
      value: list.filter(x => available.has(x)).map(x => `/${x}`).join(' • ') || 'لا توجد أوامر',
      inline: false,
    }));
    return i.reply({ embeds: [new EmbedBuilder().setColor(0x7c5cff).setTitle('⚡ TREBIZOND EMPIRE — الأوامر').setDescription('قائمة مختصرة لأهم أوامر البوت.\nيمكنك أيضاً استخدام الاختصارات التي يحددها صاحب السيرفر من الداش.').addFields(fields).setFooter({ text: 'TREBIZOND EMPIRE • Command Center' })] });
  },
};
