const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const CustomCommand = require('../../models/CustomCommand');
module.exports = { data: new SlashCommandBuilder().setName('custom-command').setDescription('إدارة الأوامر المخصصة')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(s=>s.setName('set').setDescription('إنشاء أو تعديل أمر').addStringOption(o=>o.setName('name').setDescription('اسم الأمر').setRequired(true)).addStringOption(o=>o.setName('response').setDescription('الرد').setRequired(true)))
  .addSubcommand(s=>s.setName('delete').setDescription('حذف أمر').addStringOption(o=>o.setName('name').setDescription('اسم الأمر').setRequired(true)))
  .addSubcommand(s=>s.setName('list').setDescription('عرض الأوامر المخصصة')),
  async execute(i){ const sub=i.options.getSubcommand(); const name=i.options.getString('name')?.toLowerCase(); if(sub==='set'){const r=i.options.getString('response'); await CustomCommand.findOneAndUpdate({guildId:i.guild.id,name},{guildId:i.guild.id,name,response:r,enabled:true,createdBy:i.user.id},{upsert:true,new:true}); return i.reply({content:`✅ تم حفظ الأمر \`${name}\`. المتغيرات: {user} {userName} {server} {channel}`,ephemeral:true});} if(sub==='delete'){const d=await CustomCommand.findOneAndDelete({guildId:i.guild.id,name}); return i.reply({content:d?`🗑️ تم حذف \`${name}\`.`:'❌ الأمر غير موجود.',ephemeral:true});} const list=await CustomCommand.find({guildId:i.guild.id}).sort({name:1}); return i.reply({content:list.length?list.map(x=>`• \`${x.name}\` — ${x.enabled?'فعال':'متوقف'}`).join('\n'):'لا توجد أوامر مخصصة.',ephemeral:true}); }
};
