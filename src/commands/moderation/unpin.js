const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unpin')
    .setDescription('إلغاء تثبيت رسالة عبر رقمها / Unpin a message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((opt) => opt.setName('message_id').setDescription('معرف الرسالة (ID)').setRequired(true)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageMessages(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const messageId = interaction.options.getString('message_id', true);

    const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return interaction.reply({ content: '❌ لم يتم العثور على رسالة بهذا المعرف في هذه القناة.', ephemeral: true });
    }

    if (!message.pinned) {
      return interaction.reply({ content: '❌ هذه الرسالة غير مثبّتة أصلًا.', ephemeral: true });
    }

    await message.unpin().catch(() => null);

    await logService.log(interaction.client, interaction.guild.id, 'unpin', {
      Channel: `<#${interaction.channel.id}>`,
      Message: `[Jump](${message.url})`,
      By: `<@${interaction.user.id}>`
    });

    return interaction.reply({ content: '📌 تم إلغاء تثبيت الرسالة.', ephemeral: true });
  }
};
