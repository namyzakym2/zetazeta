const { SlashCommandBuilder } = require('discord.js');
const GuildModel = require('../../models/Guild');
const shortcutService = require('../../services/shortcutService');
const { t } = require('../../services/translationService');
const { buildV2Panel, ephemeralV2 } = require('../../utils/componentsV2');

/**
 * /shortcuts — lists every shortcut currently active for this server (custom ones
 * from the dashboard if configured, otherwise the built-in defaults), grouped by
 * command, so members can discover both the Arabic and English word for each one.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('shortcuts')
    .setDescription('عرض كل اختصارات الأوامر / List all command shortcuts'),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });

    const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
    const list = [...shortcutService.DEFAULT_SHORTCUTS, ...(guildDoc?.shortcuts || [])];
    const prefix = guildDoc?.prefix ?? process.env.DEFAULT_PREFIX ?? '';

    const byCommand = new Map();
    for (const s of list) {
      if (s.enabled === false) continue;
      if (!byCommand.has(s.command)) byCommand.set(s.command, []);
      byCommand.get(s.command).push(s.shortcut);
    }

    const lines = [...byCommand.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([command, shortcuts]) => `**/${command}** — ${shortcuts.map((s) => `\`${prefix}${s}\``).join(' , ')}`);

    const panel = buildV2Panel({
      title: '⚡ Shortcuts',
      color: '#0f2158',
      description: lines.join('\n') || 'لا توجد اختصارات.'
    });

    return interaction.reply(ephemeralV2(panel));
  }
};
