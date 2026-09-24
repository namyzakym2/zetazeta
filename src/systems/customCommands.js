const CustomCommand = require('../models/CustomCommand');

function render(text, message) {
  return String(text || '')
    .replaceAll('{user}', `<@${message.author.id}>`)
    .replaceAll('{userName}', message.author.username)
    .replaceAll('{server}', message.guild.name)
    .replaceAll('{channel}', `<#${message.channel.id}>`);
}

async function handleMessage(message) {
  const prefix = (await require('../models/Guild').findOne({ guildId: message.guild.id }))?.prefix || process.env.DEFAULT_PREFIX || '!';
  if (!message.content.startsWith(prefix)) return false;
  const [name] = message.content.slice(prefix.length).trim().split(/\s+/);
  if (!name) return false;
  const cmd = await CustomCommand.findOne({ guildId: message.guild.id, name: name.toLowerCase(), enabled: true });
  if (!cmd) return false;
  await message.channel.send({ content: render(cmd.response, message), allowedMentions: { parse: ['users', 'roles'] } });
  return true;
}
module.exports = { render, handleMessage };
