const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('إرسال إعلان رسمي من الإدارة / Send an official admin announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) => opt.setName('channel').setDescription('القناة').setRequired(true))
    .addStringOption((opt) => opt.setName('title').setDescription('العنوان').setRequired(true))
    .addStringOption((opt) => opt.setName('message').setDescription('نص الإعلان').setRequired(true))
    .addBooleanOption((opt) => opt.setName('mention_everyone').setDescription('منشن @everyone؟').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const channel = interaction.options.getChannel('channel', true);
    const title = interaction.options.getString('title', true);
    const message = interaction.options.getString('message', true);
    const mentionEveryone = interaction.options.getBoolean('mention_everyone') || false;

    if (mentionEveryone && !can.mentionEveryone(interaction)) {
      return interaction.reply({ content: '❌ ليس لديك صلاحية منشن @everyone.', ephemeral: true });
    }
    if (!channel.isTextBased()) return interaction.reply({ content: '❌ يجب اختيار قناة نصية.', ephemeral: true });

    const panel = buildV2Panel({
      pingContent: mentionEveryone ? '@everyone' : undefined,
      title: `📢 ${title}`,
      description: message,
      color: '#0f2158',
      footer: `ZETA — ${interaction.guild.name}`,
      timestamp: true
    });

    await channel.send(panel);

    await logService.log(interaction.client, interaction.guild.id, 'announce', {
      Channel: `<#${channel.id}>`,
      Title: title,
      Moderator: `<@${interaction.user.id}>`
    });

    return interaction.reply({ content: `✅ تم إرسال الإعلان إلى <#${channel.id}>`, ephemeral: true });
  }
};
