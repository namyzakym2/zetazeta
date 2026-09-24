const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const ReactionRolePanel = require('../../models/ReactionRolePanel');
const reactionRoles = require('../../systems/reactionRoles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reaction-role')
    .setDescription('إنشاء لوحة رتب تفاعلية')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('panel').setDescription('إرسال لوحة رتب')
      .addChannelOption(o => o.setName('channel').setDescription('القناة').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('العنوان').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('الوصف').setRequired(false)))
    .addSubcommand(s => s.setName('add').setDescription('إضافة زر لآخر لوحة')
      .addStringOption(o => o.setName('panel').setDescription('معرف اللوحة').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('الرتبة').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('النص').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('الإيموجي').setRequired(false))),

  async execute(i) {
    const sub = i.options.getSubcommand();
    if (sub === 'panel') {
      const c = i.options.getChannel('channel');
      const p = await ReactionRolePanel.create({
        guildId: i.guild.id,
        channelId: c.id,
        title: i.options.getString('title') || 'اختر رتبك',
        description: i.options.getString('description') || 'اضغط على الزر لإضافة/إزالة الرتبة.'
      });
      const m = await c.send(reactionRoles.payload(i.guild, p));
      p.messageId = m.id;
      await p.save();
      return i.reply({ content: `✅ تم إنشاء لوحة الرتب. معرفها: \`${p._id}\``, ephemeral: true });
    }

    const p = await ReactionRolePanel.findById(i.options.getString('panel'));
    if (!p || p.guildId !== i.guild.id) return i.reply({ content: '❌ اللوحة غير موجودة.', ephemeral: true });
    p.items.push({
      roleId: i.options.getRole('role').id,
      label: i.options.getString('label'),
      emoji: i.options.getString('emoji') || '',
      style: 'Primary'
    });
    await p.save();
    const c = i.guild.channels.cache.get(p.channelId);
    const m = c && await c.messages.fetch(p.messageId).catch(() => null);
    if (m) await m.edit(reactionRoles.payload(i.guild, p));
    return i.reply({ content: '✅ تمت إضافة الزر.', ephemeral: true });
  }
};
