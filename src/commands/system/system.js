const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const GuildModel = require('../../models/Guild');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('system')
    .setDescription('إعدادات سريعة للبوت / Quick bot setup')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('welcome').setDescription('ضبط رسالة الترحيب').addChannelOption((o) => o.setName('channel').setDescription('القناة').setRequired(true)))
    .addSubcommand((s) => s.setName('leave').setDescription('ضبط رسالة المغادرة').addChannelOption((o) => o.setName('channel').setDescription('القناة').setRequired(true)))
    .addSubcommand((s) =>
      s
        .setName('levelup-channel')
        .setDescription('ضبط قناة رسالة تهنئة الفل')
        .addChannelOption((o) => o.setName('channel').setDescription('القناة (اتركه فارغًا لإرسالها في نفس قناة الرسالة)').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('levelup-message')
        .setDescription('ضبط نص رسالة تهنئة الفل — استخدم {mention} {username} {level} {server}')
        .addStringOption((o) => o.setName('message').setDescription('النص').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('levelup-toggle').setDescription('تفعيل/تعطيل رسالة الفل').addBooleanOption((o) => o.setName('enabled').setDescription('تفعيل؟').setRequired(true))
    )
    .addSubcommand((s) => s.setName('autorole').setDescription('ضبط الرول التلقائي').addRoleOption((o) => o.setName('role').setDescription('الرول').setRequired(true)))
    .addSubcommand((s) => s.setName('logs').setDescription('ضبط قناة اللوق العامة').addChannelOption((o) => o.setName('channel').setDescription('القناة').setRequired(true)))
    .addSubcommand((s) => s.setName('suggestions').setDescription('ضبط قناة الاقتراحات').addChannelOption((o) => o.setName('channel').setDescription('القناة').setRequired(true)))
    .addSubcommand((s) => s.setName('reports').setDescription('ضبط قناة البلاغات').addChannelOption((o) => o.setName('channel').setDescription('القناة').setRequired(true)))
    .addSubcommand((s) => s.setName('automod').setDescription('تفعيل/تعطيل الحماية التلقائية').addBooleanOption((o) => o.setName('enabled').setDescription('تفعيل؟').setRequired(true)))
    .addSubcommand((s) => s.setName('locale').setDescription('تغيير لغة البوت').addStringOption((o) => o.setName('locale').setDescription('ar/en').setRequired(true).addChoices({ name: 'العربية', value: 'ar' }, { name: 'English', value: 'en' })))
    .addSubcommand((s) => s.setName('prefix').setDescription('تغيير البادئة').addStringOption((o) => o.setName('prefix').setDescription('مثال: ! — أو اكتب none لإلغاء البادئة تمامًا').setRequired(true))),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id }) || await GuildModel.create({ guildId: interaction.guild.id });

    switch (sub) {
      case 'welcome': {
        const channel = interaction.options.getChannel('channel', true);
        guildDoc.welcome.enabled = true;
        guildDoc.welcome.channelId = channel.id;
        await guildDoc.save();
        await interaction.reply(`👋 تم ضبط قناة الترحيب: <#${channel.id}>`);
        break;
      }
      case 'leave': {
        const channel = interaction.options.getChannel('channel', true);
        guildDoc.leave.enabled = true;
        guildDoc.leave.channelId = channel.id;
        await guildDoc.save();
        await interaction.reply(`👋 تم ضبط قناة المغادرة: <#${channel.id}>`);
        break;
      }
      case 'levelup-channel': {
        const channel = interaction.options.getChannel('channel');
        guildDoc.levelUp.enabled = true;
        guildDoc.levelUp.channelId = channel ? channel.id : '';
        await guildDoc.save();
        await interaction.reply(
          channel ? `🎉 تم ضبط قناة رسالة الفل: <#${channel.id}>` : '🎉 تم ضبط رسالة الفل لتُرسل في نفس قناة الرسالة.'
        );
        break;
      }
      case 'levelup-message': {
        const message = interaction.options.getString('message', true);
        guildDoc.levelUp.message = message;
        guildDoc.levelUp.enabled = true;
        await guildDoc.save();
        await interaction.reply(`✅ تم تحديث رسالة الفل:\n${message}`);
        break;
      }
      case 'levelup-toggle': {
        const enabled = interaction.options.getBoolean('enabled', true);
        guildDoc.levelUp.enabled = enabled;
        await guildDoc.save();
        await interaction.reply(`🎉 رسالة الفل: ${enabled ? 'ON 🟢' : 'OFF 🔴'}`);
        break;
      }
      case 'autorole': {
        const role = interaction.options.getRole('role', true);
        guildDoc.autoRoleId = role.id;
        await guildDoc.save();
        await interaction.reply(`🎭 تم ضبط الرول التلقائي: <@&${role.id}>`);
        break;
      }
      case 'logs': {
        const channel = interaction.options.getChannel('channel', true);
        // Sets ALL log channel fields to this one channel as a quick default;
        // fine-grained per-type routing is available in the Admin Dashboard.
        for (const field of Object.keys(guildDoc.logSettings.toObject())) {
          if (field.endsWith('ChannelId')) guildDoc.logSettings[field] = channel.id;
        }
        await guildDoc.save();
        await interaction.reply(`📜 تم ضبط قناة اللوق: <#${channel.id}>`);
        break;
      }
      case 'suggestions': {
        const channel = interaction.options.getChannel('channel', true);
        guildDoc.suggestions.enabled = true;
        guildDoc.suggestions.channelId = channel.id;
        await guildDoc.save();
        await interaction.reply(`💡 تم ضبط قناة الاقتراحات: <#${channel.id}>`);
        break;
      }
      case 'reports': {
        const channel = interaction.options.getChannel('channel', true);
        guildDoc.reports.enabled = true;
        guildDoc.reports.channelId = channel.id;
        await guildDoc.save();
        await interaction.reply(`🚨 تم ضبط قناة البلاغات: <#${channel.id}>`);
        break;
      }
      case 'automod': {
        const enabled = interaction.options.getBoolean('enabled', true);
        guildDoc.automod.enabled = enabled;
        await guildDoc.save();
        await interaction.reply(`🛡️ AutoMod: ${enabled ? 'ON 🟢' : 'OFF 🔴'}`);
        break;
      }
      case 'locale': {
        const locale = interaction.options.getString('locale', true);
        guildDoc.locale = locale;
        await guildDoc.save();
        await interaction.reply(`🌍 Locale: ${locale}`);
        break;
      }
      case 'prefix': {
        const raw = interaction.options.getString('prefix', true);
        const prefix = raw.toLowerCase() === 'none' ? '' : raw;
        guildDoc.prefix = prefix;
        await guildDoc.save();
        await interaction.reply(prefix === '' ? '⚙️ تم إلغاء البادئة — الاختصارات تعمل الآن بدون بادئة (مثال: اكتب `c` مباشرة).' : `⚙️ Prefix: ${prefix}`);
        break;
      }
    }

    await logService.log(interaction.client, interaction.guild.id, 'systemConfigChange', {
      Setting: sub,
      Moderator: `<@${interaction.user.id}>`
    });
  }
};
