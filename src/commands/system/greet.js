'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildModel = require('../../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('greet')
    .setDescription('إعداد رسالة الترحيب المخصصة عند دخول عضو جديد')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('room').setDescription('روم الترحيب').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('الرسالة؛ {server} {user} {invited}').setRequired(true).setMaxLength(2000))
    .addIntegerOption(o => o.setName('seconds').setDescription('عدد الثواني قبل حذف رسالة الترحيب (0 = لا تحذف)').setRequired(false).setMinValue(0).setMaxValue(86400)),

  async execute(interaction) {
    const room = interaction.options.getChannel('room', true);
    const message = interaction.options.getString('message', true);
    const seconds = interaction.options.getInteger('seconds') ?? 0;

    if (!room.isTextBased() || room.guildId !== interaction.guild.id) {
      return interaction.reply({ content: '❌ اختر روم نصي من نفس السيرفر.', ephemeral: true });
    }

    const doc = await GuildModel.findOneAndUpdate(
      { guildId: interaction.guild.id },
      {
        $set: {
          'greet.enabled': true,
          'greet.channelId': room.id,
          'greet.message': message,
          'greet.deleteAfterSeconds': seconds
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return interaction.reply({
      content:
        `✅ تم تفعيل الترحيب في ${room}.\n` +
        `🗑️ الحذف بعد: **${seconds ? `${seconds} ثانية` : 'لن تُحذف'}**\n` +
        `المتغيرات: \`{server}\` \`{user}\` \`{invited}\``,
      ephemeral: true
    });
  }
};
