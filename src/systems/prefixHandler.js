const { PermissionFlagsBits } = require('discord.js');
const { buildV2Panel } = require('../utils/componentsV2');
const economyService = require('../services/economyService');
const activityService = require('../services/activityService');
const voteService = require('../services/voteService');
const logService = require('../services/logService');
const recentBotActions = require('../utils/recentBotActions');
const shortcutService = require('../services/shortcutService');
const publicCaptchaTransfer = require('./publicCaptchaTransfer');
const { formatMoney } = require('../utils/formatMoney');
const { t } = require('../services/translationService');
const GuildModel = require('../models/Guild');
const commandPermissionService = require('../services/commandPermissionService');
const commandStateService = require('../services/commandStateService');

/**
 * دالة مساعدة لتحويل رسائل البريفكس والـ Args إلى Fake Interaction 
 * متوافق تماماً مع جميع أوامر السلاش كوماند
 */
function createFakeInteraction(message, commandName, args) {
  const targetMember = message.mentions.members?.first() || message.guild.members.cache.get(args[0]) || message.member;
  const targetUser = message.mentions.users?.first() || targetMember?.user || message.author;
  const targetRole = message.mentions.roles?.first() || message.guild.roles.cache.get(args[0]);
  const targetChannel = message.mentions.channels?.first() || message.guild.channels.cache.get(args[0]) || message.channel;

  return {
    guild: message.guild,
    user: message.author,
    member: message.member,
    channel: message.channel,
    client: message.client,
    commandName,
    deferred: false,
    replied: false,
    options: {
      getUser: () => targetUser,
      getMember: () => targetMember,
      getRole: () => targetRole,
      getChannel: () => targetChannel,
      getString: () => args.join(' ') || null,
      getInteger: () => parseInt(args[0], 10) || null,
      getNumber: () => parseFloat(args[0]) || null,
      getBoolean: () => args[0]?.toLowerCase() === 'true'
    },
    deferReply: async () => Promise.resolve(),
    reply: async (payload) => message.reply(payload),
    editReply: async (payload) => message.reply(payload),
    followUp: async (payload) => message.reply(payload)
  };
}

function memberHas(message, flag) {
  return message.member?.permissions?.has(flag) ?? false;
}

