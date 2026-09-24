const GuildModel = require('../models/Guild');

/**
 * componentPanels — routes clicks on dashboard-built "Component Panels"
 * (buttons / select menus attached to an embed-style message) to their configured
 * action. customId shape: `panel_btn_<panelId>_<componentId>` for buttons and
 * `panel_sel_<panelId>_<componentId>` for select menus (the chosen option's action
 * is looked up by the selected value, which is the option's _id).
 */

async function runAction(interaction, action) {
  if (!action || !action.type) {
    await interaction.reply({ content: '⚠️ هذا الزر غير مهيأ بشكل صحيح.', ephemeral: true });
    return;
  }

  switch (action.type) {
    case 'giveRole': {
      if (!action.roleId) break;
      const role = interaction.guild.roles.cache.get(action.roleId);
      if (!role) {
        await interaction.reply({ content: '⚠️ الرتبة المرتبطة بهذا الزر ما عادت موجودة.', ephemeral: true });
        return;
      }
      await interaction.member.roles.add(role).catch(() => {});
      await interaction.reply({ content: `✅ تم إعطاؤك رتبة <@&${role.id}>.`, ephemeral: true });
      return;
    }
    case 'removeRole': {
      if (!action.roleId) break;
      const role = interaction.guild.roles.cache.get(action.roleId);
      if (!role) {
        await interaction.reply({ content: '⚠️ الرتبة المرتبطة بهذا الزر ما عادت موجودة.', ephemeral: true });
        return;
      }
      await interaction.member.roles.remove(role).catch(() => {});
      await interaction.reply({ content: `✅ تم إزالة رتبة <@&${role.id}> منك.`, ephemeral: true });
      return;
    }
    case 'toggleRole': {
      if (!action.roleId) break;
      const role = interaction.guild.roles.cache.get(action.roleId);
      if (!role) {
        await interaction.reply({ content: '⚠️ الرتبة المرتبطة بهذا الزر ما عادت موجودة.', ephemeral: true });
        return;
      }
      const has = interaction.member.roles.cache.has(role.id);
      if (has) {
        await interaction.member.roles.remove(role).catch(() => {});
        await interaction.reply({ content: `✅ تم إزالة رتبة <@&${role.id}> منك.`, ephemeral: true });
      } else {
        await interaction.member.roles.add(role).catch(() => {});
        await interaction.reply({ content: `✅ تم إعطاؤك رتبة <@&${role.id}>.`, ephemeral: true });
      }
      return;
    }
    case 'sendMessage':
    default: {
      const text = (action.message || 'تم الضغط ✅')
        .replaceAll('{user}', `<@${interaction.user.id}>`)
        .replaceAll('{username}', interaction.user.username)
        .replaceAll('{server}', interaction.guild.name);
      await interaction.reply({ content: text, ephemeral: true });
      return;
    }
  }

  await interaction.reply({ content: '✅ تم.', ephemeral: true });
}

async function route(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('panel_btn_') && !id.startsWith('panel_sel_')) return false;

  const isSelect = id.startsWith('panel_sel_');
  const rest = id.slice(isSelect ? 'panel_sel_'.length : 'panel_btn_'.length);
  const [panelId, componentId] = rest.split('_');

  const guildDoc = await GuildModel.findOne({ guildId: interaction.guild.id });
  const panel = guildDoc?.componentPanels?.id(panelId);
  const component = panel?.components?.id(componentId);
  if (!component) {
    await interaction.reply({ content: '⚠️ هذا العنصر ما عاد موجود بالإعدادات.', ephemeral: true }).catch(() => {});
    return true;
  }

  if (isSelect) {
    const optionId = interaction.values?.[0];
    const option = component.options?.id(optionId);
    await runAction(interaction, option?.action).catch(async (err) => {
      console.error('[componentPanels] select action failed:', err);
      if (!interaction.replied) await interaction.reply({ content: '❌ صار خطأ أثناء تنفيذ هذا الخيار.', ephemeral: true }).catch(() => {});
    });
  } else {
    await runAction(interaction, component.action).catch(async (err) => {
      console.error('[componentPanels] button action failed:', err);
      if (!interaction.replied) await interaction.reply({ content: '❌ صار خطأ أثناء تنفيذ هذا الزر.', ephemeral: true }).catch(() => {});
    });
  }

  return true;
}

module.exports = { route };
