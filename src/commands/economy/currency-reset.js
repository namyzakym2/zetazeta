const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');

function isOwner(userId) {
  const owners = String(process.env.OWNER_IDS || process.env.OWNER_ID || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return owners.includes(userId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('currency-reset')
    .setDescription('Reset all Zeta balances to zero (owner only).')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(o => o.setName('confirm').setDescription('Confirm the full currency reset').setRequired(true)),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '⛔ هذا الأمر للمالك فقط.', ephemeral: true });
    }
    if (!interaction.options.getBoolean('confirm')) {
      return interaction.reply({ content: '⚠️ لم يتم تنفيذ إعادة التصفير. استخدم `confirm: True`.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await Wallet.updateMany({}, {
      $set: {
        balance: 0,
        streak: 0,
        lastDaily: null,
        lastSalary: null,
        lastVote: null,
        voteReminded: false
      }
    });

    // Keep an auditable marker rather than fabricating a transaction for every user.
    await Transaction.create({
      guildId: interaction.guildId || null,
      fromUserId: interaction.user.id,
      toUserId: interaction.user.id,
      amount: 0,
      type: 'currency_reset'
    }).catch(() => null);

    return interaction.editReply(`✅ تم تصفير عملة ZETA بالكامل. الحسابات المتأثرة: **${result.modifiedCount ?? result.nModified ?? 0}**.`);
  }
};
