const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const { can } = require('../../utils/permissions');
const { t } = require('../../services/translationService');

/**
 * /setup-ticket opens a Modal for the panel's appearance (title, description, color,
 * footer, image). Button-per-category/role configuration (multiple buttons, categories,
 * support roles) has more fields than a Discord Modal supports (max 5 inputs), so that
 * part is configured from the Admin Dashboard's "Advanced Ticket Setup" page, which has
 * a live preview. This command is the fast entry point; the dashboard is the full wizard.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('إعداد متقدم لنظام التذاكر / Advanced ticket setup wizard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const modal = new ModalBuilder().setCustomId('setup_ticket_modal').setTitle('🎫 Ticket Panel Setup');

    const title = new TextInputBuilder().setCustomId('panelTitle').setLabel('Panel Title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
    const description = new TextInputBuilder().setCustomId('panelDescription').setLabel('Panel Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
    const color = new TextInputBuilder().setCustomId('panelColor').setLabel('Color (hex, e.g. #0f2158)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7);
    const footer = new TextInputBuilder().setCustomId('panelFooter').setLabel('Footer text').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100);
    const image = new TextInputBuilder().setCustomId('panelImage').setLabel('Image URL (optional)').setStyle(TextInputStyle.Short).setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(title),
      new ActionRowBuilder().addComponents(description),
      new ActionRowBuilder().addComponents(color),
      new ActionRowBuilder().addComponents(footer),
      new ActionRowBuilder().addComponents(image)
    );

    await interaction.showModal(modal);
  }
};
