const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');
const { can } = require('../../utils/permissions');
const GuildModel = require('../../models/Guild');
const { t } = require('../../services/translationService');
const applicationService = require('../../services/applicationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application-panel')
    .setDescription('إرسال بانل تقديم الإدارة / Send a staff-application panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName('name').setDescription('اسم البانل (اللي سويته بـ /application-setup)').setRequired(true).setAutocomplete(true))
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('القناة (اختياري، الافتراضي الحالية)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = (guildDoc?.applicationPanels || [])
      .map((p) => p.name)
      .filter((name) => name.toLowerCase().includes(focused))
      .slice(0, 25);
    return interaction.respond(choices.map((name) => ({ name, value: name })));
  },

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
    const name = interaction.options.getString('name');
    const panel = guildDoc?.applicationPanels?.find((p) => p.name === name);

    if (!panel) {
      return interaction.reply({
        content: `❌ ما فيه بانل تقديم بهذا الاسم. سوّي وحدة أول بـ \`/application-setup name:${name}\`.`,
        ephemeral: true
      });
    }

    if (!panel.reviewChannelId && !panel.createTicketOnSubmit) {
      return interaction.reply({
        content: '❌ ما حددت "روم المراجعة" ولا فعّلت "create_ticket" لهذا البانل. اضبط أحدهما أول بـ `/application-setup`.',
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased()) {
      return interaction.reply({ content: '❌ اختر قناة نصية صالحة لإرسال البانل فيها.', ephemeral: true });
    }

    const botPerms = channel.permissionsFor(interaction.guild.members.me);
    const required = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks];
    if (!botPerms || !botPerms.has(required)) {
      return interaction.reply({
        content: `❌ البوت ما عنده صلاحية الإرسال/رؤية القناة <#${channel.id}>. أعطِ البوت (View Channel, Send Messages, Embed Links) وحاول مرة ثانية.`,
        ephemeral: true
      });
    }

    try {
      const payload = applicationService.buildPanelPayload(interaction.guild, panel);
      await channel.send(payload);

      panel.panelChannelId = channel.id;
      await guildDoc.save();

      return interaction.reply({ content: `✅ تم إرسال بانل التقديم **${name}** إلى <#${channel.id}>`, ephemeral: true });
    } catch (err) {
      console.error('Failed to send application panel:', err);
      return interaction.reply({
        content: `❌ فشل إرسال البانل إلى <#${channel.id}>.\n(${err.message})`,
        ephemeral: true
      });
    }
  }
};
