const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const recentBotActions = require('../../utils/recentBotActions');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('إدارة رولات الأعضاء / Manage member roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) =>
      s.setName('add').setDescription('إضافة رول لعضو')
        .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('الرول').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('remove').setDescription('إزالة رول من عضو')
        .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('الرول').setRequired(true))
    ),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageRoles(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ العضو غير موجود في السيرفر.', ephemeral: true });

    const isOwner = interaction.guild.ownerId === interaction.user.id;

    // 1. منع تعديل/إعطاء رتبة أعلى من أو تساوي رتبة الشخص المنفذ (إلا إذا كان Owner)
    if (!isOwner && role.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: '❌ لا يمكنك إعطاء أو إزالة رتبة أعلى من رتبتك الشخصية أو مساوية لها!', ephemeral: true });
    }

    // 2. منع تعديل رتبة أعلى من رتبة البوت
    const botMember = interaction.guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({ content: '❌ هذا الرول أعلى من صلاحيات البوت في السيرفر.', ephemeral: true });
    }

    if (sub === 'add') {
      if (member.roles.cache.has(role.id)) {
        return interaction.reply({ content: '❌ العضو يمتلك هذا الرول بالفعل.', ephemeral: true });
      }
      
      recentBotActions.mark(interaction.guild.id, target.id, 'roleAdd');
      await member.roles.add(role, `Added by ${interaction.user.tag}`);
      await logService.log(interaction.client, interaction.guild.id, 'roleAdd', {
        User: `<@${target.id}>`, Role: `<@&${role.id}>`, Moderator: `<@${interaction.user.id}>`
      });
      return interaction.reply(`➕ تم إضافة **${role.name}** إلى **${target.tag}**`);
    }

    if (sub === 'remove') {
      if (!member.roles.cache.has(role.id)) {
        return interaction.reply({ content: '❌ العضو لا يمتلك هذا الرول.', ephemeral: true });
      }

      recentBotActions.mark(interaction.guild.id, target.id, 'roleRemove');
      await member.roles.remove(role, `Removed by ${interaction.user.tag}`);
      await logService.log(interaction.client, interaction.guild.id, 'roleRemove', {
        User: `<@${target.id}>`, Role: `<@&${role.id}>`, Moderator: `<@${interaction.user.id}>`
      });
      return interaction.reply(`➖ تم إزالة **${role.name}** من **${target.tag}**`);
    }
  }
};