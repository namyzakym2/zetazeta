const { SlashCommandBuilder } = require('discord.js');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tax')
    .setDescription('حساب نسبة الضريبة (2.5%) للمبالغ المالية')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('المبلغ المراد حساب الضريبة له')
        .setRequired(true)),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');

    if (amount <= 0) {
      return interaction.reply({
        content: '❌ يرجى إدخال مبلغ صحيح أكبر من الصفر.',
        ephemeral: true
      });
    }

    // حساب نسبة 2.5%
    const taxRate = 0.025;
    const taxAmount = Math.floor(amount * taxRate);
    const totalAmount = amount + taxAmount; // المبلغ الإجمالي بعد إضافة الضريبة (أو يمكن تعديله حسب رغبتك)

    const panel = buildV2Panel({
      color: '#f1c40f',
      title: '📊 حاسبة الضريبة (2.5%)',
      fields: [
        { name: 'المبلغ المدخل', value: `${amount.toLocaleString()} 🪙` },
        { name: 'قيمة الضريبة (2.5%)', value: `${taxAmount.toLocaleString()} 🪙` },
        { name: 'المبلغ الإجمالي', value: `${totalAmount.toLocaleString()} 🪙` }
      ],
      footer: interaction.user.tag,
      timestamp: true
    });

    return interaction.reply(panel);
  }
};