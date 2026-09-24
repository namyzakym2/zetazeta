const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('قفل طارئ لكل قنوات السيرفر / Emergency lockdown of all text channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('reason').setDescription('السبب').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    // Deliberately gated to Administrator — this is a server-wide emergency action.
    if (!can.administrator(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const reason = interaction.options.getString('reason') || 'Emergency lockdown';
    await interaction.deferReply();

    const textChannels = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
    let locked = 0;
    for (const channel of textChannels.values()) {
      const everyoneOverwrite = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id);
      // Skip channels already explicitly locked, and record nothing extra for those.
      if (everyoneOverwrite?.deny?.has(PermissionFlagsBits.SendMessages)) continue;
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason }).catch(() => {});
      locked += 1;
    }

    await logService.log(interaction.client, interaction.guild.id, 'lockdown', {
      ChannelsLocked: locked,
      Moderator: `<@${interaction.user.id}>`,
      Reason: reason
    });

    return interaction.editReply(`🚨 **LOCKDOWN ACTIVE** — تم قفل ${locked} قناة نصية.\nالسبب: ${reason}\nاستخدم /unlockdown لإلغاء القفل.`);
  }
};
