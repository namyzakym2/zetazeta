const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('حذف رسائل / Bulk delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) => opt.setName('amount').setDescription('عدد الرسائل (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((opt) => opt.setName('user').setDescription('حذف رسائل عضو محدد فقط').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageMessages(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    let toDelete = [...messages.values()];
    if (targetUser) toDelete = toDelete.filter((m) => m.author.id === targetUser.id);
    toDelete = toDelete.slice(0, amount);

    const deleted = await interaction.channel.bulkDelete(toDelete, true).catch(() => null);

    return interaction.editReply(`🧹 تم حذف ${deleted ? deleted.size : 0} رسالة.`);
  }
};
