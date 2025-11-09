import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadGuildData, saveGuildData } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pushbullet설정')
    .setDescription('Pushbullet API 키를 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('api_key')
        .setDescription('Pushbullet API 키')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const guildData = await loadGuildData(guildId);

      if (!guildData) {
        return await interaction.reply({
          content: '❌ 이 서버는 등록되지 않았습니다. `/등록` 명령어를 먼저 사용해주세요.',
          ephemeral: true
        });
      }

      const apiKey = interaction.options.getString('api_key');

      guildData.pushbullet.api_key = apiKey;

      await saveGuildData(guildId, guildData);

      await interaction.reply({
        content: '✅ **Pushbullet API 키가 설정되었습니다.**\n\nAndroid 기기에서 Pushbullet 앱을 설치하고 동일한 계정으로 로그인하면 자동충전이 작동합니다.\n\n패턴 커스터마이징: `/pushbullet패턴`\n연결 상태 확인: `/pushbullet상태`',
        ephemeral: true
      });
    } catch (error) {
      console.error('Pushbullet 설정 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
