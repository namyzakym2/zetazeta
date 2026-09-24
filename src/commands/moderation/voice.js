const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { can } = require('../../utils/permissions');
const logService = require('../../services/logService');
const { t } = require('../../services/translationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('إدارة الأعضاء في الروم الصوتي / Voice channel moderation')
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .addSubcommand((s) => s.setName('kick').setDescription('طرد عضو من الروم الصوتي').addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true)))
    .addSubcommand((s) => s.setName('mute').setDescription('كتم صوتي لعضو').addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true)))
    .addSubcommand((s) => s.setName('unmute').setDescription('فك الكتم الصوتي').addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true))),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: t('ar', 'guildOnly'), ephemeral: true });
    if (!can.muteMembers(interaction)) return interaction.reply({ content: t('ar', 'noPermission'), ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user', true);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member || !member.voice.channel) {
      return interaction.reply({ content: '❌ هذا العضو ليس في روم صوتي حاليًا.', ephemeral: true });
    }

    if (sub === 'kick') {
      await member.voice.disconnect(`Voice kick by ${interaction.user.tag}`);
      await logService.log(interaction.client, interaction.guild.id, 'vcKick', { User: `<@${target.id}>`, Moderator: `<@${interaction.user.id}>` });
      return interaction.reply(`🔊 تم طرد **${target.tag}** من الروم الصوتي.`);
    }

    if (sub === 'mute') {
      await member.voice.setMute(true, `Voice mute by ${interaction.user.tag}`);
      await logService.log(interaction.client, interaction.guild.id, 'vcMute', { User: `<@${target.id}>`, Moderator: `<@${interaction.user.id}>` });
      return interaction.reply(`🔇 تم كتم **${target.tag}** صوتيًا.`);
    }

    await member.voice.setMute(false, `Voice unmute by ${interaction.user.tag}`);
    await logService.log(interaction.client, interaction.guild.id, 'vcUnmute', { User: `<@${target.id}>`, Moderator: `<@${interaction.user.id}>` });
    return interaction.reply(`🔊 تم فك الكتم الصوتي عن **${target.tag}**`);
  }
};