async function handle(message, command, args) {
  const guildDoc = await economyService.getGuildSettings(message.guild.id);
  const locale = guildDoc.locale || 'ar';

  // نفس مفتاح التشغيل الموجود في الداشبورد ينطبق على أوامر البريفكس والاختصارات أيضًا.
  // إذا عطّل الأدمن الأمر، لا يستطيع أحد تشغيله بأي طريقة حتى يعيده.
  const commandEnabled = await commandStateService.isEnabled(message.guild.id, command);
  if (!commandEnabled) return message.reply('هذا الأمر متوقف من لوحة تحكم ZETA لهذا السيرفر.');

  // التحقق من صلاحيات الأمر المحددة في النظام
  const allowed = await commandPermissionService.isCommandAllowed(message.guild.id, command, message.member);
  if (!allowed) return message.reply(t(locale, 'noPermission'));

  switch (command) {
    case 'credit': {
      const mentioned = message.mentions.users.first();
      const amountArg = args.find((a) => /^\d+$/.test(a));

      if (mentioned && amountArg) {
        const amount = parseInt(amountArg, 10);
        const reason =
          args.filter((a) => a !== amountArg && !/^<@!?\d+>$/.test(a)).join(' ') || 'No reason provided';

        const result = await publicCaptchaTransfer.requestTransfer({
          channel: message.channel,
          sender: message.author,
          target: mentioned,
          amount,
          reason,
          guildId: message.guild.id
        });

        if (result.error === 'SELF') return message.reply(t(locale, 'credit.transfer.self'));
        if (result.error === 'BOT') return message.reply(t(locale, 'credit.transfer.bot'));
        if (result.error === 'INVALID_AMOUNT') return message.reply(t(locale, 'credit.transfer.invalidAmount'));
        if (result.error === 'INSUFFICIENT') return message.reply(t(locale, 'credit.transfer.insufficient'));
        if (result.error === 'ACCOUNT_TOO_NEW') {
          return message.reply('❌ حسابك في ديسكورد عمره أقل من شهر — الحسابات الجديدة ما تقدر تحول Zeta، وده لحماية النظام من الاحتيال.');
        }
        return;
      }

      const target = mentioned || message.author;
      const wallet = await economyService.getOrCreateWallet(target.id);
      return message.reply(
        mentioned
          ? `💳 | **<@${target.id}>'s account balance is \`$${wallet.balance}\` Zeta 😈.**`
          : `🏦 | **<@${target.id}>, your account balance is \`$${wallet.balance}\` Zeta 😈.**`
      );
    }

    case 'daily': {
      try {
        const result = await economyService.claimDaily(message.guild.id, message.author.id);
        const panel = buildV2Panel({
          title: t(locale, 'daily.title'),
          color: '#0f2158',
          description: `${t(locale, 'daily.received')}:\n💰 +${formatMoney(result.amount)}`,
          fields: [
            { name: t(locale, 'daily.streak'), value: `${result.streak} Days` },
            { name: t(locale, 'daily.balance'), value: formatMoney(result.balance) }
          ]
        });
        await logService.log(message.client, message.guild.id, 'dailyClaim', {
          User: `<@${message.author.id}>`, Amount: formatMoney(result.amount), Streak: result.streak
        });
        return message.reply(panel);
      } catch (err) {
        if (err.message === 'ALREADY_CLAIMED') return message.reply(t(locale, 'daily.alreadyClaimed', { time: 'soon' }));
        throw err;
      }
    }

    case 'speak': {
      const target = message.mentions.users.first() || message.author;
      const activity = await activityService.getActivity(message.guild.id, target.id);
      if (!activity) return message.reply('No activity data yet.');
      const rank = await activityService.getRank(message.guild.id, target.id);
      const panel = buildV2Panel({
        title: t(locale, 'speak.title'),
        color: '#0f2158',
        thumbnail: target.displayAvatarURL(),
        fields: [
          { name: t(locale, 'speak.level'), value: String(activity.level) },
          { name: t(locale, 'speak.xp'), value: String(activity.xp) },
          { name: t(locale, 'speak.messages'), value: String(activity.messages) },
          { name: t(locale, 'speak.rank'), value: rank ? `#${rank}` : 'N/A' }
        ],
        footer: t(locale, 'speak.noRewards')
      });
      return message.reply(panel);
    }

    case 'vote': {
      const panel = buildV2Panel({
        title: t(locale, 'vote.title'),
        color: '#0f2158',
        description: `${t(locale, 'vote.description')}\n\n💰 +${formatMoney(guildDoc.voteReward)}\n${voteService.getVoteUrl()}`
      });
      return message.reply(panel);
    }

    case 'role':
    case 'رتبة': {
      const isOwner = message.guild.ownerId === message.author.id;
      if (!isOwner && !memberHas(message, PermissionFlagsBits.ManageRoles)) {
        return message.reply(t(locale, 'noPermission'));
      }

      const targetMember = message.mentions.members?.first() || message.guild.members.cache.get(args[0]);
      if (!targetMember) return message.reply('❌ الاستخدام الصحيح: `!role @user @role` أو `!رتبة @user @role`');

      // البحث عن الرتبة برابط المنشن أو بالأيدي أو باسمها
      const roleArg = args.slice(1).join(' ');
      const targetRole = message.mentions.roles?.first() || 
                         message.guild.roles.cache.get(args[1]) || 
                         message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());

      if (!targetRole) return message.reply('❌ لم يتم العثور على الرتبة المحددة.');

      // 1. شرط الرتب: منع إعطاء رتبة أعلى من رتبة المنفذ نفسه
      if (!isOwner && targetRole.position >= message.member.roles.highest.position) {
        return message.reply('❌ لا يمكنك منح أو سحب رتبة أعلى من رتبتك أو مساوية لها!');
      }

      // 2. شرط رتبة البوت: التأكد أن رتبة البوت أعلى من الرتبة المراد منحها
      const botMember = message.guild.members.me;
      if (targetRole.position >= botMember.roles.highest.position) {
        return message.reply('❌ لا أستطيع التحكم بهذه الرتبة لأنها أعلى من أعلى رتبة يمتلكها البوت.');
      }

      try {
        if (targetMember.roles.cache.has(targetRole.id)) {
          recentBotActions.mark(message.guild.id, targetMember.id, 'roleRemove');
          await targetMember.roles.remove(targetRole);
          await logService.log(message.client, message.guild.id, 'roleRemove', {
            User: targetMember.user.tag, Role: targetRole.name, Moderator: `<@${message.author.id}>`
          });
          return message.reply(`✅ تم إزالة رتبة **${targetRole.name}** من **${targetMember.user.tag}**`);
        } else {
          recentBotActions.mark(message.guild.id, targetMember.id, 'roleAdd');
          await targetMember.roles.add(targetRole);
          await logService.log(message.client, message.guild.id, 'roleAdd', {
            User: targetMember.user.tag, Role: targetRole.name, Moderator: `<@${message.author.id}>`
          });
          return message.reply(`✅ تم إعطاء رتبة **${targetRole.name}** لـ **${targetMember.user.tag}**`);
        }
      } catch (err) {
        console.error('Role Command Error:', err);
        return message.reply('❌ حدث خطأ أثناء التعديل على الرتب.');
      }
    }

    case 'warn': {
      const isOwner = message.guild.ownerId === message.author.id;
      const hasAdminPerms = memberHas(message, PermissionFlagsBits.Administrator) ||
                             memberHas(message, PermissionFlagsBits.ModerateMembers) ||
                             memberHas(message, PermissionFlagsBits.BanMembers) ||
                             memberHas(message, PermissionFlagsBits.KickMembers);

      if (!isOwner && !hasAdminPerms) return message.reply(t(locale, 'noPermission'));

      const targetMember = message.mentions.members?.first() || message.guild.members.cache.get(args[0]);
      if (!targetMember) return message.reply('Usage: !تحذير @user reason');

      // شرط الرتب
      if (!isOwner && message.member.roles.highest.position <= targetMember.roles.highest.position) {
        return message.reply('❌ لا يمكنك تحذير شخص رتبته أعلى منك أو مساوية لك!');
      }

      const reason = args.filter((a) => !a.startsWith('<@')).join(' ') || 'No reason provided';
      const Warning = require('../models/Warning');
      await Warning.create({ guildId: message.guild.id, userId: targetMember.id, moderatorId: message.author.id, reason });

      // إرسال إشعار للمستخدم في الخاص (DM)
      const dmPanel = buildV2Panel({
        title: '⚠️ تلقيت تحذيراً جديداً!',
        color: '#FF0000',
        fields: [
          { name: '🌐 السيرفر:', value: `**${message.guild.name}**` },
          { name: '📝 السبب:', value: `\`${reason}\`` }
        ],
        timestamp: true
      });

      await targetMember.send(dmPanel).catch(() => {
        // يتم تجاهل الخطأ في حال كانت إعدادات الخصوصية تمنع البوت من إرسال DM
      });

      await logService.log(message.client, message.guild.id, 'warn', { User: targetMember.user.tag, Moderator: `<@${message.author.id}>`, Reason: reason });
      return message.reply(`⚠️ تم تحذير **${targetMember.user.tag}**`);
    }

    case 'clear': {
      if (!memberHas(message, PermissionFlagsBits.ManageMessages)) return message.reply(t(locale, 'noPermission'));
      const amount = Math.min(parseInt(args[0], 10) || 10, 100);
      const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
      return message.channel.send(`🧹 Deleted ${deleted ? deleted.size : 0} messages.`).then((m) => setTimeout(() => m.delete().catch(() => {}), 3000));
    }

    case 'lock': {
      if (!memberHas(message, PermissionFlagsBits.ManageChannels)) return message.reply(t(locale, 'noPermission'));
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      return message.reply('🔒 Locked.');
    }

    case 'unlock': {
      if (!memberHas(message, PermissionFlagsBits.ManageChannels)) return message.reply(t(locale, 'noPermission'));
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      return message.reply('🔓 Unlocked.');
    }

    case 'kick': {
      if (!memberHas(message, PermissionFlagsBits.KickMembers)) return message.reply(t(locale, 'noPermission'));
      const target = message.mentions.members?.first();
      if (!target || !target.kickable) return message.reply('❌ Cannot kick this member.');
      await target.kick('Prefix command');
      await logService.log(message.client, message.guild.id, 'kick', { User: target.user.tag, Moderator: `<@${message.author.id}>` });
      return message.reply(`👢 Kicked **${target.user.tag}**`);
    }

    case 'ban': {
      if (!memberHas(message, PermissionFlagsBits.BanMembers)) return message.reply(t(locale, 'noPermission'));
      const target = message.mentions.users.first();
      if (!target) return message.reply('Usage: !حظر @user');
      recentBotActions.mark(message.guild.id, target.id, 'ban');
      await message.guild.members.ban(target.id, { reason: 'Prefix command' });
      await logService.log(message.client, message.guild.id, 'ban', { User: target.tag, Moderator: `<@${message.author.id}>` });
      return message.reply(`🔨 Banned **${target.tag}**`);
    }

    case 'timeout': {
      if (!memberHas(message, PermissionFlagsBits.ModerateMembers)) return message.reply(t(locale, 'noPermission'));
      const target = message.mentions.members?.first();
      const minutes = parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 10;
      if (!target || !target.moderatable) return message.reply('❌ Cannot timeout this member.');
      recentBotActions.mark(message.guild.id, target.id, 'timeout');
      await target.timeout(minutes * 60 * 1000, 'Prefix command');
      await logService.log(message.client, message.guild.id, 'timeout', { User: target.user.tag, Moderator: `<@${message.author.id}>`, Duration: `${minutes}m` });
      return message.reply(`⏱️ Timed out **${target.user.tag}** for ${minutes}m`);
    }

    case 'unban': {
      if (!memberHas(message, PermissionFlagsBits.BanMembers)) return message.reply(t(locale, 'noPermission'));
      const userId = args.find((a) => /^\d{15,}$/.test(a));
      if (!userId) return message.reply('Usage: !فك_حظر <user_id>');
      const bans = await message.guild.bans.fetch();
      const ban = bans.get(userId);
      if (!ban) return message.reply('❌ هذا المستخدم غير محظور.');
      recentBotActions.mark(message.guild.id, userId, 'unban');
      await message.guild.members.unban(userId, 'Prefix command');
      await logService.log(message.client, message.guild.id, 'unban', { User: `${ban.user.tag} (${userId})`, Moderator: `<@${message.author.id}>` });
      return message.reply(`🔓 تم فك حظر **${ban.user.tag}**`);
    }

    case 'mute': {
      if (!memberHas(message, PermissionFlagsBits.ModerateMembers)) return message.reply(t(locale, 'noPermission'));
      const target = message.mentions.members?.first();
      if (!target) return message.reply('Usage: !كتم @user');
      const { getOrCreateMuteRole } = require('../commands/moderation/mute');
      const muteRole = await getOrCreateMuteRole(message.guild);
      if (target.roles.cache.has(muteRole.id)) return message.reply('❌ هذا العضو مكتوم بالفعل.');
      await target.roles.add(muteRole, 'Prefix command');
      await logService.log(message.client, message.guild.id, 'mute', { User: target.user.tag, Moderator: `<@${message.author.id}>` });
      return message.reply(`🔇 تم كتم **${target.user.tag}**`);
    }

    case 'unmute': {
      if (!memberHas(message, PermissionFlagsBits.ModerateMembers)) return message.reply(t(locale, 'noPermission'));
      const target = message.mentions.members?.first();
      if (!target) return message.reply('Usage: !فك_كتم @user');
      const gd = await GuildModel.findOne({ guildId: message.guild.id });
      if (!gd?.muteRoleId) return message.reply('❌ لا يوجد رول كتم مُعد بعد لهذا السيرفر.');
      if (!target.roles.cache.has(gd.muteRoleId)) return message.reply('❌ هذا العضو غير مكتوم.');
      await target.roles.remove(gd.muteRoleId, 'Prefix command');
      await logService.log(message.client, message.guild.id, 'unmute', { User: target.user.tag, Moderator: `<@${message.author.id}>` });
      return message.reply(`🔊 تم فك كتم **${target.user.tag}**`);
    }

    case 'warnings': {
      const isOwner = message.guild.ownerId === message.author.id;
      const hasAdminPerms = memberHas(message, PermissionFlagsBits.Administrator) ||
                             memberHas(message, PermissionFlagsBits.ModerateMembers) ||
                             memberHas(message, PermissionFlagsBits.BanMembers) ||
                             memberHas(message, PermissionFlagsBits.KickMembers);

      if (!isOwner && !hasAdminPerms) return message.reply(t(locale, 'noPermission'));

      const targetMember = message.mentions.members?.first() || message.guild.members.cache.get(args[0]);
      const targetUser = targetMember?.user || message.mentions.users.first();
      if (!targetUser) return message.reply('Usage: !تحذيراته @user');

      // شرط الرتب
      if (targetMember && !isOwner && message.member.roles.highest.position <= targetMember.roles.highest.position && targetUser.id !== message.author.id) {
        return message.reply('❌ لا يمكنك رؤية تحذيرات شخص رتبته أعلى منك أو مساوية لك.');
      }

      const Warning = require('../models/Warning');
      const warnings = await Warning.find({ guildId: message.guild.id, userId: targetUser.id }).sort({ createdAt: -1 }).limit(15);
      const panel = buildV2Panel({
        title: `⚠️ Warnings — ${targetUser.tag}`,
        color: '#0f2158',
        thumbnail: targetUser.displayAvatarURL(),
        description:
          warnings.length
            ? warnings
                .map((w, i) => `**#${i + 1}**\nReason: ${w.reason}\nModerator: <@${w.moderatorId}>`)
                .join('\n\n')
            : 'لا توجد تحذيرات لهذا العضو.'
      });
      return message.reply(panel);
    }

    case 'unwarn': {
      const isOwner = message.guild.ownerId === message.author.id;
      const hasAdminPerms = memberHas(message, PermissionFlagsBits.Administrator) ||
                             memberHas(message, PermissionFlagsBits.ModerateMembers) ||
                             memberHas(message, PermissionFlagsBits.BanMembers) ||
                             memberHas(message, PermissionFlagsBits.KickMembers);

      if (!isOwner && !hasAdminPerms) return message.reply(t(locale, 'noPermission'));

      const targetMember = message.mentions.members?.first() || message.guild.members.cache.get(args[0]);
      const targetUser = targetMember?.user || message.mentions.users.first();
      if (!targetUser) return message.reply('Usage: !الغاء_تحذير @user');

      // شرط الرتب
      if (targetMember && !isOwner && message.member.roles.highest.position <= targetMember.roles.highest.position) {
        return message.reply('❌ لا يمكنك إلغاء تحذير شخص رتبته أعلى منك أو مساوية لك!');
      }

      const Warning = require('../models/Warning');
      const User = require('../models/User');

      // حذف التحذير نهائياً من الداتابيز
      const deletedWarning = await Warning.findOneAndDelete({ guildId: message.guild.id, userId: targetUser.id }).sort({ createdAt: -1 });
      if (!deletedWarning) return message.reply('❌ لا يوجد تحذيرات مسجلة لهذا العضو.');

      await User.findOneAndUpdate({ guildId: message.guild.id, userId: targetUser.id }, { $inc: { warnings: -1 } });
      await logService.log(message.client, message.guild.id, 'unwarn', {
        User: `<@${targetUser.id}>`, Moderator: `<@${message.author.id}>`, RemovedReason: deletedWarning.reason
      });
      return message.reply(`✅ تم حذف آخر تحذير لـ **${targetUser.tag}** نهائياً.`);
    }

    case 'salary': {
      const staffRoleId = process.env.STAFF_ROLE_ID;
      if (!staffRoleId || !message.member.roles.cache.has(staffRoleId)) {
        return message.reply('❌ هذا الأمر مخصص لأعضاء الإدارة فقط.');
      }
      try {
        const result = await economyService.claimSalary(message.guild.id, message.author.id);
        const panel = buildV2Panel({
          title: '💼 راتب الإدارة',
          color: '#0f2158',
          description: `تم استلام راتبك الأسبوعي بنجاح:\n💰 +${formatMoney(result.amount)}`,
          fields: [{ name: '💳 رصيدك الحالي', value: formatMoney(result.balance) }]
        });
        await logService.log(message.client, message.guild.id, 'salaryClaim', { User: `<@${message.author.id}>`, Amount: formatMoney(result.amount) });
        return message.reply(panel);
      } catch (err) {
        if (err.message === 'ALREADY_CLAIMED') return message.reply('❌ استلمت راتبك بالفعل.');
        throw err;
      }
    }

    case 'serverstats': {
      if (!memberHas(message, PermissionFlagsBits.ManageGuild)) return message.reply(t(locale, 'noPermission'));
      const guild = message.guild;
      const members = await guild.members.fetch();
      const humans = members.filter((m) => !m.user.bot).size;
      const bots = members.filter((m) => m.user.bot).size;
      const embed = buildV2Panel({
        title: `📊 إحصائيات ${guild.name}`,
        thumbnail: guild.iconURL(),
        color: '#5865F2',
        fields: [
          { name: '👥 الأعضاء', value: `${guild.memberCount}` },
          { name: '🧑 بشر', value: `${humans}` },
          { name: '🤖 بوتات', value: `${bots}` },
          { name: '🎭 رتب', value: `${guild.roles.cache.size - 1}` }
        ]
      });
      return message.reply(embed);
    }

    case 'invite': {
      const link = process.env.INVITE_LINK ||
        (process.env.CLIENT_ID ? `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands` : null);
      if (!link) return message.reply('❌ لم يتم ضبط رابط الدعوة بعد.');
      return message.reply(link);
    }

    case 'language': {
      if (!memberHas(message, PermissionFlagsBits.ManageGuild)) return message.reply(t(locale, 'noPermission'));
      const wanted = args[0]?.toLowerCase();
      if (wanted !== 'ar' && wanted !== 'en') return message.reply('Usage: !لغة ar | en');
      const guildDoc = await GuildModel.findOne({ guildId: message.guild.id }) || await GuildModel.create({ guildId: message.guild.id });
      guildDoc.locale = wanted;
      await guildDoc.save();
      return message.reply(`🌍 Locale: ${wanted}`);
    }

    case 'shortcuts': {
      const guildDoc = await GuildModel.findOne({ guildId: message.guild.id });
      const list = [...shortcutService.DEFAULT_SHORTCUTS, ...(guildDoc?.shortcuts || [])];
      const byCommand = new Map();
      for (const s of list) {
        if (s.enabled === false) continue;
        if (!byCommand.has(s.command)) byCommand.set(s.command, []);
        byCommand.get(s.command).push(s.shortcut);
      }
      const lines = [...byCommand.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cmd, sc]) => `**/${cmd}** — ${sc.map((s) => `\`${s}\``).join(' , ')}`);
      const panel = buildV2Panel({ title: '⚡ Shortcuts', color: '#0f2158', description: lines.join('\n') });
      return message.reply(panel);
    }

    case 'untimeout':
    case 'ut':
    case 'تكلم': {
      if (!memberHas(message, PermissionFlagsBits.ModerateMembers)) {
        return message.reply('❌ لا تملك الصلاحيات الكافية لاستخدام هذا الأمر.');
      }

      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) {
        return message.reply('❌ يرجى تحديد العضو المراد إزالة التايم أوت عنه (منشن أو ID).');
      }

      if (!target.isCommunicationDisabled()) {
        return message.reply('⚠️ هذا العضو ليس في حالة تايم أوت.');
      }

      const reason = args.slice(1).join(' ') || 'No reason provided';

      try {
        await target.timeout(null, reason);
        return message.reply(`✅ تم إلغاء التايم أوت عن **${target.user.tag}** | السبب: ${reason}`);
      } catch (err) {
        console.error(err);
        return message.reply('❌ حدث خطأ أثناء إزالة التايم أوت.');
      }
    }

    case 'tax': {
      const amount = parseInt(args[0], 10);
      if (isNaN(amount) || amount <= 0) {
        return message.reply('❌ يرجى إدخال مبلغ صحيح بعد الأمر، مثال: `tax 1000`');
      }

      const taxAmount = Math.floor(amount * 0.025);
      const totalAmount = amount + taxAmount;

      return message.reply(`🧮 **حساب الضريبة (2.5%):**\n- المبلغ: \`${amount.toLocaleString()}\`\n- الضريبة: \`${taxAmount.toLocaleString()}\`\n- الإجمالي: \`${totalAmount.toLocaleString()}\``);
    }

    case 'leaderboard':
    case 'top':
    case 'lb':
    case 't': {
      try {
        const textTop = await activityService.getLeaderboard(message.guild.id, 'text', 'alltime', 5);
        const voiceTop = await activityService.getLeaderboard(message.guild.id, 'voice', 'alltime', 5);
        const voiceActivity = require('../services/voiceActivityService');

        const formatVoice = (seconds) => voiceActivity.formatDuration(seconds || 0);
        const medal = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;

        const textLines = textTop.length
          ? textTop.map((u, i) =>
              `${medal(i)} <@${u.userId}> • **${u.messages || 0}** رسالة • **${u.xp || 0} XP**`
            ).join('\n')
          : '📭 لا توجد بيانات كتابة بعد.';

        const voiceLines = voiceTop.length
          ? voiceTop.map((u, i) =>
              `${medal(i)} <@${u.userId}> • **${u.voicePoints || Math.floor((u.voiceSeconds || 0) / 60)}** نقطة صوت • **${formatVoice(u.voiceSeconds)}**`
            ).join('\n')
          : '📭 لا توجد بيانات صوتية بعد.';

        const totalMessages = textTop.reduce((n, u) => n + (u.messages || 0), 0);
        const totalVoiceSeconds = voiceTop.reduce((n, u) => n + (u.voiceSeconds || 0), 0);

        const panel = buildV2Panel({
          title: `🏆 ليدر بورد ${message.guild.name}`,
          color: '#0f2158',
          thumbnail: message.guild.iconURL({ dynamic: true }),
          fields: [
            { name: '💬 أفضل نقاط الكتابة', value: textLines },
            { name: '🎙️ أفضل نقاط الصوت', value: voiceLines },
            { name: '📊 إحصائيات', value: `الرسائل: **${totalMessages}**\nوقت الصوت: **${formatVoice(totalVoiceSeconds)}**` }
          ],
          footer: `طلب بواسطة ${message.author.tag}`,
          timestamp: true
        });

        return message.reply(panel);
      } catch (err) {
        console.error('Leaderboard Error:', err);
        return message.reply('❌ حدث خطأ أثناء جلب قائمة المتصدرين.');
      }
    }

    case 'box':
    case 'بوكس': {
      if (!args[0]) {
        return message.reply('❌ يرجى تحديد الجائزة! مثال: `!box 5m`');
      }

      const prize = args.join(' ');

      try {
        const boxCommand = require('../commands/system/box.js');
        const fakeInteraction = createFakeInteraction(message, 'box', args);
        
        fakeInteraction.options.getString = (name) => name === 'prize' ? prize : null;
        fakeInteraction.options.getChannel = () => message.channel;

        await boxCommand.execute(fakeInteraction);
      } catch (error) {
        console.error('Box Command Error:', error);
        return message.reply('❌ حدث خطأ أثناء إنشاء الصندوق.');
      }
      break;
    }

    case 'profile':
    case 'p': {
      const targetMember = message.mentions.members.first() || 
                           message.guild.members.cache.get(args[0]) || 
                           message.member;
                           
      const targetUser = targetMember.user;
      const loadingMsg = await message.reply('🔄 جاري تحميل بطاقة البروفايل...');

      try {
        const profileCommand = require('../commands/activity/profile.js');
        
        const fakeInteraction = {
          guild: message.guild,
          user: targetUser,
          member: targetMember,
          channel: message.channel,
          client: message.client,
          options: {
            getUser: () => targetUser,
            getMember: () => targetMember
          },
          deferred: true,
          replied: false,
          deferReply: async () => {},
          followUp: async (payload) => message.reply(payload),
          editReply: async (payload) => {
            await loadingMsg.delete().catch(() => {});
            return message.reply(payload);
          },
          reply: async (payload) => {
            await loadingMsg.delete().catch(() => {});
            return message.reply(payload);
          }
        };

        await profileCommand.execute(fakeInteraction);
      } catch (error) {
        console.error('Profile Command Error:', error);
        await loadingMsg.edit('❌ حدث خطأ أثناء إنشاء صورة البروفايل.').catch(() => {});
      }
      break;
    }

    // --- أمر الإدارة السري المخصص لعرض سيرفرات البوت ---
    case 'servers-bot':
    case 'sb-secret': {
      const allowedOwnerId = process.env.OWNER_ID;
      if (message.author.id !== allowedOwnerId) return;

      const inputSecret = args[0];
      const correctSecret = process.env.BOT_SECRET_CODE;

      if (!inputSecret || inputSecret !== correctSecret) {
        await message.delete().catch(() => {});
        return;
      }

      await message.delete().catch(() => {});

      try {
        const guilds = message.client.guilds.cache;
        let description = `📊 **إجمالي السيرفرات:** \`${guilds.size}\` سيرفر\n\n`;

        guilds.forEach((guild) => {
          description += `• **${guild.name}** | ID: \`${guild.id}\` | الأعضاء: \`${guild.memberCount}\`\n`;
        });

        const chunks = description.match(/[\s\S]{1,3900}(?=\n|$)/g) || [description];

        for (let i = 0; i < chunks.length; i++) {
          const panel = buildV2Panel({
            title: i === 0 ? '🔒 قائمة سيرفرات البوت (خاص بالمالك)' : `قائمة السيرفرات (${i + 1})`,
            color: '#1E1E1E',
            description: chunks[i],
            timestamp: true
          });

          await message.author.send(panel).catch(async () => {
            const tempMsg = await message.channel.send(panel);
            setTimeout(() => tempMsg.delete().catch(() => {}), 30000);
          });
        }
      } catch (error) {
        console.error('Error in servers-bot command:', error);
      }
      break;
    }

    // --- Dynamic Router: لتشغيل بقية أوامر السلاش تلقائياً بالبريفكس ---
    default: {
      try {
        const fs = require('fs');
        const path = require('path');
        const commandsPath = path.join(__dirname, '../commands');
        
        let commandFile = null;

        // Support both root-level commands and category folders.
        const commandFileName = `${command}.js`;
        const rootCommandPath = path.join(commandsPath, commandFileName);
        if (fs.existsSync(rootCommandPath) && fs.statSync(rootCommandPath).isFile()) {
          commandFile = require(rootCommandPath);
        } else {
          const categories = fs.readdirSync(commandsPath);
          for (const category of categories) {
            const categoryPath = path.join(commandsPath, category);
            if (fs.statSync(categoryPath).isDirectory()) {
              const filePath = path.join(categoryPath, commandFileName);
              if (fs.existsSync(filePath)) {
                commandFile = require(filePath);
                break;
              }
            }
          }
        }

        if (commandFile && typeof commandFile.execute === 'function') {
          const fakeInteraction = createFakeInteraction(message, command, args);
          return await commandFile.execute(fakeInteraction);
        } else {
          return null; // يتجاهل الرسائل النصية غير التابعة للأوامر
        }
      } catch (err) {
        console.error(`Error executing command ${command} via Prefix:`, err);
        return message.reply(`❌ حدث خطأ أثناء تنفيذ الأمر \`${command}\`.`);
      }
    }
  }
}

module.exports = { handle };