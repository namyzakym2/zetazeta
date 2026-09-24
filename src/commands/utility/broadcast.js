const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('إرسال برودكاست من البوت إلى قناة محددة')
    .addChannelOption(o => o
      .setName('القناة')
      .setDescription('القناة التي سيصل إليها البرودكاست')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption(o => o
      .setName('الرسالة')
      .setDescription('نص البرودكاست')
      .setRequired(true)
      .setMaxLength(2000))
    .addStringOption(o => o
      .setName('العنوان')
      .setDescription('عنوان البرودكاست (اختياري)')
      .setRequired(false)
      .setMaxLength(256))
    .addBooleanOption(o => o
      .setName('منشن_الكل')
      .setDescription('إضافة @everyone إلى البرودكاست')
      .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('القناة', true);
    const message = interaction.options.getString('الرسالة', true);
    const title = interaction.options.getString('العنوان');
    const everyone = interaction.options.getBoolean('منشن_الكل') ?? false;

    await interaction.deferReply({ ephemeral: true });

    if (!channel.isTextBased()) {
      return interaction.editReply('❌ القناة المحددة لا تدعم إرسال الرسائل.');
    }

    const botMember = interaction.guild.members.me;
    const permissions = channel.permissionsFor(botMember);
    if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions?.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply('❌ البوت لا يملك صلاحية مشاهدة/إرسال الرسائل في القناة المحددة.');
    }

    try {
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setDescription(message)
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

      if (title) embed.setTitle(title);

      await channel.send({
        content: everyone ? '@everyone' : undefined,
        embeds: [embed],
        allowedMentions: everyone ? { parse: ['everyone'] } : { parse: [] },
      });

      await interaction.editReply(`✅ تم إرسال البرودكاست بنجاح إلى ${channel}.`);
    } catch (error) {
      console.error('broadcast command:', error);
      await interaction.editReply('❌ فشل إرسال البرودكاست. تأكد من صلاحيات البوت والقناة.');
    }
  },
};
