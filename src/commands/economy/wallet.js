const { SlashCommandBuilder } = require('discord.js');
const economyService = require('../../services/economyService');
const publicCaptchaTransfer = require('../../systems/publicCaptchaTransfer');
const { t } = require('../../services/translationService');

// /wallet — single command for both viewing VC balance and transferring it
// (was split into /credit + /transfer, merged back per request into one
// command under a new name). Discord doesn't allow mixing top-level options
// with subcommands, so "transfer" is just filling in user+amount together on
// /wallet itself (e.g. /wallet user:@someone amount:10000), same pattern the
// old /credit used.
//
// VC is a GLOBAL currency (economyService.Wallet) — the balance shown/moved
// here is the same no matter which server you run this in. Transfers are
// confirmed via a PUBLIC captcha image posted in this channel — the sender
// types the code as a normal chat message to confirm (see
// systems/publicCaptchaTransfer.js). No button, no modal.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('zeta')
    .setDescription('عرض أو تحويل رصيد Zeta / View or transfer Zeta balance')
    .addUserOption((opt) => opt.setName('user').setDescription('عضو (لعرض رصيده أو تحويل Zeta له إذا أضفت amount)').setRequired(false))
    .addIntegerOption((opt) => opt.setName('amount').setDescription('المبلغ (لو موجود = تحويل، لو فاضي = عرض رصيد بس)').setRequired(false).setMinValue(1))
    .addStringOption((opt) => opt.setName('reason').setDescription('سبب التحويل (اختياري)').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // user + amount both given -> transfer flow (public CAPTCHA confirmation in chat).
    if (target && amount) {
      return startTransfer(interaction, target, amount, reason);
    }

    // user given, no amount -> just show THAT person's global balance.
    if (target) {
      const wallet = await economyService.getOrCreateWallet(target.id);
      return interaction.reply(`🏦 | **<@${target.id}>'s account balance is \`$${wallet.balance}\` Zeta 😈.**`);
    }

    // amount given with no user -> ambiguous, guide instead of guessing who to send to.
    if (amount) {
      return interaction.reply({ content: 'استخدم: `/wallet user:@عضو amount:1000` عشان تحول.', ephemeral: true });
    }

    // Neither given -> show your OWN balance, Dank-Memer-style plain text.
    const wallet = await economyService.getOrCreateWallet(interaction.user.id);
    return interaction.reply(`🏦 | **<@${interaction.user.id}>, your account balance is \`$${wallet.balance}\` Zeta 😈.**`);
  }
};

async function startTransfer(interaction, target, amount, reason) {
  const guildDoc = await economyService.getGuildSettings(interaction.guild.id);
  const locale = guildDoc.locale || 'ar';

  const result = await publicCaptchaTransfer.requestTransfer({
    channel: interaction.channel,
    sender: interaction.user,
    target,
    amount,
    reason,
    guildId: interaction.guild.id
  });

  if (result.error === 'SELF') return interaction.reply({ content: t(locale, 'credit.transfer.self'), ephemeral: true });
  if (result.error === 'BOT') return interaction.reply({ content: t(locale, 'credit.transfer.bot'), ephemeral: true });
  if (result.error === 'INVALID_AMOUNT') return interaction.reply({ content: t(locale, 'credit.transfer.invalidAmount'), ephemeral: true });
  if (result.error === 'INSUFFICIENT') return interaction.reply({ content: t(locale, 'credit.transfer.insufficient'), ephemeral: true });
  if (result.error === 'SENDER_BLACKLISTED') {
    return interaction.reply({ content: '❌ حسابك ممنوع من تحويل Zeta حاليًا.', ephemeral: true });
  }
  if (result.error === 'ACCOUNT_TOO_NEW') {
    return interaction.reply({
      content: '❌ حسابك في ديسكورد عمره أقل من شهر — الحسابات الجديدة ما تقدر تحول Zeta، وده لحماية النظام من الاحتيال.',
      ephemeral: true
    });
  }

  return interaction.reply({ content: '🔐 شوف الرسالة في هذا الشات، واكتب الرمز الظاهر في الصورة خلال دقيقتين لتأكيد التحويل.', ephemeral: true });
}
