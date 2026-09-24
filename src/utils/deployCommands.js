const fs = require('fs');
const path = require('path');

/**
 * Discord is strict about application-command option order: required options
 * must come before optional options, including inside subcommands.
 *
 * This file also treats src/commands as the source of truth:
 * - commands missing from the host files are removed from the global registry
 *   by application.commands.set(...)
 * - stale guild-local commands that are not in the host files are deleted too
 * - a malformed local command is skipped, so it cannot break deployment of all
 *   the other commands; if it was already registered, the next sync removes it.
 */

function getCommandFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getCommandFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files.sort();
}

function normalizeOptionOrder(options) {
  if (!Array.isArray(options)) return options;

  // Discord requires required options to precede optional options. Normalize the
  // generated JSON instead of dropping the entire command because a source file
  // happened to declare an optional option first. Subcommands/groups themselves
  // keep their original order.
  const normalized = [...options];
  const plainOptions = normalized.filter((option) => option && option.type !== 1 && option.type !== 2);
  const subOptions = normalized.filter((option) => option && (option.type === 1 || option.type === 2));

  for (const option of normalized) {
    if (Array.isArray(option?.options)) option.options = normalizeOptionOrder(option.options);
  }

  if (plainOptions.length === normalized.length) {
    return normalized
      .map((option, index) => ({ option, index }))
      .sort((a, b) => Number(b.option.required === true) - Number(a.option.required === true) || a.index - b.index)
      .map(({ option }) => option);
  }

  return normalized;
}

function validateOptionList(options, context) {
  if (!Array.isArray(options)) return [];

  const errors = [];
  let optionalSeen = false;
  const names = new Set();

  for (let i = 0; i < options.length; i += 1) {
    const option = options[i];
    const optionPath = `${context}.options[${i}]`;

    if (!option || typeof option !== 'object') {
      errors.push(`${optionPath} must be an object`);
      continue;
    }

    if (option.name) {
      if (names.has(option.name)) {
        errors.push(`${optionPath} has duplicate option name '${option.name}'`);
      }
      names.add(option.name);
    }

    // 1 = SUB_COMMAND, 2 = SUB_COMMAND_GROUP. These contain another option list.
    const isSubcommandOrGroup = option.type === 1 || option.type === 2;

    if (!isSubcommandOrGroup) {
      if (option.required === true) {
        if (optionalSeen) {
          errors.push(
            `${optionPath} required option '${option.name || '?'}' is after a non-required option`
          );
        }
      } else {
        optionalSeen = true;
      }
    }

    if (Array.isArray(option.options)) {
      errors.push(...validateOptionList(option.options, `${optionPath}.${option.name || 'nested'}`));
    }
  }

  return errors;
}

function validateCommandData(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return ['command payload is empty'];
  if (!data.name) errors.push('missing command name');
  if (data.name && !/^[-_a-z0-9]{1,32}$/.test(data.name)) {
    errors.push(`invalid command name '${data.name}'`);
  }
  if (!data.description && data.type === 1) errors.push('missing command description');
  errors.push(...validateOptionList(data.options || [], `/${data.name || '?'}`));
  return errors;
}

/**
 * Reads every command file and returns valid Discord JSON plus a report of
 * anything that should not be deployed.
 */
function inspectCommands() {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commands = [];
  const skipped = [];
  const seenNames = new Map();

  for (const filePath of getCommandFiles(commandsPath)) {
    const relative = path.relative(commandsPath, filePath).replace(/\\/g, '/');

    try {
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);
      if (!command?.data?.toJSON) {
        skipped.push({ file: relative, reason: 'missing data.toJSON()' });
        continue;
      }

      const data = command.data.toJSON();
      normalizeOptionOrder(data.options);
      const errors = validateCommandData(data);
      if (errors.length) {
        skipped.push({ file: relative, name: data?.name || null, reason: errors.join('; ') });
        continue;
      }

      if (seenNames.has(data.name)) {
        skipped.push({
          file: relative,
          name: data.name,
          reason: `duplicate command name; already provided by ${seenNames.get(data.name)}`
        });
        continue;
      }

      seenNames.set(data.name, relative);
      commands.push(data);
    } catch (err) {
      skipped.push({
        file: relative,
        name: null,
        reason: `failed to load command: ${err?.message || err}`
      });
    }
  }

  return { commands, skipped };
}

function buildCommandsData() {
  return inspectCommands().commands;
}

/**
 * Remove guild-local commands that are not present in the host files. This is
 * intentionally deletion-only for guilds: valid commands are supplied by the
 * global registry and are not duplicated just because they are missing locally.
 */
async function removeStaleGuildCommands(client, validNames) {
  const removed = [];

  for (const guild of client.guilds.cache.values()) {
    try {
      const guildCommands = await guild.commands.fetch();
      for (const command of guildCommands.values()) {
        if (!validNames.has(command.name)) {
          try {
            await command.delete();
            removed.push({ guildId: guild.id, guildName: guild.name, name: command.name });
          } catch (err) {
            console.error(
              `⚠️ Could not delete stale guild command /${command.name} in ${guild.name}:`,
              err?.message || err
            );
          }
        }
      }
    } catch (err) {
      console.error(`⚠️ Could not inspect guild commands in ${guild.name}:`, err?.message || err);
    }
  }

  return removed;
}

/**
 * Deploys global slash commands using an already-logged-in client.
 * application.commands.set() is the authoritative sync: commands not present
 * in the local host files are removed from the global command registry.
 */
async function deployGlobalCommands(client) {
  const report = inspectCommands();

  if (report.skipped.length) {
    console.warn(`⚠️ ${report.skipped.length} command file(s) could not be loaded/validated. LIVE commands were NOT replaced.`);
    for (const item of report.skipped) {
      console.warn(`   - ${item.file}${item.name ? ` (/${item.name})` : ''}: ${item.reason}`);
    }

    return {
      data: null,
      skipped: report.skipped,
      removedGuildCommands: [],
      aborted: true
    };
  }

  // Only perform the authoritative sync when every command source file loaded
  // successfully. A partial/empty load must never delete commands that are
  // already registered on Discord.
  const data = await client.application.commands.set(report.commands);
  const validNames = new Set(report.commands.map((command) => command.name));
  const removedGuildCommands = await removeStaleGuildCommands(client, validNames);

  return {
    data,
    skipped: [],
    removedGuildCommands,
    aborted: false
  };
}

module.exports = {
  buildCommandsData,
  inspectCommands,
  deployGlobalCommands,
  removeStaleGuildCommands
};
