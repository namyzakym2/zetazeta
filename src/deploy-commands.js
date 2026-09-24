require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { inspectCommands } = require('./utils/deployCommands');

// NOTE: the bot now also deploys commands automatically on every boot (see
// src/events/ready.js) and via the in-bot /update-commands command, so running
// this script manually is only needed for CI/manual deploys without starting the bot.
const { commands, skipped } = inspectCommands();

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.CLIENT_ID) throw new Error('Missing CLIENT_ID in .env');

    console.log(`🚀 Deploying ${commands.length} valid slash commands...`);
    if (skipped.length) {
      console.warn(`⚠️ Skipping ${skipped.length} invalid/unloadable command file(s):`);
      for (const item of skipped) console.warn(`   - ${item.file}${item.name ? ` (/${item.name})` : ''}: ${item.reason}`);
    }

    // Global deploy (can take up to 1 hour to propagate). For instant testing during
    // development, deploy to a single guild instead using:
    // Routes.applicationGuildCommands(process.env.CLIENT_ID, 'YOUR_GUILD_ID')
    const data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log(`✅ Successfully deployed ${data.length} valid commands.`);
    if (skipped.length) console.log(`🧹 Any previously registered commands matching skipped/missing files are removed by the authoritative sync.`);
  } catch (err) {
    console.error(err);
  }
})();
