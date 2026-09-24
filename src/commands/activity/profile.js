const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const activityService = require('../../services/activityService');
const economyService = require('../../services/economyService');
const { generateProfileCard } = require('../../utils/profileCard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('عرض بطاقة بروفايلك الشخصية / View your personal profile card')
    .addUserOption(opt => 
      opt.setName('user')
        .setDescription('العضو المراد عرض بروفايله / The user whose profile you want to view')
        .setRequired(false)
    ),

  async execute(interaction) {
    // 1. Defer the reply if possible, because canvas generation takes time
    if (!interaction.deferred && typeof interaction.deferReply === 'function') {
      await interaction.deferReply();
    }

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const targetMember = interaction.guild ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;
    
    const guildId = interaction.guild ? interaction.guild.id : 'global';
    
    // 2. Fetch activity stats
    const activity = await activityService.getActivity(guildId, targetUser.id);
    const level = activity?.level || 0;
    const xp = activity?.xp || 0;
    const xpNeeded = activityService.xpForLevel(level);
    
    // 3. Fetch rank
    const rank = await activityService.getRank(guildId, targetUser.id);
    
    // 4. Fetch global economy wallet
    const wallet = await economyService.getOrCreateWallet(targetUser.id);
    const dc = wallet?.balance || 0;
    const backgroundURL = wallet?.profileBackground || '';
    
    // 5. Get avatar & guild icon URLs
    const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
    const guildIconURL = interaction.guild && interaction.guild.icon 
      ? interaction.guild.iconURL({ extension: 'png', size: 256 }) 
      : '';
      
    try {
      // 6. Generate the canvas profile card
      const cardBuffer = await generateProfileCard({
        username: targetUser.username,
        avatarURL,
        guildIconURL,
        level,
        xp,
        xpNeeded,
        dc,
        rank,
        backgroundURL
      });
      
      const attachment = new AttachmentBuilder(cardBuffer, { name: 'profile.png' });
      
      // 7. Send the response
      if (interaction.deferred) {
        await interaction.editReply({ files: [attachment] });
      } else {
        await interaction.reply({ files: [attachment] });
      }
    } catch (err) {
      console.error('Error in profile command:', err);
      const errMsg = '❌ حدث خطأ أثناء إنشاء بطاقة البروفايل.';
      if (interaction.deferred) {
        await interaction.editReply({ content: errMsg });
      } else {
        await interaction.reply({ content: errMsg, ephemeral: true });
      }
    }
  }
};
