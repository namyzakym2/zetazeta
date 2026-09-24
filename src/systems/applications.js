const GuildModel = require('../models/Guild');
const StaffApplication = require('../models/StaffApplication');
const applicationService = require('../services/applicationService');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

/**
 * الضغط على زر "تقديم الآن" — يفتح مودال بالأسئلة المحددة لهذا البانل.
 */
async function handleOpen(interaction, panelId) {
  const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
  const panel = applicationService.resolvePanel(guildDoc, panelId);

  if (!panel || panel.enabled === false) {
    return interaction.reply({ content: '❌ نظام التقديم هذا غير متاح حاليًا.', ephemeral: true });
  }

  if (panel.preventDuplicatePending !== false) {
    const pending = await applicationService.hasPendingApplication(interaction.guild.id, panelId, interaction.user.id);
    if (pending) {
      return interaction.reply({
        content: '⏳ عندك تقديم قيد المراجعة بالفعل، لازم تنتظر رد الإدارة قبل ما تقدّم مرة ثانية.',
        ephemeral: true
      });
    }
  }

  return interaction.showModal(applicationService.buildQuestionModal(panel));
}

/**
 * استلام إجابات مودال التقديم — يحفظ التقديم ويرسله لروم المراجعة.
 */
async function handleModalSubmit(interaction, panelId) {
  const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
  const panel = applicationService.resolvePanel(guildDoc, panelId);

  if (!panel) {
    return interaction.reply({ content: '❌ هذا التقديم ما عاد موجود.', ephemeral: true });
  }

  const answers = (panel.questions || []).slice(0, applicationService.MAX_QUESTIONS).map((q) => ({
    question: q.text,
    answer: interaction.fields.getTextInputValue(String(q._id))
  }));

  try {
    await applicationService.submitApplication(interaction.guild, interaction.member, panel, answers);
  } catch (err) {
    if (err.message === 'NO_REVIEW_CHANNEL') {
      console.error(`⚠️ Application submitted but no valid review channel is set for panel ${panelId} (guild ${interaction.guild.id}).`);
      return interaction.reply({
        content: '✅ تم استلام تقديمك، لكن يبدو فيه خطأ بإعدادات الاستقبال — خبّر الإدارة تتأكد من ضبط "روم المراجعة" بأمر /application-setup.',
        ephemeral: true
      });
    }
    if (err.message === 'TICKET_CREATE_FAILED') {
      console.error(`⚠️ Application submitted but failed to create its ticket channel for panel ${panelId} (guild ${interaction.guild.id}):`, err);
      return interaction.reply({
        content: '✅ تم استلام تقديمك، لكن صار خطأ أثناء فتح تكت المراجعة — خبّر الإدارة تتأكد من صلاحيات البوت والتصنيف المحدد.',
        ephemeral: true
      });
    }
    console.error('Failed to submit staff application:', err);
    return interaction.reply({ content: '❌ حدث خطأ أثناء إرسال تقديمك، حاول مرة أخرى.', ephemeral: true });
  }

  const thanksMsg = panel.createTicketOnSubmit
    ? '✅ تم إرسال تقديمك بنجاح! فتحنا لك تكت خاص للمتابعة — راجع قنواتك بالسيرفر.'
    : '✅ تم إرسال تقديمك بنجاح! بتوصلك النتيجة بالخاص بعد ما تراجعه الإدارة.';

  return interaction.reply({ content: thanksMsg, ephemeral: true });
}

/**
 * زر "قبول" في روم المراجعة.
 */
async function handleAccept(interaction, applicationId) {
  const application = await StaffApplication.findById(applicationId);
  if (!application) return interaction.reply({ content: '❌ هذا التقديم ما عاد موجود.', ephemeral: true });
  if (application.status !== 'pending') {
    return interaction.reply({
      content: `ℹ️ تم اتخاذ قرار بهذا التقديم مسبقًا (${application.status === 'accepted' ? 'مقبول ✅' : 'مرفوض ❌'}).`,
      ephemeral: true
    });
  }

  const guildDoc = await GuildModel.findOne({ guildId: application.guildId });
  const panel = applicationService.resolvePanel(guildDoc, application.panelId);

  await interaction.deferUpdate();
  await applicationService.acceptApplication(interaction.guild, application, panel, interaction.member);
  await interaction.followUp({ content: `✅ تم قبول تقديم <@${application.applicantId}> وإشعاره بالخاص.`, ephemeral: true });
}

/**
 * زر "رفض" في روم المراجعة — يفتح مودال لكتابة سبب اختياري قبل الحفظ.
 */
async function handleRejectButton(interaction, applicationId) {
  const application = await StaffApplication.findById(applicationId);
  if (!application) return interaction.reply({ content: '❌ هذا التقديم ما عاد موجود.', ephemeral: true });
  if (application.status !== 'pending') {
    return interaction.reply({
      content: `ℹ️ تم اتخاذ قرار بهذا التقديم مسبقًا (${application.status === 'accepted' ? 'مقبول ✅' : 'مرفوض ❌'}).`,
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`application_reject_modal_${applicationId}`)
    .setTitle('رفض التقديم');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('سبب الرفض (اختياري)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  return interaction.showModal(modal);
}

/**
 * استلام مودال سبب الرفض — يحفظ القرار ويشعر المتقدم بالخاص.
 */
async function handleRejectModalSubmit(interaction, applicationId) {
  const application = await StaffApplication.findById(applicationId);
  if (!application) return interaction.reply({ content: '❌ هذا التقديم ما عاد موجود.', ephemeral: true });
  if (application.status !== 'pending') {
    return interaction.reply({ content: 'ℹ️ تم اتخاذ قرار بهذا التقديم مسبقًا.', ephemeral: true });
  }

  const reason = interaction.fields.getTextInputValue('reason')?.trim() || '';
  const guildDoc = await GuildModel.findOne({ guildId: application.guildId });
  const panel = applicationService.resolvePanel(guildDoc, application.panelId);

  await applicationService.rejectApplication(interaction.guild, application, panel, interaction.member, reason);
  return interaction.reply({ content: `❌ تم رفض تقديم <@${application.applicantId}> وإشعاره بالخاص.`, ephemeral: true });
}

async function route(interaction) {
  if (interaction.isButton()) {
    const id = interaction.customId;
    if (id.startsWith('application_open_')) return handleOpen(interaction, id.replace('application_open_', ''));
    if (id.startsWith('application_accept_')) return handleAccept(interaction, id.replace('application_accept_', ''));
    if (id.startsWith('application_reject_')) return handleRejectButton(interaction, id.replace('application_reject_', ''));
  }

  if (interaction.isModalSubmit()) {
    const id = interaction.customId;
    if (id.startsWith('application_reject_modal_')) return handleRejectModalSubmit(interaction, id.replace('application_reject_modal_', ''));
    if (id.startsWith('application_modal_')) return handleModalSubmit(interaction, id.replace('application_modal_', ''));
  }

  return false;
}

module.exports = { route };
