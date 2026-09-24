const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const Warning = require('../../models/Warning');
const User = require('../../models/User');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('حذف جميع تحذيرات عضو دفعة واحدة / Clear all of a member\'s warnings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });

    const isOwner = interaction.guild.ownerId === interaction.user.id;
    const hasAdminPerms =
      interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
      interaction.member.permissions.has(PermissionFlagsBits.BanMembers) ||
      interaction.member.permissions.has(PermissionFlagsBits.KickMembers);
    const hasCustomPerm = can.warn(interaction);

    if (!isOwner && !hasAdminPerms && !hasCustomPerm) {
      return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user', true);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (targetMember && !isOwner) {
      if (interaction.member.roles.highest.position <= targetMember.roles.highest.position) {
        return interaction.reply({
          content: '❌ لا يمكنك حذف تحذيرات شخص رتبته أعلى منك أو مساوية لك!',
          ephemeral: true
        });
      }
    }

    const { deletedCount } = await Warning.deleteMany({ guildId: interaction.guild.id, userId: targetUser.id });
    if (!deletedCount) {
      return interaction.reply({ content: '❌ لا يوجد تحذيرات مسجلة لهذا العضو.', ephemeral: true });
    }

    await User.findOneAndUpdate(
      { guildId: interaction.guild.id, userId: targetUser.id },
      { $set: { warnings: 0 } }
    );

    await logService.log(interaction.client, interaction.guild.id, 'unwarn', {
      User: `<@${targetUser.id}>`,
      Moderator: `<@${interaction.user.id}>`,
      RemovedReason: `تم حذف كل التحذيرات (${deletedCount})`
    });

    return interaction.reply(`✅ تم حذف **${deletedCount}** تحذير لـ **${targetUser.tag}** نهائيًا من قاعدة البيانات.`);
  }
};
