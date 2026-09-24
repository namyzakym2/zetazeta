const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const Warning = require('../../models/Warning');
const User = require('../../models/User');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('إزالة وحذف آخر تحذير لعضو / Delete a member\'s most recent warning')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });

    const targetUser = interaction.options.getUser('user', true);
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    // التحقق من الصلاحيات
    const isOwner = interaction.guild.ownerId === interaction.user.id;
    const hasAdminPerms = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                           interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
                           interaction.member.permissions.has(PermissionFlagsBits.BanMembers) ||
                           interaction.member.permissions.has(PermissionFlagsBits.KickMembers);

    const hasCustomPerm = can.warn(interaction);

    if (!isOwner && !hasAdminPerms && !hasCustomPerm) {
      return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });
    }

    // شرط الرتب (Hierarchy Check)
    if (targetMember && !isOwner) {
      if (interaction.member.roles.highest.position <= targetMember.roles.highest.position) {
        return interaction.reply({ 
          content: '❌ لا يمكنك إزالة تحذير عن شخص رتبته أعلى منك أو مساوية لك!', 
          ephemeral: true 
        });
      }
    }

    // البحث عن آخر تحذير وحذفه نهائياً من الداتابيز
    const deletedWarning = await Warning.findOneAndDelete({ guildId: interaction.guild.id, userId: targetUser.id }).sort({ createdAt: -1 });
    if (!deletedWarning) return interaction.reply({ content: '❌ لا يوجد تحذيرات مسجلة لهذا العضو.', ephemeral: true });

    // تقليل عدد التحذيرات في ملف العضو
    await User.findOneAndUpdate(
      { guildId: interaction.guild.id, userId: targetUser.id },
      { $inc: { warnings: -1 } }
    );

    await logService.log(interaction.client, interaction.guild.id, 'unwarn', {
      User: `<@${targetUser.id}>`,
      Moderator: `<@${interaction.user.id}>`,
      RemovedReason: deletedWarning.reason
    });

    return interaction.reply(`✅ تم حذف آخر تحذير لـ **${targetUser.tag}** نهائياً من قاعدة البيانات.`);
  }
};