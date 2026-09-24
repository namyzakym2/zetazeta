const Report = require('../models/Report');
const { can } = require('../utils/permissions');
const logService = require('../services/logService');
const { buildV2Panel } = require('../utils/componentsV2');

async function handleButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('report_review_') && !id.startsWith('report_dismiss_')) return false;

  if (!can.manageGuild(interaction) && !can.warn(interaction)) {
    await interaction.reply({ content: '❌ ليس لديك صلاحية مراجعة البلاغات.', ephemeral: true });
    return true;
  }

  const isReview = id.startsWith('report_review_');
  const reportId = id.replace(isReview ? 'report_review_' : 'report_dismiss_', '');

  const report = await Report.findById(reportId);
  if (!report) {
    await interaction.reply({ content: '❌ لم يتم العثور على هذا البلاغ.', ephemeral: true });
    return true;
  }

  report.status = isReview ? 'reviewed' : 'dismissed';
  report.reviewedBy = interaction.user.id;
  await report.save();

  const panel = buildV2Panel({
    title: '🚨 New Report',
    color: isReview ? 0x57f287 : 0x99aab5,
    fields: [
      { name: 'Reported User', value: `<@${report.targetId}> (${report.targetId})` },
      { name: 'Reported By', value: `<@${report.reporterId}>` },
      { name: 'Reason', value: report.reason },
      { name: 'Source Channel', value: `<#${report.channelId}>` },
      { name: 'Status', value: `${isReview ? '✅ Reviewed' : '⚪ Dismissed'} by <@${interaction.user.id}>` }
    ],
    footer: `Report ID: ${report._id}`,
    timestamp: true
  });

  await interaction.update(panel);

  await logService.log(interaction.client, interaction.guild.id, 'reportReviewed', {
    ReportId: reportId,
    Status: report.status,
    Moderator: `<@${interaction.user.id}>`
  });

  return true;
}

module.exports = { handleButton };
