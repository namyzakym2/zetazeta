const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { can } = require('../../utils/permissions');
const GuildModel = require('../../models/Guild');
const { t } = require('../../services/translationService');
const logService = require('../../services/logService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-room')
    .setDescription('تحديد روم البيع الرسمي وربطه برتبة البائع الموثّق')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('تفعيل روم البيع وتحديد القناة ورتبة البائع')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('روم البيع').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addRoleOption((o) => o.setName('seller-role').setDescription('رتبة البائع الموثّق').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('disable').setDescription('تعطيل ميزة روم البيع'))
    .addSubcommand((sub) => sub.setName('status').setDescription('عرض إعدادات روم البيع الحالية')),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const guildDoc = (await GuildModel.findOne({ guildId: interaction.guild.id })) || (await GuildModel.create({ guildId: interaction.guild.id }));
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel', true);
      const role = interaction.options.getRole('seller-role', true);

      // Same up-front permission check pattern as /ticket-panel — fail with a clear
      // reason now instead of every future message in the room silently no-opping.
      const botPerms = channel.permissionsFor(interaction.guild.members.me);
      const required = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageWebhooks,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.CreatePublicThreads
      ];
      if (!botPerms || !botPerms.has(required)) {
        return interaction.reply({
          content: `❌ البوت يحتاج صلاحيات (عرض القناة، إرسال رسائل، إدارة الرسائل، إدارة الويب هوك، تضمين الروابط، إنشاء ثريدات) في <#${channel.id}>.\n` +
            `صلاحية "إدارة الويب هوك" ضرورية عشان الإعلان يطلع باسم وصورة البائع نفسه.`,
          ephemeral: true
        });
      }

      guildDoc.sellerRoom = { enabled: true, channelId: channel.id, sellerRoleId: role.id };
      await guildDoc.save();

      await logService.log(interaction.client, interaction.guild.id, 'systemConfigChange', {
        Setting: 'Seller Room',
        Channel: `<#${channel.id}>`,
        SellerRole: `<@&${role.id}>`,
        Admin: `<@${interaction.user.id}>`
      });

      return interaction.reply(
        `✅ تم تفعيل روم البيع في <#${channel.id}>.\n` +
          `• أصحاب رتبة <@&${role.id}> يقدرون ينشرون إعلانات فيه عادي — تتحول تلقائيًا لبطاقة إعلان مع زر "تواصل مع البائع".\n` +
          `• أي شخص ثاني يرسل فيه، رسالته تنحذف فورًا، يوصله تحذير، وتُسجّل المحاولة في لوق الأوتومود.\n` +
          `• هذا السلوك مقتصر على <#${channel.id}> فقط — باقي الرومات ما تتأثر.`
      );
    }

    if (sub === 'disable') {
      if (!guildDoc.sellerRoom?.enabled) {
        return interaction.reply({ content: 'ℹ️ روم البيع مو مفعّل أصلاً.', ephemeral: true });
      }
      guildDoc.sellerRoom.enabled = false;
      await guildDoc.save();

      await logService.log(interaction.client, interaction.guild.id, 'systemConfigChange', {
        Setting: 'Seller Room',
        Status: 'Disabled',
        Admin: `<@${interaction.user.id}>`
      });

      return interaction.reply('✅ تم تعطيل ميزة روم البيع. الروم رجع عادي مثل باقي الرومات.');
    }

    // status
    const room = guildDoc.sellerRoom;
    if (!room?.enabled) {
      return interaction.reply({ content: 'ℹ️ روم البيع مو مفعّل حالياً. استخدم `/set-room set` عشان تفعّله.', ephemeral: true });
    }
    return interaction.reply({
      content: `📋 **إعدادات روم البيع**\n• القناة: <#${room.channelId}>\n• رتبة البائع الموثّق: <@&${room.sellerRoleId}>`,
      ephemeral: true
    });
  }
};
