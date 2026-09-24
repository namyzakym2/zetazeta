const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const commandPermissionService = require('../../services/commandPermissionService');
const { buildV2Panel, ephemeralV2 } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('command-permission')
    .setDescription('التحكم بصلاحية الرتب لاستخدام أوامر معينة / Control which roles can use which commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('allow')
        .setDescription('السماح لرتبة باستخدام أمر معين')
        .addStringOption((o) => o.setName('command').setDescription('اسم الأمر').setRequired(true).setAutocomplete(true))
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('deny')
        .setDescription('منع رتبة من استخدام أمر معين')
        .addStringOption((o) => o.setName('command').setDescription('اسم الأمر').setRequired(true).setAutocomplete(true))
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('إزالة أي قاعدة مخصصة لهذه الرتبة على هذا الأمر (رجوع للوضع الافتراضي)')
        .addStringOption((o) => o.setName('command').setDescription('اسم الأمر').setRequired(true).setAutocomplete(true))
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('عرض قواعد الصلاحيات الحالية')
        .addStringOption((o) => o.setName('command').setDescription('اسم أمر معين (اختياري)').setRequired(false).setAutocomplete(true))
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const names = [...interaction.client.commands.keys()];
    const filtered = names.filter((n) => n.includes(focused)).slice(0, 25);
    await interaction.respond(filtered.map((n) => ({ name: n, value: n })));
  },

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: '❌ هذا الأمر يعمل فقط داخل السيرفر.', ephemeral: true });
    if (!can.administrator(interaction)) {
      return interaction.reply({ content: '❌ هذا الأمر يتطلب صلاحية Administrator.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const commandName = interaction.options.getString('command');

    if (commandName && !interaction.client.commands.has(commandName)) {
      return interaction.reply({ content: `❌ لا يوجد أمر باسم \`${commandName}\`.`, ephemeral: true });
    }

    if (sub === 'allow' || sub === 'deny') {
      const role = interaction.options.getRole('role');
      await commandPermissionService.setPermission(interaction.guild.id, commandName, role.id, sub === 'allow');
      return interaction.reply({
        content:
          sub === 'allow'
            ? `✅ الرتبة ${role} أصبحت مسموح لها باستخدام \`/${commandName}\`.\n(ملاحظة: بمجرد ما تسمح لرتبة واحدة بأمر معين، يصبح هذا الأمر مقصور على الرتب المسموح لها فقط — استخدم \`reset\` للرجوع للوضع الافتراضي).`
            : `⛔ الرتبة ${role} أصبحت ممنوعة من استخدام \`/${commandName}\`.`,
        ephemeral: true
      });
    }

    if (sub === 'reset') {
      const role = interaction.options.getRole('role');
      await commandPermissionService.resetPermission(interaction.guild.id, commandName, role.id);
      return interaction.reply({ content: `♻️ تم إعادة تعيين صلاحية \`/${commandName}\` للرتبة ${role}.`, ephemeral: true });
    }

    if (sub === 'list') {
      const rules = await commandPermissionService.listPermissions(interaction.guild.id, commandName);
      if (!rules.length) {
        return interaction.reply({
          content: commandName ? `لا توجد قواعد صلاحيات مخصصة للأمر \`/${commandName}\`.` : 'لا توجد قواعد صلاحيات مخصصة في هذا السيرفر.',
          ephemeral: true
        });
      }

      const byCommand = new Map();
      for (const r of rules) {
        if (!byCommand.has(r.command)) byCommand.set(r.command, []);
        byCommand.get(r.command).push(r);
      }

      const lines = [...byCommand.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cmd, entries]) => {
          const roles = entries.map((r) => `<@&${r.roleId}> ${r.allowed === false ? '⛔' : '✅'}`).join(' , ');
          return `**/${cmd}** — ${roles}`;
        });

      const panel = buildV2Panel({
        title: '🔐 صلاحيات الأوامر',
        color: '#0f2158',
        description: lines.join('\n'),
        footer: '✅ مسموح  •  ⛔ ممنوع'
      });

      return interaction.reply(ephemeralV2(panel));
    }
  }
};
