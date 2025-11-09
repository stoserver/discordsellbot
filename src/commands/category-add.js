import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadGuildData, saveGuildData, canAddCategory } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('카테고리추가')
    .setDescription('새로운 카테고리를 추가합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('id')
        .setDescription('카테고리 ID (영문, 숫자, 하이픈만 가능)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('이름')
        .setDescription('카테고리 이름')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('설명')
        .setDescription('카테고리 설명')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const categoryId = interaction.options.getString('id');
      const name = interaction.options.getString('이름');
      const description = interaction.options.getString('설명') || '';

      // Validate category ID
      if (!/^[a-zA-Z0-9-]+$/.test(categoryId)) {
        return await interaction.reply({
          content: '❌ 카테고리 ID는 영문, 숫자, 하이픈(-)만 사용할 수 있습니다.',
          ephemeral: true
        });
      }

      const guildData = await loadGuildData(guildId);
      if (!guildData) {
        return await interaction.reply({
          content: '❌ 먼저 `/등록` 명령어로 서버를 등록해주세요.',
          ephemeral: true
        });
      }

      // Check if category already exists
      if (guildData.categories[categoryId]) {
        return await interaction.reply({
          content: '❌ 이미 존재하는 카테고리 ID입니다.',
          ephemeral: true
        });
      }

      // Check plan limits
      if (!canAddCategory(guildData)) {
        return await interaction.reply({
          content: `❌ 현재 플랜(${guildData.plan.toUpperCase()})에서는 더 이상 카테고리를 추가할 수 없습니다.\nPro 또는 Premium 플랜으로 업그레이드하세요.`,
          ephemeral: true
        });
      }

      // Add category
      guildData.categories[categoryId] = {
        name,
        description,
        created_at: new Date().toISOString()
      };

      await saveGuildData(guildId, guildData);

      await interaction.reply({
        content: `✅ **카테고리 추가 완료**\n\nID: \`${categoryId}\`\n이름: ${name}\n설명: ${description || '없음'}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('카테고리 추가 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
