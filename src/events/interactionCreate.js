const GuildModel = require('../models/Guild');
const ticketSystem = require('../systems/tickets');
const suggestionSystem = require('../systems/suggestions');
const reportSystem = require('../systems/reports');
const giveawaySystem = require('../systems/giveaways');
// تم إيقاف استدعاء sellerRoomSystem لأن زر التواصل أصبح رابط بروفايل مباشر
// const sellerRoomSystem = require('../systems/sellerRoom');
const componentPanelsSystem = require('../systems/componentPanels');
const rankShopSystem = require('../systems/rankShop');
const applicationSystem = require('../systems/applications');
const { sanitizeHexColor } = require('../utils/emoji');
const commandPermissionService = require('../services/commandPermissionService');
const commandStateService = require('../services/commandStateService');
const CommandUsage = require('../models/CommandUsage');
const reactionRoles = require('../systems/reactionRoles');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // Autocomplete
      if (interaction.isAutocomplete()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(interaction);
        return;
      }

      // Slash commands
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        if (interaction.guild) {
          // MySQL-backed deployments need a Guild document before commands/services
          // read nested settings (tickets, permissions, command states, etc.).
          // Mongo used to create some of these records elsewhere; ensure it here
          // so every command has a consistent guild document.
          await GuildModel.findOne({ guildId: interaction.guild.id }) ||
            await GuildModel.create({ guildId: interaction.guild.id });

          const enabled = await commandStateService.isEnabled(interaction.guild.id, interaction.commandName);
          if (!enabled) {
            return interaction.reply({ content: 'هذا الأمر متوقف من لوحة تحكم ZETA لهذا السيرفر.', ephemeral: true });
          }

          const allowed = await commandPermissionService.isCommandAllowed(
            interaction.guild.id,
            interaction.commandName,
            interaction.member
          );
          if (!allowed) {
            return interaction.reply({ content: '❌ رتبتك ممنوعة من استخدام هذا الأمر في هذا السيرفر.', ephemeral: true });
          }
        }

        // Feeds the dashboard's commands counter, usage chart and most-used list.
        if (interaction.guild) CommandUsage.record(interaction.guild.id, interaction.commandName);

        await command.execute(interaction);
        return;
      }

      // Buttons
      if (interaction.isButton()) {
        if (interaction.customId.startsWith('rr_')) {
          await reactionRoles.handleButton(interaction);
          return;
        }
        if (interaction.customId.startsWith('ticket_')) {
          await ticketSystem.route(interaction);
          return;
        }
        if (interaction.customId.startsWith('sug_')) {
          await suggestionSystem.handleButton(interaction);
          return;
        }
        if (interaction.customId.startsWith('report_')) {
          await reportSystem.handleButton(interaction);
          return;
        }
        if (interaction.customId.startsWith('giveaway_')) {
          await giveawaySystem.handleButton(interaction);
          return;
        }
        /* 
           تم إيقاف معالجة sellerroom_ هنا لأن زر التواصل الجديد أصبحت نوعيته (ButtonStyle.Link) 
           ويتوجه لبروفايل البائع فوراً دون الحاجة لمعالجة Interaction.
        */
        // if (interaction.customId.startsWith('sellerroom_')) {
        //   await sellerRoomSystem.handleButton(interaction);
        //   return;
        // }
        if (interaction.customId.startsWith('panel_btn_')) {
          await componentPanelsSystem.route(interaction);
          return;
        }
        if (interaction.customId.startsWith('rankshop_')) {
          await rankShopSystem.route(interaction);
          return;
        }
        if (interaction.customId.startsWith('application_')) {
          await applicationSystem.route(interaction);
          return;
        }
      }

      // Select menus
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('panel_sel_')) {
          await componentPanelsSystem.route(interaction);
          return;
        }
        if (interaction.customId.startsWith('ticket_actions_menu_')) {
          await ticketSystem.route(interaction);
          return;
        }
        if (interaction.customId.startsWith('ticket_open_menu_')) {
          await ticketSystem.route(interaction);
          return;
        }
        if (interaction.customId.startsWith('ticket_rate_')) {
          await ticketSystem.route(interaction);
          return;
        }
        if (interaction.customId === 'rankshop_buy_select') {
          await rankShopSystem.route(interaction);
          return;
        }
      }

      // Modals
      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('ticket_modal_') || interaction.customId.startsWith('ticket_rate_modal_')) {
          await ticketSystem.route(interaction);
          return;
        }
        if (interaction.customId.startsWith('application_')) {
          await applicationSystem.route(interaction);
          return;
        }
        if (interaction.customId.startsWith('sug_modal_')) {
          await suggestionSystem.handleButton(interaction);
          return;
        }
        if (interaction.customId === 'setup_ticket_modal') {
          const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id }) || await GuildModel.create({ guildId: interaction.guild.id });

          guildDoc.ticketSettings.panelTitle = interaction.fields.getTextInputValue('panelTitle');
          guildDoc.ticketSettings.panelDescription = interaction.fields.getTextInputValue('panelDescription');
          const color = interaction.fields.getTextInputValue('panelColor');
          
          if (color) guildDoc.ticketSettings.panelColor = sanitizeHexColor(color, guildDoc.ticketSettings.panelColor);
          guildDoc.ticketSettings.panelFooter = interaction.fields.getTextInputValue('panelFooter') || guildDoc.ticketSettings.panelFooter;
          const image = interaction.fields.getTextInputValue('panelImage');
          if (image) guildDoc.ticketSettings.panelImage = image;

          if (!guildDoc.ticketSettings.buttons.length) {
            guildDoc.ticketSettings.buttons.push({ label: 'Support', emoji: 'ticket', style: 'Danger' });
          }

          await guildDoc.save();

          await interaction.reply({
            content: '✅ تم حفظ إعدادات لوحة التذاكر. استخدم /ticket-panel لإرسالها، أو عدّل الأزرار/التصنيفات من Admin Dashboard.',
            ephemeral: true
          });
          return;
        }
      }
    } catch (err) {
      console.error('Interaction error:', err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر.', ephemeral: true }).catch(() => {});
      }
    }
  }
};