const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const { t } = require('../../services/translationService');
const Giveaway = require('../../models/Giveaway');
const giveawaySystem = require('../../systems/giveaways');

// يدعم صيغ زي: 30s, 10m, 2h, 1d, 1w
function parseDuration(input) {
  const match = /^(\d+)\s*(s|m|h|d|w)$/i.exec(input.trim());
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return amount * unitMs[unit];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('إدارة السحوبات / Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('بدء سحب جديد / Start a new giveaway')
        .addStringOption((opt) =>
          opt.setName('price').setDescription('قيمة/جائزة السحب').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('duration').setDescription('مدة السحب (مثال: 10m, 2h, 1d)').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('winners').setDescription('عدد الفائزين').setRequired(true).setMinValue(1).setMaxValue(20)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('إنهاء سحب فورًا / End a giveaway immediately')
        .addStringOption((opt) => opt.setName('message_id').setDescription('معرف رسالة السحب').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('إعادة سحب فائز جديد / Reroll a giveaway winner')
        .addStringOption((opt) => opt.setName('message_id').setDescription('معرف رسالة السحب').setRequired(true))
    ),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const prize = interaction.options.getString('price', true).trim();
      const durationRaw = interaction.options.getString('duration', true);
      const winnersCount = interaction.options.getInteger('winners', true);
      const channel = interaction.channel;

      const durationMs = parseDuration(durationRaw);
      if (!durationMs) {
        return interaction.reply({
          content: '❌ صيغة المدة غير صحيحة. استخدم مثل: `30s` `10m` `2h` `1d` `1w`.',
          ephemeral: true
        });
      }
      if (durationMs < 10_000) {
        return interaction.reply({ content: '❌ الحد الأدنى للمدة هو 10 ثواني.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      await giveawaySystem.startGiveaway(interaction, { prize, winnersCount, durationMs, channel });
      return interaction.editReply(`✅ تم بدء الجيف أواي في ${channel}.`);
    }

    if (sub === 'end') {
      const messageId = interaction.options.getString('message_id', true);
      const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId });

      if (!giveaway) return interaction.reply({ content: '❌ لم يتم العثور على سحب بهذا المعرف.', ephemeral: true });
      if (giveaway.ended) return interaction.reply({ content: '❌ هذا السحب منتهي بالفعل.', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });
      await giveawaySystem.endGiveaway(interaction.client, giveaway);
      return interaction.editReply('✅ تم إنهاء السحب واختيار الفائزين.');
    }

    if (sub === 'reroll') {
      const messageId = interaction.options.getString('message_id', true);
      const giveaway = await Giveaway.findOne({ guildId: interaction.guild.id, messageId });

      if (!giveaway) return interaction.reply({ content: '❌ لم يتم العثور على سحب بهذا المعرف.', ephemeral: true });
      if (!giveaway.ended) return interaction.reply({ content: '❌ هذا السحب لم ينتهِ بعد، استخدم `/giveaway end` أولًا.', ephemeral: true });
      if (!giveaway.participants.length) return interaction.reply({ content: '❌ لا يوجد مشاركون لإعادة السحب عليهم.', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });
      await giveawaySystem.endGiveaway(interaction.client, giveaway, { reroll: true });
      return interaction.editReply('🔁 تم إعادة السحب واختيار فائز جديد.');
    }
  }
};
