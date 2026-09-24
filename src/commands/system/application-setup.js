const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { can } = require('../../utils/permissions');
const { sanitizeHexColor } = require('../../utils/emoji');
const GuildModel = require('../../models/Guild');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application-setup')
    .setDescription('إنشاء/تعديل بانل تقديم الإدارة / Create or edit a staff-application panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) => o.setName('name').setDescription('اسم البانل (مثلاً: إداري، مطور)').setRequired(true))
    .addChannelOption((o) =>
      o
        .setName('review_channel')
        .setDescription('القناة اللي توصلها التقديمات للمراجعة (يُتجاهل إذا فعّلت create_ticket)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption((o) =>
      o.setName('create_ticket').setDescription('افتح تكت خاص لكل تقديم بدل إرساله لروم ثابت (بدل review_channel)').setRequired(false)
    )
    .addChannelOption((o) =>
      o
        .setName('ticket_category')
        .setDescription('التصنيف (Category) اللي تُفتح تحته تكتات التقديم — إذا فعّلت create_ticket')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addStringOption((o) => o.setName('title').setDescription('عنوان البانل').setRequired(false))
    .addStringOption((o) => o.setName('description').setDescription('وصف البانل').setRequired(false))
    .addStringOption((o) => o.setName('image').setDescription('رابط صورة تظهر داخل بانل التقديم').setRequired(false))
    .addStringOption((o) => o.setName('button_label').setDescription('نص زر "تقديم الآن"').setRequired(false))
    .addStringOption((o) => o.setName('color').setDescription('لون البانل (هيكس، مثال: #0f2158)').setRequired(false))
    .addRoleOption((o) => o.setName('ping_role').setDescription('رتبة تُمنشن بروم المراجعة عند تقديم جديد').setRequired(false))
    .addRoleOption((o) => o.setName('accept_role').setDescription('رتبة تُمنح تلقائيًا عند القبول').setRequired(false))
    .addStringOption((o) => o.setName('question1').setDescription('السؤال 1 (يستبدل كل الأسئلة القديمة إذا انحطت)').setRequired(false))
    .addStringOption((o) => o.setName('question2').setDescription('السؤال 2').setRequired(false))
    .addStringOption((o) => o.setName('question3').setDescription('السؤال 3').setRequired(false))
    .addStringOption((o) => o.setName('question4').setDescription('السؤال 4').setRequired(false))
    .addStringOption((o) => o.setName('question5').setDescription('السؤال 5 (الحد الأقصى — قيد الديسكورد بالمودال)').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id }) || await GuildModel.create({ guildId: interaction.guild.id });

    const name = interaction.options.getString('name').trim().slice(0, 50);
    let panel = guildDoc.applicationPanels.find((p) => p.name === name);
    const isNew = !panel;

    if (!panel) {
      guildDoc.applicationPanels.push({ name });
      panel = guildDoc.applicationPanels[guildDoc.applicationPanels.length - 1];
    }

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const image = interaction.options.getString('image');
    const buttonLabel = interaction.options.getString('button_label');
    const color = interaction.options.getString('color');
    const reviewChannel = interaction.options.getChannel('review_channel');
    const pingRole = interaction.options.getRole('ping_role');
    const acceptRole = interaction.options.getRole('accept_role');
    const createTicket = interaction.options.getBoolean('create_ticket');
    const ticketCategory = interaction.options.getChannel('ticket_category');

    if (title) panel.panelTitle = title;
    if (description) panel.panelDescription = description;
    if (image) panel.panelImage = image;
    if (buttonLabel) panel.buttonLabel = buttonLabel;
    if (color) panel.panelColor = sanitizeHexColor(color, panel.panelColor);
    if (reviewChannel) panel.reviewChannelId = reviewChannel.id;
    if (pingRole) panel.reviewPingRoleId = pingRole.id;
    if (acceptRole) panel.acceptRoleId = acceptRole.id;
    if (createTicket !== null) panel.createTicketOnSubmit = createTicket;
    if (ticketCategory) panel.ticketCategoryId = ticketCategory.id;

    const questions = [1, 2, 3, 4, 5]
      .map((n) => interaction.options.getString(`question${n}`))
      .filter(Boolean);
    if (questions.length) {
      panel.questions = questions.map((text) => ({ text: text.slice(0, 45) }));
    }

    await guildDoc.save();

    if (isNew && !reviewChannel && !panel.createTicketOnSubmit) {
      return interaction.reply({
        content:
          `✅ تم إنشاء بانل التقديم **${name}**.\n` +
          `⚠️ ما حددت "روم المراجعة" ولا فعّلت "create_ticket" — التقديمات ما راح توصل لأي مكان لين تحدد وحدة منهم.\n` +
          `بعدين استخدم \`/application-panel name:${name}\` لإرسال البانل بقناة.`,
        ephemeral: true
      });
    }

    return interaction.reply({
      content:
        `✅ تم ${isNew ? 'إنشاء' : 'تحديث'} بانل التقديم **${name}**.\n` +
        `استخدم \`/application-panel name:${name}\` لإرساله بأي قناة تبيها.`,
      ephemeral: true
    });
  }
};
