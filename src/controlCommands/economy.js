const { SlashCommandBuilder } = require('discord.js');
const economy = require('../services/economyService');
const { parseAmount } = require('../utils/parseAmount');
const owner = i => String(process.env.OWNER_ID || '') === i.user.id;
const deny = i => i.reply({ content: '⛔ هذا الأمر لمالك البوت فقط.', ephemeral: true });
const userOpt = c => c.addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true));
const amountOpt = c => c.addStringOption(o => o.setName('amount').setDescription('1000 أو 10k أو 10m أو 1b').setRequired(true));

const add = new SlashCommandBuilder().setName('money-add').setDescription('إضافة Zeta');
userOpt(amountOpt(add));
const remove = new SlashCommandBuilder().setName('money-remove').setDescription('خصم Zeta');
userOpt(amountOpt(remove));
const blacklist = new SlashCommandBuilder().setName('economy-blacklist').setDescription('منع مستخدم من التحويل');
userOpt(blacklist).addStringOption(o => o.setName('reason').setDescription('السبب'));
const unblacklist = new SlashCommandBuilder().setName('economy-unblacklist').setDescription('إلغاء منع التحويل');
userOpt(unblacklist);
const reset = new SlashCommandBuilder().setName('money-reset').setDescription('تصفير رصيد مستخدم');
userOpt(reset).addBooleanOption(o => o.setName('confirm').setDescription('تأكيد').setRequired(true));

module.exports = [
 { data:add, async execute(i) { if(!owner(i)) return deny(i); const a=parseAmount(i.options.getString('amount')); if(!a) return i.reply({content:'❌ مبلغ غير صالح.',ephemeral:true}); const u=i.options.getUser('user'); const w=await economy.adminAdjust(null,u.id,a,i.user.id); return i.reply({content:`✅ أضفت **${a.toLocaleString()} Zeta** إلى <@${u.id}>. الرصيد: **${w.balance.toLocaleString()}**.`,ephemeral:true}); } },
 { data:remove, async execute(i) { if(!owner(i)) return deny(i); const a=parseAmount(i.options.getString('amount')); if(!a) return i.reply({content:'❌ مبلغ غير صالح.',ephemeral:true}); const u=i.options.getUser('user'); try { const w=await economy.adminAdjust(null,u.id,-a,i.user.id); return i.reply({content:`✅ خصمت **${a.toLocaleString()} Zeta** من <@${u.id}>. الرصيد: **${w.balance.toLocaleString()}**.`,ephemeral:true}); } catch(e) { if(e.message==='INSUFFICIENT_FUNDS') return i.reply({content:'❌ الرصيد لا يكفي.',ephemeral:true}); throw e; } } },
 { data:blacklist, async execute(i) { if(!owner(i)) return deny(i); const u=i.options.getUser('user'); await economy.setBlacklist(u.id,true,{reason:i.options.getString('reason')||'Owner blacklist',adminUserId:i.user.id}); return i.reply({content:`🚫 تم منع <@${u.id}> من التحويل.`,ephemeral:true}); } },
 { data:unblacklist, async execute(i) { if(!owner(i)) return deny(i); const u=i.options.getUser('user'); await economy.setBlacklist(u.id,false,{adminUserId:i.user.id}); return i.reply({content:`✅ تم إلغاء منع <@${u.id}>.`,ephemeral:true}); } },
 { data:reset, async execute(i) { if(!owner(i)) return deny(i); if(!i.options.getBoolean('confirm')) return i.reply({content:'⚠️ يجب تأكيد العملية.',ephemeral:true}); const u=i.options.getUser('user'); await economy.adminZeroBalance(u.id,i.user.id,null); return i.reply({content:`🧹 تم تصفير رصيد <@${u.id}>.`,ephemeral:true}); } }
];
