import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadGuildData, saveGuildData, createGuildData } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('등록')
    .setDescription('이 서버에서 봇을 사용하도록 등록합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const guildName = interaction.guild.name;

      const existingData = await loadGuildData(guildId);

      if (existingData) {
        return await interaction.reply({
          content: '❌ 이미 등록된 서버입니다. `/플랜확인`으로 현재 플랜을 확인하세요.',
          ephemeral: true
        });
      }

      // Create guild data (free plan by default)
      const guildData = createGuildData(guildId, guildName);
      await saveGuildData(guildId, guildData);

      await interaction.reply({
        content: `✅ **서버 등록 완료**\n\n서버명: ${guildName}\n플랜: FREE (카테고리 1개, 상품 3개)\n\n- Pushbullet API 키를 설정하려면: \`/pushbullet설정\`\n- Pro/Premium 플랜 등록: \`/라이센스등록\`\n- 카테고리 추가: \`/카테고리추가\`\n- 상품 추가: \`/상품추가\``,
        ephemeral: true
      });
    } catch (error) {
      console.error('등록 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
