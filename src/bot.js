require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('./db/mysqlCompat');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { patchSendMethods } = require('./utils/zetaEmojis');

// Safety net: without these, ANY unhandled promise rejection (e.g. a database error
// that slips past a try/catch somewhere) crashes the entire Node process on modern
// Node versions — which is exactly what made the bot look "offline" after a single
// failed database write. Log it and keep the bot running instead.
process.on('unhandledRejection', (err) => {
  console.error('🔥 Unhandled promise rejection (bot stayed online):', err);
});
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught exception (bot stayed online):', err);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildExpressions, // needed for emoji/sticker management
    GatewayIntentBits.GuildWebhooks, // ZETA Shield anti-nuke: webhook flood detection
    GatewayIntentBits.GuildInvites // needed by Auto Rules (src/systems/autoRoleRules.js) for invite-based role assignment
  ],
  partials: [Partials.Channel, Partials.Message],
  // Bot-Hosting/proxy routes can occasionally take longer than discord.js'
  // default 10s connection timeout. Give REST requests a little more room.
  rest: { timeout: 30000, retries: 3 }
});

client.commands = new Collection();
patchSendMethods(require('discord.js'));

// Load commands from src/commands, supporting both root-level command files
// (e.g. src/commands/botprofile.js) and category subfolders.
const commandsPath = path.join(__dirname, 'commands');
function getCommandFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getCommandFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

for (const filePath of getCommandFiles(commandsPath)) {
  const command = require(filePath);
  if (command?.data?.name) {
    client.commands.set(command.data.name, command);
  }
}

// Load events from src/events
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

/**
 * Reconciles every registered Mongoose model's indexes with its current schema —
 * this automatically DROPS stale/legacy indexes (e.g. an old single-field unique
 * index left over from a previous schema version) and creates any missing ones.
 * This is what fixes "E11000 duplicate key error ... index: userId_1" permanently,
 * without needing to manually run mongosh commands after every deploy.
 */
async function syncAllIndexes() {
  for (const modelName of mongoose.modelNames()) {
    try {
      await mongoose.model(modelName).syncIndexes();
    } catch (err) {
      console.error(`⚠️ Index sync failed for model "${modelName}":`, err.message);
    }
  }
  console.log('✅ Database indexes synced with current schemas.');
}

async function start() {
  if (!process.env.DISCORD_TOKEN) {
    console.error('❌ Missing DISCORD_TOKEN in .env');
    process.exit(1);
  }
  if (!process.env.MYSQL_URL && !(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE)) {
    console.error('❌ Missing MySQL configuration in .env (MYSQL_URL or MYSQL_HOST/MYSQL_USER/MYSQL_DATABASE)');
    process.exit(1);
  }

  await mongoose.connect();
  console.log('🗄️  MySQL connected');

  await syncAllIndexes();

  await client.login(process.env.DISCORD_TOKEN);

  // One entry point for Bot-Hosting: `node src/bot.js` starts BOTH the Discord bot
  // and the web dashboard in the same Node process. The dashboard reuses the
  // already-open MongoDB connection and the logged-in Discord client.
  try {
    const dashboard = require('../dashboard/server');
    await dashboard.start({ embedded: true, discordClient: client });
  } catch (err) {
    // Never take the bot offline because the dashboard has a configuration/runtime issue.
    console.error('⚠️ Dashboard failed to start automatically:', err.message);
  }
}

start().catch((err) => {
  console.error('Failed to start ZETA:', err);
  process.exit(1);
});
