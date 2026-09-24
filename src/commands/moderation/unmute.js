const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const GuildModel = require('../../models/Guild');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('فك كتم عضو / Unmute a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.timeout(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });

    if (!guildDoc?.muteRoleId) return interaction.reply({ content: '❌ لا يوجد رول كتم مُعد بعد لهذا السيرفر.', ephemeral: true });

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ العضو غير موجود في السيرفر.', ephemeral: true });

    if (!member.roles.cache.has(guildDoc.muteRoleId)) {
      return interaction.reply({ content: '❌ هذا العضو غير مكتوم.', ephemeral: true });
    }

    await member.roles.remove(guildDoc.muteRoleId, 'Unmute command');

    await logService.log(interaction.client, interaction.guild.id, 'unmute', {
      User: `${target.tag} (${target.id})`,
      Moderator: `<@${interaction.user.id}>`
    });

    return interaction.reply(`🔊 تم فك كتم **${target.tag}**`);
  }
};
