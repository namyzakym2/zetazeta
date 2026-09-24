const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const ReactionRolePanel = require('../models/ReactionRolePanel');

function style(s) { return ButtonStyle[s] || ButtonStyle.Primary; }
function payload(guild, panel) {
  const embed = new EmbedBuilder().setColor('#2563eb').setTitle(panel.title).setDescription(panel.description).setFooter({ text: `ZETA • ${guild.name}` });
  const rows = [];
  for (let i = 0; i < panel.items.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(panel.items.slice(i, i + 5).map((x, j) => {
      const idx = i + j;
      const b = new ButtonBuilder().setCustomId(`rr_${panel._id}_${idx}`).setLabel(x.label).setStyle(style(x.style));
      if (x.emoji) b.setEmoji(x.emoji);
      return b;
    })));
  }
  return { embeds: [embed], components: rows };
}
async function handleButton(interaction) {
  if (!interaction.customId.startsWith('rr_')) return false;
  const [, id, index] = interaction.customId.split('_');
  const panel = await ReactionRolePanel.findById(id);
  if (!panel || !panel.enabled) return interaction.reply({ content: '❌ لوحة الرتب متوقفة.', ephemeral: true });
  const item = panel.items[Number(index)];
  const role = interaction.guild.roles.cache.get(item?.roleId);
  if (!role) return interaction.reply({ content: '❌ الرتبة لم تعد موجودة.', ephemeral: true });
  try {
    if (interaction.member.roles.cache.has(role.id)) { await interaction.member.roles.remove(role); return interaction.reply({ content: `تمت إزالة رتبة ${role}.`, ephemeral: true }); }
    await interaction.member.roles.add(role);
    return interaction.reply({ content: `تمت إضافة رتبة ${role}.`, ephemeral: true });
  } catch { return interaction.reply({ content: '❌ البوت لا يملك صلاحية إدارة هذه الرتبة.', ephemeral: true }); }
}
module.exports = { payload, handleButton };
