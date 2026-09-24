const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const GuildModel = require('../../models/Guild');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

/**
 * /language — dedicated top-level command to switch the bot's language, so it can
 * carry its own shortcut (e.g. "lang" / "لغة"). Does the exact same thing as
 * /system locale — kept for anyone already used to that one.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription('تغيير لغة البوت / Change the bot language')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o
        .setName('locale')
        .setDescription('ar/en')
        .setRequired(true)
        .addChoices({ name: 'العربية', value: 'ar' }, { name: 'English', value: 'en' })
    ),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const locale = interaction.options.getString('locale', true);
    const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id }) || await GuildModel.create({ guildId: interaction.guild.id });
    guildDoc.locale = locale;
    await guildDoc.save();

    await logService.log(interaction.client, interaction.guild.id, 'systemConfigChange', {
      Setting: 'locale',
      Moderator: `<@${interaction.user.id}>`
    });

    return interaction.reply(`🌍 Locale: ${locale}`);
  }
};
