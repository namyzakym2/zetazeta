const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can, canModerate } = require('../../utils/permissions');
const GuildModel = require('../../models/Guild');
const logService = require('../../services/logService');
const staffPointsService = require('../../services/staffPointsService');
const { t } = require('../../services/translationService');

async function getOrCreateMuteRole(guild) {
  const guildDoc = await GuildModel.findOne({ guildId: guild.id }) || await GuildModel.create({ guildId: guild.id });

  if (guildDoc.muteRoleId) {
    const existing = guild.roles.cache.get(guildDoc.muteRoleId);
    if (existing) return existing;
  }

  const role = await guild.roles.create({
    name: 'Muted',
    color: '#4a1e1e',
    reason: 'ZETA auto-created mute role'
  });

  // Deny SendMessages / AddReactions / Speak / Stream in every existing channel.
  for (const channel of guild.channels.cache.values()) {
    await channel.permissionOverwrites
      .edit(role, { SendMessages: false, AddReactions: false, Speak: false, Stream: false })
      .catch(() => {});
  }

  guildDoc.muteRoleId = role.id;
  await guildDoc.save();
  return role;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('كتم عضو (رول منفصل عن التايم آوت) / Mute a member via a dedicated role')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('السبب').setRequired(false)),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.timeout(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ العضو غير موجود في السيرفر.', ephemeral: true });
    const hierarchyCheck = canModerate(interaction, member);
    if (!hierarchyCheck.ok) return interaction.reply({ content: hierarchyCheck.reason, ephemeral: true });

    const muteRole = await getOrCreateMuteRole(interaction.guild);
    if (member.roles.cache.has(muteRole.id)) {
      return interaction.reply({ content: '❌ هذا العضو مكتوم بالفعل.', ephemeral: true });
    }

    await member.roles.add(muteRole, reason);

    await logService.log(interaction.client, interaction.guild.id, 'mute', {
      User: `${target.tag} (${target.id})`,
      Moderator: `<@${interaction.user.id}>`,
      Reason: reason
    });

    await staffPointsService
      .awardCommandPoints(interaction.client, interaction.guild.id, interaction.user.id, 'mute')
      .catch(() => {});

    return interaction.reply(`🔇 تم كتم **${target.tag}**\nالسبب: ${reason}`);
  },

  getOrCreateMuteRole
};
