require('dotenv').config();
const {Client,GatewayIntentBits,Collection}=require('discord.js');
const path=require('path'),fs=require('fs'),db=require('./db/mysqlCompat');
const client=new Client({intents:[GatewayIntentBits.Guilds]});client.commands=new Collection();
for(const f of fs.readdirSync(path.join(__dirname,'controlCommands')).filter(x=>x.endsWith('.js'))){for(const c of [].concat(require(path.join(__dirname,'controlCommands',f))))client.commands.set(c.data.name,c)}
client.once('ready',()=>console.log(`🎛️ Control Bot online: ${client.user.tag}`));
client.on('interactionCreate',async i=>{if(!i.isChatInputCommand())return;const c=client.commands.get(i.commandName);if(!c)return;try{await c.execute(i)}catch(e){console.error(e);const p={content:'❌ حدث خطأ.',ephemeral:true};if(i.replied||i.deferred)i.followUp(p).catch(()=>{});else i.reply(p).catch(()=>{})}});
(async()=>{
  if(!process.env.CONTROL_BOT_TOKEN) {
    console.warn('⚠️ [AI Studio] CONTROL_BOT_TOKEN not provided — control bot disabled.');
    return;
  }
  if(!process.env.OWNER_ID) {
    console.warn('⚠️ [AI Studio] OWNER_ID missing — control bot disabled.');
    return;
  }
  await db.connect();
  await client.login(process.env.CONTROL_BOT_TOKEN);
})().catch(e=>{console.error('Control bot failed:',e);});
