const { SlashCommandBuilder } = require('discord.js');
const economyService = require('../../services/economyService');
const logService = require('../../services/logService');
const { formatMoney } = require('../../utils/formatMoney');
const { formatDuration, msUntil } = require('../../utils/time');
const { t } = require('../../services/translationService');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('salary')
    .setDescription('استلم راتبك الأسبوعي (للإدارة فقط) / Claim your weekly staff salary'),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });

    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (!staffRoleId) {
      return interaction.reply({
        content: '❌ لم يتم ضبط رتبة الإدارة بعد. حط STAFF_ROLE_ID بملف .env أولًا.',
        ephemeral: true
      });
    }

    if (!interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.reply({ content: '❌ هذا الأمر مخصص لأعضاء الإدارة فقط.', ephemeral: true });
    }

    try {
      const result = await economyService.claimSalary(interaction.guild.id, interaction.user.id);

      const panel = buildV2Panel({
        title: '💼 راتب الإدارة',
        color: '#0f2158',
        description: `تم استلام راتبك الأسبوعي بنجاح:\n💰 +${formatMoney(result.amount)}`,
        fields: [{ name: '💳 رصيدك الحالي', value: formatMoney(result.balance) }]
      });

      await logService.log(interaction.client, interaction.guild.id, 'salaryClaim', {
        User: `<@${interaction.user.id}>`,
        Amount: formatMoney(result.amount)
      });

      return interaction.reply(panel);
    } catch (err) {
      if (err.message === 'ALREADY_CLAIMED') {
        const remaining = msUntil(err.nextAvailableAt);
        return interaction.reply({
          content: `❌ استلمت راتبك بالفعل. تقدر تاخذه تاني بعد: ${formatDuration(remaining)}`,
          ephemeral: true
        });
      }
      throw err;
    }
  }
};
