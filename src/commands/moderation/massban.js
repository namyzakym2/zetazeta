const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massban')
    .setDescription('حظر عدة أعضاء دفعة واحدة عن طريق الـ IDs / Ban multiple users by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('user_ids').setDescription('IDs مفصولة بمسافة').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('السبب').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    // Deliberately gated behind Administrator (not just Ban Members) since this is a
    // bulk, high-impact action.
    if (!can.administrator(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const idsRaw = interaction.options.getString('user_ids', true);
    const reason = interaction.options.getString('reason') || 'Mass ban';
    const ids = [...new Set(idsRaw.split(/\s+/).filter((id) => /^\d{15,25}$/.test(id)))];

    if (!ids.length) return interaction.reply({ content: '❌ لم يتم العثور على أي معرف صالح (ID).', ephemeral: true });
    if (ids.length > 50) return interaction.reply({ content: '❌ الحد الأقصى 50 عضو في المرة الواحدة.', ephemeral: true });

    await interaction.deferReply();

    let success = 0;
    let failed = 0;
    for (const id of ids) {
      if (id === interaction.guild.ownerId) { failed += 1; continue; } // never ban the owner, even by ID
      try {
        await interaction.guild.members.ban(id, { reason });
        success += 1;
      } catch {
        failed += 1;
      }
    }

    await logService.log(interaction.client, interaction.guild.id, 'massban', {
      Count: ids.length,
      Success: success,
      Failed: failed,
      Moderator: `<@${interaction.user.id}>`,
      Reason: reason
    });

    return interaction.editReply(`🔨 Mass ban complete.\n✅ Success: ${success}\n❌ Failed: ${failed}`);
  }
};
