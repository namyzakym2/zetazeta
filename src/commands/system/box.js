const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { setEmojiSafe } = require('../../utils/emoji');
const { buildV2Panel } = require('../../utils/componentsV2');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('box')
    .setDescription('إنشاء صندوق جوائز سريع (Box Giveaway)')
    .addStringOption(option =>
      option.setName('prize')
        .setDescription('الجائزة (مثال: 5m / رتبة / سيرفر)')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('القناة التي سيتم إرسال الصندوق فيها')
        .setRequired(false)),

  async execute(interaction) {
    const prize = interaction.options.getString('prize');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel.isTextBased()) {
      return interaction.reply({ content: '❌ يرجى اختيار قناة نصية صحيحة.', flags: 64 });
    }

    // إشعار سري للمضيف
    await interaction.reply({ 
      content: `✅ **Box started in ${targetChannel} !**`, 
      flags: 64 
    });

    const customId = `box_claim_${interaction.id}`;

    // زر الصندوق (يتحول لـ 1/1 عند الانتهاء)
    const getButton = (disabled = false, count = 0) => {
      const button = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(`${count}/1`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);
      setEmojiSafe(button, '🎉', 'spark');
      return new ActionRowBuilder().addComponents(button);
    };

    // 1. تصميم لوحة الصندوق (Components v2)
    const buildBoxPanel = (disabled = false, count = 0) => buildV2Panel({
      color: '#5865F2',
      description:
        `💎 **${prize}**\n\n` +
        `🔒 **Hosted By** <@${interaction.user.id}>\n` +
        `👤 \`.${interaction.user.username}\``,
      rows: [getButton(disabled, count)]
    });

    // إرسال رسالة الصندوق
    const boxMessage = await targetChannel.send(buildBoxPanel(false, 0));

    // 2. معالج الضغطة (أول شخص يضغط هو الفائز الوحيد)
    const collector = boxMessage.createMessageComponentCollector({
      filter: i => i.customId === customId,
      max: 1, // ينتهي فوراً مع أول ضغطة
      time: 24 * 60 * 60 * 1000 // مدة الصلاحية يوم كامل
    });

    collector.on('collect', async (i) => {
      const winner = i.user;

      // 1. قفل الزر وتحديث شكله لـ 1/1
      await i.update(buildBoxPanel(true, 1));

      // 2. إعلان اسم الفائز فوراً
      const winPanel = buildV2Panel({
        pingContent: `🎊 مبروك <@${winner.id}>!`,
        color: '#00FF00',
        title: '🎁 انتهى الصندوق!',
        description: `🎉 مبروك <@${winner.id}> فوزك بـ **${prize}**!\n\n👑 المضيف: <@${interaction.user.id}>`
      });

      await targetChannel.send(winPanel);
    });

    collector.on('end', async (collected, reason) => {
      // إذا انتهى الوقت بدون ما أحد يضغط
      if (collected.size === 0) {
        await boxMessage.edit(buildBoxPanel(true, 0)).catch(() => {});
      }
    });
  }
};
