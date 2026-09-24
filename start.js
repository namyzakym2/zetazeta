const { spawn } = require('child_process');
const path = require('path');
const children=[];
function run(file){const p=spawn(process.execPath,[path.join(__dirname,'src',file)],{stdio:'inherit',env:process.env});children.push(p);p.on('exit',(code,signal)=>{if(!process.env.ALLOW_PARTIAL_START||code!==0){for(const c of children)if(c!==p)c.kill('SIGTERM');process.exit(code??1)}})}
run('bot.js');
if(String(process.env.CONTROL_BOT_AUTOSTART||'true').toLowerCase()!=='false')run('controlBot.js');
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{for(const c of children)c.kill(sig)});
