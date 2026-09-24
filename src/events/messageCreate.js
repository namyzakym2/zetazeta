const activityService = require('../services/activityService');
const interactionPointsService = require('../services/interactionPointsService');
const automod = require('../systems/automod');
const antiSpamHeat = require('../systems/antiSpamHeat');
const sellerRoom = require('../systems/sellerRoom');
const suggestions = require('../systems/suggestions');
const shortcutService = require('../services/shortcutService');
const GuildModel = require('../models/Guild');
const prefixHandler = require('../systems/prefixHandler');
const publicCaptchaTransfer = require('../systems/publicCaptchaTransfer');
const levelupSystem = require('../systems/levelup');
const autoResponder = require('../systems/autoResponder');
const customCommands = require('../systems/customCommands');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    // 1. فحص الكابتشا الخاص بالتحويل أولاً
    const wasCaptchaResponse = await publicCaptchaTransfer.handleMessage(message).catch(() => false);
    if (wasCaptchaResponse) return;

    // 1.5 ZETA Shield — heat-based anti-spam
    const wasHeat = await antiSpamHeat.handleMessage(message).catch(() => false);
    if (wasHeat) return;

    // 2. نظام الـ AutoMod للحماية والفلترة
    const wasRemoved = await automod.moderate(message).catch(() => false);
    if (wasRemoved) return;

    // 2.5 روم البيع والتجار (Seller Room)
    const wasSellerRoom = await sellerRoom.handleMessage(message).catch(() => false);
    if (wasSellerRoom) return;

    // 3. روم الاقتراحات (Suggestions)
    const wasSuggestion = await suggestions.postSuggestion(message).catch(() => false);
    if (wasSuggestion) return;

    // 4. تسجل النشاط والخبرة (XP / Levels)
    const activityResult = await activityService.registerMessage(message.guild.id, message.author.id, message).catch(() => null);
    if (activityResult?.leveledUp) {
      await levelupSystem.handleLevelUp(message, activityResult.user).catch(() => {});
    }

    // 4.5 نقاط التفاعل (ترقيات رتب مقابل النشاط — اختياري لكل سيرفر، بدون علاقة بالـ VC)
    await interactionPointsService.registerMessage(message).catch(() => null);

    // 5. معالجة اختصارات الأوامر والبريفكس (Prefix Shortcuts)
    const guildDoc = await GuildModel.findOne({ guildId: message.guild.id });
    const prefix = guildDoc?.prefix ?? process.env.DEFAULT_PREFIX ?? '!';

    // فحص ما إذا كانت الرسالة تبدأ بالبريفكس أو هي أمر خاص بالمالك
    if (message.content.startsWith(prefix)) {
      const resolved = await shortcutService.resolveShortcut(message.guild.id, prefix, message.content).catch(() => null);
      
      if (resolved) {
        await prefixHandler.handle(message, resolved.command, resolved.args).catch((e) => console.error('[prefixHandler]', e));
      } else {
        // في حال لم يكن اختصاراً مسجلاً، يتم استخراج اسم الأمر والـ args مباشرة
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift()?.toLowerCase();

        if (command) {
          await prefixHandler.handle(message, command, args).catch((e) => console.error('[prefixHandler]', e));
        }
      }
    }

    // 6. الرد التلقائي (Auto Responder)
    await autoResponder.handleMessage(message).catch((e) => console.error('[autoResponder]', e));

    // 7. الأوامر المخصصة — Wicks-style custom responses, but native to ZETA.
    await customCommands.handleMessage(message).catch((e) => console.error('[customCommands]', e));
  }
};