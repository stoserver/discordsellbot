import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadGuilds, saveGuilds } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('등록')
    .setDescription('이 서버에서 봇을 사용하도록 등록합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const guildName = interaction.guild.name;

      const guilds = await loadGuilds();

      if (guilds[guildId]) {
        return await interaction.reply({
          content: '❌ 이미 등록된 서버입니다.',
          ephemeral: true
        });
      }

      // Register guild
      guilds[guildId] = {
        name: guildName,
        registered_at: new Date().toISOString(),
        enabled: true
      };

      await saveGuilds(guilds);

      // Start Pushbullet service
      const pushbulletService = interaction.client.pushbulletService;
      if (pushbulletService && !pushbulletService.connected) {
        try {
          await pushbulletService.start();
          await interaction.reply({
            content: `✅ **서버 등록 완료**\n서버명: ${guildName}\nPushbullet 자동충전이 활성화되었습니다.`,
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({
            content: `✅ **서버 등록 완료**\n서버명: ${guildName}\n\n⚠️ Pushbullet 연결 실패: ${error.message}\n\`/pushbullet설정\` 명령어로 API 키를 설정해주세요.`,
            ephemeral: true
          });
        }
      } else {
        await interaction.reply({
          content: `✅ **서버 등록 완료**\n서버명: ${guildName}\nPushbullet 자동충전이 활성화되었습니다.`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('등록 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
