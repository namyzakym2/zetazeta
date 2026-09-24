const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField } = require('discord.js');
const { can } = require('../../utils/permissions');
const GuildModel = require('../../models/Guild');
const { t } = require('../../services/translationService');
const ticketService = require('../../services/ticketService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('إرسال لوحة فتح التذاكر / Send the ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('القناة (اختياري، الافتراضي الحالية)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    // A panel publish performs a real Discord API request and can occasionally take
    // longer than Discord's 3-second interaction acknowledgement window. Defer first
    // so a slow Discord connection never turns the eventual error into 10062 Unknown interaction.
    await interaction.deferReply({ ephemeral: true });

    const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id }) || await GuildModel.create({ guildId: interaction.guild.id });
    const settings = guildDoc.ticketSettings;

    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (!channel?.isTextBased() || channel.isDMBased()) {
      return interaction.editReply({ content: '❌ اختر قناة نصية صالحة لإرسال لوحة التذاكر فيها.' });
    }

    // The #1 real-world cause of "the panel didn't publish": the bot itself doesn't
    // have permission to post/embed in the target channel. Check this up front and
    // give a clear, actionable error instead of letting channel.send() throw and
    // fall through to the generic error handler in interactionCreate.js.
    const botPerms = channel.permissionsFor(interaction.guild.members.me);
    const required = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks];
    if (!botPerms || !botPerms.has(required)) {
      return interaction.editReply({
        content: `❌ البوت ما عنده صلاحية الإرسال/رؤية القناة <#${channel.id}>. أعطِ البوت صلاحيات (View Channel, Send Messages, Embed Links) في هذه القناة وحاول مرة ثانية.`,
      });
    }

    // Everything below used to be able to throw synchronously (e.g. an invalid emoji
    // string saved from the dashboard) with no try/catch around it — that exception
    // escaped straight past this command and was only caught by the generic handler
    // in interactionCreate.js, which just shows "حدث خطأ أثناء تنفيذ هذا الأمر" with
    // no useful detail. Wrapping it here means a bad button never breaks the whole
    // panel and the admin gets a message that actually explains what happened.
    try {
      const payload = ticketService.buildOpenPanelPayload(interaction.guild, settings, 'main');

      // Only persist "enabled" + the panel channel AFTER the message actually sends —
      // previously this was saved first, so a failed send (e.g. permissions) could leave
      // the DB thinking the panel was published when nothing was ever posted.
      let sent = false;
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await channel.send(payload);
          sent = true;
          break;
        } catch (err) {
          lastError = err;
          const code = err?.code || err?.cause?.code;
          const timeout = code === 'UND_ERR_CONNECT_TIMEOUT' || /Connect Timeout|ETIMEDOUT/i.test(String(err?.message || ''));
          if (!timeout || attempt === 3) break;
          await new Promise(resolve => setTimeout(resolve, 750 * attempt));
        }
      }
      if (!sent) throw lastError || new Error('DISCORD_SEND_FAILED');

      guildDoc.ticketSettings.enabled = true;
      guildDoc.ticketSettings.panelChannelId = channel.id;
      await guildDoc.save();

      return interaction.editReply({ content: `✅ تم إرسال لوحة التذاكر إلى <#${channel.id}>` });
    } catch (err) {
      console.error('Failed to send ticket panel:', err);
      return interaction.editReply({
        content:
          `❌ فشل إرسال لوحة التذاكر إلى <#${channel.id}>.\n` +
          'إذا ظهر Connect Timeout فالمشكلة اتصال Discord مؤقتة؛ حاول مرة ثانية.\n' +
          `(${err.message})`
      });
    }
  }
};
