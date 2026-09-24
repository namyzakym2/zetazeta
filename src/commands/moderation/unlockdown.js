const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlockdown')
    .setDescription('إلغاء القفل الطارئ / Lift the emergency lockdown')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.administrator(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    await interaction.deferReply();

    const textChannels = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
    let unlocked = 0;
    for (const channel of textChannels.values()) {
      const everyoneOverwrite = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id);
      if (!everyoneOverwrite?.deny?.has(PermissionFlagsBits.SendMessages)) continue;
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null }).catch(() => {});
      unlocked += 1;
    }

    await logService.log(interaction.client, interaction.guild.id, 'unlockdown', {
      ChannelsUnlocked: unlocked,
      Moderator: `<@${interaction.user.id}>`
    });

    return interaction.editReply(`✅ تم إلغاء القفل — تم فتح ${unlocked} قناة.`);
  }
};
