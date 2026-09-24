const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { deployGlobalCommands } = require('../../utils/deployCommands');

/**
 * /update-commands — redeploys every slash command from src/commands to Discord
 * without needing shell access to run `npm run deploy` or restart the bot. The bot
 * also auto-deploys on every boot (see src/events/ready.js); this is for picking up
 * a newly added/edited command file while the bot is already running.
 *
 * Restricted to OWNER_ID (set in .env) because this changes GLOBAL commands —
 * i.e. every server the bot is in, not just the one this is run from.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('update-commands')
    .setDescription('تحديث/إعادة نشر أوامر السلاش (للمالك فقط) / Redeploy slash commands (owner only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
      return interaction.reply({
        content: '❌ هذا الأمر مخصص لمالك البوت فقط (OWNER_ID في ملف .env).',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const deployed = await deployGlobalCommands(interaction.client);
      const skippedText = deployed.skipped.length
        ? ` تم حذف/تجاهل ${deployed.skipped.length} أمر غير صالح.`
        : '';
      const cleanedText = deployed.removedGuildCommands.length
        ? ` وتم تنظيف ${deployed.removedGuildCommands.length} أمر قديم من السيرفرات.`
        : '';
      return interaction.editReply(`✅ تم مزامنة **${deployed.data.size}** أمر صالح.${skippedText}${cleanedText}`);
    } catch (err) {
      console.error('Failed to update slash commands:', err);
      return interaction.editReply(`❌ فشل تحديث الأوامر: ${err.message}`);
    }
  }
};
