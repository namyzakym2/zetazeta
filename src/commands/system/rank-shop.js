const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { can } = require('../../utils/permissions');
const GuildModel = require('../../models/Guild');
const logService = require('../../services/logService');
const rankShopService = require('../../services/rankShopService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank-shop')
    .setDescription('متجر بيع الرتب مقابل تحويل بنكي / إدارة متجر الرتب')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((g) =>
      g
        .setName('bank')
        .setDescription('معلومات الحساب البنكي المستخدم للتحويلات')
        .addSubcommand((s) =>
          s
            .setName('set')
            .setDescription('تحديد/تحديث معلومات الحساب البنكي')
            .addStringOption((o) => o.setName('bank-name').setDescription('اسم البنك').setRequired(true))
            .addStringOption((o) => o.setName('account-number').setDescription('رقم الحساب / RIB / CCP').setRequired(true))
            .addStringOption((o) => o.setName('account-holder').setDescription('اسم صاحب الحساب').setRequired(false))
            .addStringOption((o) => o.setName('notes').setDescription('ملاحظات إضافية (مثل بريدي موب، أوقات العمل...)').setRequired(false))
        )
        .addSubcommand((s) => s.setName('show').setDescription('عرض معلومات الحساب البنكي الحالية'))
    )
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('إضافة رتبة جديدة للبيع')
        .addRoleOption((o) => o.setName('role').setDescription('الرول الذي سيتم منحه').setRequired(true))
        .addNumberOption((o) => o.setName('price').setDescription('السعر').setRequired(true).setMinValue(0))
        .addStringOption((o) => o.setName('name').setDescription('اسم يظهر في المتجر (افتراضيًا اسم الرول)').setRequired(false))
        .addStringOption((o) => o.setName('description').setDescription('وصف مختصر للرتبة').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('إزالة رتبة من المتجر')
        .addRoleOption((o) => o.setName('role').setDescription('الرول المراد إزالته من المتجر').setRequired(true))
    )
    .addSubcommand((s) => s.setName('list').setDescription('عرض كل الرتب المعروضة للبيع'))
    .addSubcommand((s) =>
      s
        .setName('category')
        .setDescription('تحديد التصنيف الذي تُفتح فيه رومات الشراء الخاصة')
        .addChannelOption((o) => o.setName('category').setDescription('التصنيف').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('staff-role')
        .setDescription('تحديد رتبة الموظفين التي تُضاف تلقائيًا لكل روم شراء (اختياري)')
        .addRoleOption((o) => o.setName('role').setDescription('رتبة الموظفين').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('currency')
        .setDescription('تحديد رمز/اسم العملة المعروض بجانب الأسعار')
        .addStringOption((o) => o.setName('label').setDescription('مثال: دج، ريال، $').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('panel')
        .setDescription('إرسال لوحة المتجر (قائمة الرتب) إلى قناة')
        .addChannelOption((o) => o.setName('channel').setDescription('القناة').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('confirm')
        .setDescription('تأكيد الدفع يدويًا ومنح الرتبة مباشرة (بدون فتح روم)')
        .addUserOption((o) => o.setName('user').setDescription('المشتري').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة المُباعة').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('revoke')
        .setDescription('سحب رتبة تم بيعها من عضو')
        .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة').setRequired(true))
    )
    .addSubcommand((s) => s.setName('enable').setDescription('تفعيل متجر الرتب'))
    .addSubcommand((s) => s.setName('disable').setDescription('تعطيل متجر الرتب')),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
    if (!can.manageGuild(interaction)) return interaction.reply({ content: '❌ ما عندك صلاحية إدارة السيرفر.', ephemeral: true });

    const guildDoc = (await GuildModel.findOne({ guildId: interaction.guild.id })) || (await GuildModel.create({ guildId: interaction.guild.id }));

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    // ── /rank-shop bank set|show ──────────────────────────────────────────
    if (group === 'bank') {
      if (sub === 'set') {
        guildDoc.rankShop.bank = {
          bankName: interaction.options.getString('bank-name', true),
          accountNumber: interaction.options.getString('account-number', true),
          accountHolder: interaction.options.getString('account-holder') || '',
          notes: interaction.options.getString('notes') || ''
        };
        await guildDoc.save();

        await logService.log(interaction.client, interaction.guild.id, 'systemConfigChange', {
          Setting: 'Rank Shop — Bank Info',
          Admin: `<@${interaction.user.id}>`
        });

        return interaction.reply({ content: '✅ تم تحديث معلومات الحساب البنكي لمتجر الرتب.', ephemeral: true });
      }

      // show
      const bank = guildDoc.rankShop.bank || {};
      if (!bank.bankName && !bank.accountNumber) {
        return interaction.reply({ content: 'ℹ️ لم يتم تحديد معلومات بنكية بعد. استخدم `/rank-shop bank set`.', ephemeral: true });
      }
      return interaction.reply({
        content:
          `🏦 **معلومات الحساب البنكي**\n` +
          `• البنك: ${bank.bankName || '—'}\n` +
          `• صاحب الحساب: ${bank.accountHolder || '—'}\n` +
          `• رقم الحساب: \`${bank.accountNumber || '—'}\`\n` +
          `• ملاحظات: ${bank.notes || '—'}`,
        ephemeral: true
      });
    }

    // ── top-level subcommands ─────────────────────────────────────────────
    if (sub === 'add') {
      const role = interaction.options.getRole('role', true);
      const price = interaction.options.getNumber('price', true);
      const name = interaction.options.getString('name') || role.name;
      const description = interaction.options.getString('description') || '';

      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({ content: '❌ هذا الرول أعلى من صلاحيات البوت، ما يقدر يمنحه لأحد.', ephemeral: true });
      }

      if (guildDoc.rankShop.ranks.some((r) => r.roleId === role.id)) {
        return interaction.reply({ content: '❌ هذه الرتبة موجودة بالفعل في المتجر. استخدم `/rank-shop remove` أولاً لتحديثها.', ephemeral: true });
      }

      guildDoc.rankShop.ranks.push({ roleId: role.id, name, price, description });
      await guildDoc.save();

      await logService.log(interaction.client, interaction.guild.id, 'systemConfigChange', {
        Setting: 'Rank Shop — Rank Added',
        Rank: name,
        Role: `<@&${role.id}>`,
        Price: `${price} ${guildDoc.rankShop.currency}`,
        Admin: `<@${interaction.user.id}>`
      });

      return interaction.reply(`✅ تمت إضافة **${name}** (<@&${role.id}>) للمتجر بسعر **${price} ${guildDoc.rankShop.currency}**.`);
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role', true);
      const before = guildDoc.rankShop.ranks.length;
      guildDoc.rankShop.ranks = guildDoc.rankShop.ranks.filter((r) => r.roleId !== role.id);

      if (guildDoc.rankShop.ranks.length === before) {
        return interaction.reply({ content: '❌ هذه الرتبة غير موجودة في المتجر أصلاً.', ephemeral: true });
      }

      await guildDoc.save();

      await logService.log(interaction.client, interaction.guild.id, 'systemConfigChange', {
        Setting: 'Rank Shop — Rank Removed',
        Role: `<@&${role.id}>`,
        Admin: `<@${interaction.user.id}>`
      });

      return interaction.reply(`🗑️ تم حذف الرتبة <@&${role.id}> من المتجر.`);
    }

    if (sub === 'list') {
      const ranks = guildDoc.rankShop.ranks;
      if (!ranks.length) {
        return interaction.reply({ content: 'ℹ️ لا توجد رتب في المتجر حاليًا. استخدم `/rank-shop add`.', ephemeral: true });
      }
      const lines = ranks.map(
        (r) => `• **${r.name}** — <@&${r.roleId}> — 💰 ${r.price} ${guildDoc.rankShop.currency}${r.description ? `\n   ↳ ${r.description}` : ''}`
      );
      return interaction.reply({ content: `🛍️ **رتب المتجر الحالية:**\n${lines.join('\n')}`, ephemeral: true });
    }

    if (sub === 'category') {
      const category = interaction.options.getChannel('category', true);
      guildDoc.rankShop.categoryId = category.id;
      await guildDoc.save();
      return interaction.reply(`✅ رومات الشراء الخاصة راح تُفتح تحت تصنيف **${category.name}**.`);
    }

    if (sub === 'staff-role') {
      const role = interaction.options.getRole('role', true);
      guildDoc.rankShop.staffRoleId = role.id;
      await guildDoc.save();
      return interaction.reply(`✅ رتبة <@&${role.id}> راح تنضاف تلقائيًا وتنمنشن في كل روم شراء جديد.`);
    }

    if (sub === 'currency') {
      const label = interaction.options.getString('label', true).slice(0, 10);
      guildDoc.rankShop.currency = label;
      await guildDoc.save();
      return interaction.reply(`✅ تم تحديث رمز العملة إلى: **${label}**`);
    }

    if (sub === 'panel') {
      const channel = interaction.options.getChannel('channel', true);

      if (!guildDoc.rankShop.ranks.length) {
        return interaction.reply({ content: '❌ لا توجد رتب في المتجر بعد. أضف رتبة أولاً بـ `/rank-shop add`.', ephemeral: true });
      }

      const botPerms = channel.permissionsFor(interaction.guild.members.me);
      if (!botPerms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        return interaction.reply({ content: `❌ البوت يحتاج صلاحيات (عرض، إرسال رسائل، تضمين الروابط) في <#${channel.id}>.`, ephemeral: true });
      }

      const payload = rankShopService.buildShopPanel(guildDoc);
      await channel.send(payload);

      return interaction.reply({ content: `✅ تم إرسال لوحة متجر الرتب إلى <#${channel.id}>.`, ephemeral: true });
    }

    if (sub === 'confirm') {
      const user = interaction.options.getUser('user', true);
      const role = interaction.options.getRole('role', true);

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ العضو غير موجود في السيرفر.', ephemeral: true });

      try {
        await rankShopService.manualGrant(interaction.guild, member, role, interaction.user);
        return interaction.reply(`🎁 تم تأكيد الدفع يدويًا ومنح <@&${role.id}> إلى <@${user.id}>.`);
      } catch (err) {
        const messages = {
          ALREADY_OWNED: '❌ العضو يمتلك هذه الرتبة بالفعل.',
          ROLE_TOO_HIGH: '❌ هذا الرول أعلى من صلاحيات البوت.'
        };
        return interaction.reply({ content: messages[err.message] || '❌ تعذر منح الرتبة.', ephemeral: true });
      }
    }

    if (sub === 'revoke') {
      const user = interaction.options.getUser('user', true);
      const role = interaction.options.getRole('role', true);

      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ العضو غير موجود في السيرفر.', ephemeral: true });

      try {
        await rankShopService.manualRevoke(interaction.guild, member, role, interaction.user);
        return interaction.reply(`🗑️ تم سحب <@&${role.id}> من <@${user.id}>.`);
      } catch (err) {
        const messages = { NOT_OWNED: '❌ العضو لا يمتلك هذه الرتبة أصلاً.' };
        return interaction.reply({ content: messages[err.message] || '❌ تعذر سحب الرتبة.', ephemeral: true });
      }
    }

    if (sub === 'enable') {
      if (!guildDoc.rankShop.ranks.length) {
        return interaction.reply({ content: '⚠️ تم التفعيل، لكن لا توجد رتب في المتجر بعد — أضف رتبًا بـ `/rank-shop add`.', ephemeral: true });
      }
      guildDoc.rankShop.enabled = true;
      await guildDoc.save();
      return interaction.reply('✅ تم تفعيل متجر الرتب.');
    }

    if (sub === 'disable') {
      guildDoc.rankShop.enabled = false;
      await guildDoc.save();
      return interaction.reply('✅ تم تعطيل متجر الرتب. رومات الشراء المفتوحة حاليًا تبقى شغّالة حتى تُغلق يدويًا.');
    }
  }
};
