import { SlashCommandBuilder } from 'discord.js';
import { loadGuildData } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('잔액')
    .setDescription('내 포인트 잔액을 확인합니다.'),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      const guildData = await loadGuildData(guildId);
      if (!guildData) {
        return await interaction.reply({
          content: '❌ 서버가 등록되지 않았습니다.',
          ephemeral: true
        });
      }

      const user = guildData.users[userId];
      const balance = user?.balance || 0;

      await interaction.reply({
        content: `💰 **현재 잔액**: ${balance.toLocaleString()}원`,
        ephemeral: true
      });
    } catch (error) {
      console.error('잔액 확인 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
