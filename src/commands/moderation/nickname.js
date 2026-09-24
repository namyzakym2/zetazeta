const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const recentBotActions = require('../../utils/recentBotActions');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('تغيير اسم عضو / Change a member\'s nickname')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption((opt) => opt.setName('nickname').setDescription('الاسم الجديد (اتركه فارغًا لإعادة التعيين)').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageNicknames(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const nickname = interaction.options.getString('nickname') || null;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ العضو غير موجود في السيرفر.', ephemeral: true });
    if (!member.manageable) return interaction.reply({ content: '❌ لا أستطيع تعديل اسم هذا العضو.', ephemeral: true });

    const oldNick = member.nickname || member.user.username;
    recentBotActions.mark(interaction.guild.id, target.id, 'nickChange');
    await member.setNickname(nickname, `Changed by ${interaction.user.tag}`);

    await logService.log(interaction.client, interaction.guild.id, 'nickChange', {
      User: `<@${target.id}>`,
      Before: oldNick,
      After: nickname || target.username,
      Moderator: `<@${interaction.user.id}>`
    });

    return interaction.reply(`✏️ تم تغيير اسم **${target.tag}** إلى **${nickname || target.username}**`);
  }
};
