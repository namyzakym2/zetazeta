const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const GuildModel = require('../../models/Guild');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

async function getOrCreateGuildDoc(guildId) {
  return (await GuildModel.findOne({ guildId })) || (await GuildModel.create({ guildId }));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auto-rules')
    .setDescription('قواعد الرول التلقائي المتقدمة (أعضاء/بوتات/دعوات) / Advanced auto-role rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) =>
      s.setName('toggle').setDescription('تفعيل/تعطيل النظام كامل')
        .addBooleanOption((o) => o.setName('enabled').setDescription('تفعيل؟').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('add-role').setDescription('إضافة رول لقائمة الأعضاء أو البوتات')
        .addStringOption((o) => o.setName('type').setDescription('النوع').setRequired(true)
          .addChoices({ name: '👤 أعضاء', value: 'member' }, { name: '🤖 بوتات', value: 'bot' }))
        .addRoleOption((o) => o.setName('role').setDescription('الرول').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('remove-role').setDescription('إزالة رول من قائمة الأعضاء أو البوتات')
        .addStringOption((o) => o.setName('type').setDescription('النوع').setRequired(true)
          .addChoices({ name: '👤 أعضاء', value: 'member' }, { name: '🤖 بوتات', value: 'bot' }))
        .addRoleOption((o) => o.setName('role').setDescription('الرول').setRequired(true))
    )
    .addSubcommandGroup((g) =>
      g.setName('invite-role').setDescription('ربط رول بكود دعوة معيّن')
        .addSubcommand((s) =>
          s.setName('add').setDescription('إضافة ربط دعوة ↔ رول')
            .addStringOption((o) => o.setName('invite').setDescription('كود الدعوة (مثال: aBc123، بدون discord.gg/)').setRequired(true))
            .addRoleOption((o) => o.setName('role').setDescription('الرول').setRequired(true))
        )
        .addSubcommand((s) =>
          s.setName('remove').setDescription('إزالة ربط دعوة')
            .addStringOption((o) => o.setName('invite').setDescription('كود الدعوة').setRequired(true))
        )
    )
    .addSubcommand((s) => s.setName('list').setDescription('عرض القواعد الحالية')),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.manageRoles(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const guildId = interaction.guild.id;
    const guildDoc = await getOrCreateGuildDoc(guildId);
    if (!guildDoc.autoRoleRules) guildDoc.autoRoleRules = {};

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    // ── /auto-rules toggle ──────────────────────────────────────────────
    if (!group && sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled', true);
      guildDoc.autoRoleRules.enabled = enabled;
      await guildDoc.save();
      await logService.log(interaction.client, guildId, 'systemConfigChange', {
        Setting: 'Auto Rules', Value: enabled ? 'مفعّل' : 'معطّل', Admin: `<@${interaction.user.id}>`
      });
      return interaction.reply(enabled ? '✅ تم تفعيل قواعد الرول التلقائي.' : '⛔ تم تعطيل قواعد الرول التلقائي.');
    }

    // ── /auto-rules add-role | remove-role ──────────────────────────────
    if (!group && (sub === 'add-role' || sub === 'remove-role')) {
      const type = interaction.options.getString('type', true);
      const role = interaction.options.getRole('role', true);

      const botMember = interaction.guild.members.me;
      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({ content: '❌ هذا الرول أعلى من صلاحيات البوت.', ephemeral: true });
      }

      const field = type === 'bot' ? 'botRoleIds' : 'memberRoleIds';
      const list = guildDoc.autoRoleRules[field] || [];

      if (sub === 'add-role') {
        if (list.includes(role.id)) return interaction.reply({ content: '❌ هذا الرول مضاف بالفعل.', ephemeral: true });
        list.push(role.id);
      } else {
        if (!list.includes(role.id)) return interaction.reply({ content: '❌ هذا الرول غير موجود بالقائمة.', ephemeral: true });
        list.splice(list.indexOf(role.id), 1);
      }
      guildDoc.autoRoleRules[field] = list;
      await guildDoc.save();

      await logService.log(interaction.client, guildId, 'systemConfigChange', {
        Setting: 'Auto Rules', Action: sub, Type: type, Role: `<@&${role.id}>`, Admin: `<@${interaction.user.id}>`
      });
      return interaction.reply(
        sub === 'add-role'
          ? `➕ تم إضافة **${role.name}** لقائمة ${type === 'bot' ? 'البوتات' : 'الأعضاء'}.`
          : `➖ تم إزالة **${role.name}** من قائمة ${type === 'bot' ? 'البوتات' : 'الأعضاء'}.`
      );
    }

    // ── /auto-rules invite-role add|remove ──────────────────────────────
    if (group === 'invite-role') {
      const invite = interaction.options.getString('invite', true).trim().replace(/^https?:\/\/(discord\.gg|discord(app)?\.com\/invite)\//i, '');
      const list = guildDoc.autoRoleRules.inviteRoles || [];

      if (sub === 'add') {
        const role = interaction.options.getRole('role', true);
        const botMember = interaction.guild.members.me;
        if (role.position >= botMember.roles.highest.position) {
          return interaction.reply({ content: '❌ هذا الرول أعلى من صلاحيات البوت.', ephemeral: true });
        }
        const existing = list.find((r) => r.invite === invite);
        if (existing) existing.roleId = role.id;
        else list.push({ invite, roleId: role.id });
        guildDoc.autoRoleRules.inviteRoles = list;
        await guildDoc.save();
        await logService.log(interaction.client, guildId, 'systemConfigChange', {
          Setting: 'Auto Rules', Action: 'invite-role add', Invite: invite, Role: `<@&${role.id}>`, Admin: `<@${interaction.user.id}>`
        });
        return interaction.reply(`🔗 دعوة \`${invite}\` أصبحت تعطي رول **${role.name}**.`);
      }

      // remove
      if (!list.some((r) => r.invite === invite)) {
        return interaction.reply({ content: '❌ ما فيه ربط لهذا الكود.', ephemeral: true });
      }
      guildDoc.autoRoleRules.inviteRoles = list.filter((r) => r.invite !== invite);
      await guildDoc.save();
      await logService.log(interaction.client, guildId, 'systemConfigChange', {
        Setting: 'Auto Rules', Action: 'invite-role remove', Invite: invite, Admin: `<@${interaction.user.id}>`
      });
      return interaction.reply(`🗑️ تم حذف ربط الدعوة \`${invite}\`.`);
    }

    // ── /auto-rules list ─────────────────────────────────────────────────
    const r = guildDoc.autoRoleRules;
    const memberList = (r.memberRoleIds || []).map((id) => `<@&${id}>`).join(', ') || '—';
    const botList = (r.botRoleIds || []).map((id) => `<@&${id}>`).join(', ') || '—';
    const inviteList = (r.inviteRoles || []).map((x) => `\`${x.invite}\` → <@&${x.roleId}>`).join('\n') || '—';

    return interaction.reply({
      content:
        `## ⚙️ قواعد الرول التلقائي\n` +
        `**الحالة:** ${r.enabled !== false ? '✅ مفعّل' : '⛔ معطّل'}\n\n` +
        `**👤 رولات الأعضاء:** ${memberList}\n` +
        `**🤖 رولات البوتات:** ${botList}\n\n` +
        `**🔗 روابط الدعوات:**\n${inviteList}`,
      ephemeral: true
    });
  }
};
