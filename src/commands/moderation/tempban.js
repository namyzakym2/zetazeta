const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can, canModerate } = require('../../utils/permissions');
const logService = require('../../services/logService');
const recentBotActions = require('../../utils/recentBotActions');
const TempBan = require('../../models/TempBan');
const { t } = require('../../services/translationService');

const UNITS = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

function parseDuration(input) {
  const match = /^(\d+)([mhd])$/i.exec(String(input).trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms = amount * UNITS[unit];
  if (!ms || ms <= 0) return null;
  return ms;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('حظر مؤقت لعضو مع فك تلقائي / Temporarily ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('duration')
        .setDescription('المدة، مثال: 30m / 12h / 7d')
        .setRequired(true)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('السبب').setRequired(false))
    .addIntegerOption((opt) => opt.setName('delete_days').setDescription('حذف رسائل آخر X يوم').setMinValue(0).setMaxValue(7)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.ban(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const durationRaw = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    const ms = parseDuration(durationRaw);
    if (!ms) {
      return interaction.reply({
        content: '❌ صيغة المدة غير صحيحة. استخدم مثل: `30m` (دقيقة) / `12h` (ساعة) / `7d` (يوم).',
        ephemeral: true
      });
    }
    // Cap at 90 days — matches Discord's own audit-log/message-delete practical ceiling
    // and keeps the expiry collection from holding indefinite entries.
    if (ms > 90 * UNITS.d) {
      return interaction.reply({ content: '❌ أقصى مدة مسموحة للحظر المؤقت هي 90 يوم.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const hierarchyCheck = canModerate(interaction, member);
    if (!hierarchyCheck.ok) return interaction.reply({ content: hierarchyCheck.reason, ephemeral: true });
    if (member && !member.bannable) {
      return interaction.reply({ content: '❌ لا أستطيع حظر هذا العضو (صلاحياته أعلى مني أو مساوية لي).', ephemeral: true });
    }

    const expiresAt = new Date(Date.now() + ms);

    recentBotActions.mark(interaction.guild.id, target.id, 'ban');
    await interaction.guild.members.ban(target.id, { reason, deleteMessageSeconds: deleteDays * 86400 });

    await TempBan.create({
      guildId: interaction.guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
      expiresAt
    });

    await logService.log(interaction.client, interaction.guild.id, 'ban', {
      User: `${target.tag} (${target.id})`,
      Moderator: `<@${interaction.user.id}>`,
      Reason: `${reason} (مؤقت — ${durationRaw})`
    });

    return interaction.reply(
      `⏳ تم حظر **${target.tag}** مؤقتًا لمدة **${durationRaw}**.\nسيتم فك الحظر تلقائيًا في <t:${Math.floor(expiresAt.getTime() / 1000)}:F>.\nالسبب: ${reason}`
    );
  }
};
