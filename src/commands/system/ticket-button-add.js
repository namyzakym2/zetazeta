const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Ticket = require('../../models/Ticket');
const ticketService = require('../../services/ticketService');
const { can } = require('../../utils/permissions');
const { setEmojiSafe } = require('../../utils/emoji');

const VALID_STYLES = new Set(['Primary', 'Secondary', 'Success', 'Danger']);

/**
 * /ticket-button-add — run this INSIDE an open ticket channel to add a custom
 * quick-reply button there (e.g. "Payment Info", "Escalate to Manager"). Whoever
 * clicks the button gets `response` posted in the channel — see tickets.js
 * (customId `ticket_custom_<ticketId>_<buttonId>`) and Ticket.customButtons.
 *
 * Usable by the ticket's own owner (their ticket) or by staff (Manage Server) — not
 * by random members who happen to be added to the channel.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-button-add')
    .setDescription('إضافة زر مخصص لهذه التذكرة / Add a custom button to this ticket')
    .addStringOption((opt) => opt.setName('label').setDescription('نص الزر').setRequired(true).setMaxLength(80))
    .addStringOption((opt) =>
      opt.setName('response').setDescription('الرسالة اللي تنبعث لما أحد يضغط الزر').setRequired(true).setMaxLength(1000)
    )
    .addStringOption((opt) =>
      opt
        .setName('style')
        .setDescription('شكل الزر (افتراضي: Secondary)')
        .setRequired(false)
        .addChoices(
          { name: 'Primary (أزرق)', value: 'Primary' },
          { name: 'Secondary (رمادي)', value: 'Secondary' },
          { name: 'Success (أخضر)', value: 'Success' },
          { name: 'Danger (أحمر)', value: 'Danger' }
        )
    )
    .addStringOption((opt) => opt.setName('emoji').setDescription('إيموجي للزر (اختياري)').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'هذا الأمر يشتغل داخل سيرفر بس.', ephemeral: true });

    const ticket = await Ticket.findOne({ guildId: interaction.guild.id, channelId: interaction.channel.id });
    if (!ticket) {
      return interaction.reply({ content: '❌ هذا الأمر يشتغل بس جوه قناة تذكرة (تكت) مفتوحة.', ephemeral: true });
    }
    if (ticket.status !== 'open') {
      return interaction.reply({ content: '❌ هذه التذكرة مقفولة، ما تقدر تضيف زر فيها.', ephemeral: true });
    }

    // Owner of THIS ticket, or staff (Manage Server) — not just anyone in the channel.
    const isOwner = interaction.user.id === ticket.ownerId;
    if (!isOwner && !can.manageGuild(interaction)) {
      return interaction.reply({ content: '❌ بس صاحب التذكرة أو الستاف يقدر يضيف زر هنا.', ephemeral: true });
    }

    const label = interaction.options.getString('label');
    const response = interaction.options.getString('response');
    const styleRaw = interaction.options.getString('style') || 'Secondary';
    const style = VALID_STYLES.has(styleRaw) ? styleRaw : 'Secondary';
    const emoji = interaction.options.getString('emoji') || '';

    let result;
    try {
      result = await ticketService.addCustomButton(ticket._id, {
        label,
        style,
        emoji,
        response,
        addedBy: interaction.user.id
      });
    } catch (err) {
      if (err.message === 'MAX_CUSTOM_BUTTONS_REACHED') {
        return interaction.reply({ content: `❌ وصلت الحد الأقصى لعدد الأزرار المخصصة في تذكرة واحدة (${err.max}).`, ephemeral: true });
      }
      console.error('ticket-button-add failed:', err);
      return interaction.reply({ content: '❌ حدث خطأ أثناء إضافة الزر.', ephemeral: true });
    }

    const { button } = result;

    const builder = new ButtonBuilder()
      .setCustomId(`ticket_custom_${ticket._id}_${button._id}`)
      .setLabel(label.slice(0, 80))
      .setStyle(ButtonStyle[style]);
    // Only touch setEmoji at all if one was actually requested — no forced fallback
    // icon on a button nobody asked to have an emoji on.
    if (emoji) setEmojiSafe(builder, emoji, '🔘');

    const row = new ActionRowBuilder().addComponents(builder);

    await interaction.channel.send({ content: `🔘 <@${interaction.user.id}> أضاف زر جديد لهذه التذكرة:`, components: [row] });

    return interaction.reply({ content: `✅ تم إضافة الزر "${label}" في هذه التذكرة.`, ephemeral: true });
  }
};
