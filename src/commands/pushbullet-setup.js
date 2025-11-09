import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadConfig, saveConfig, loadGuilds } from '../utils/data.js';

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
      // Check if guild is registered
      const guildId = interaction.guild.id;
      const guilds = await loadGuilds();

      if (!guilds[guildId] || !guilds[guildId].enabled) {
        return await interaction.reply({
          content: '❌ 이 서버는 등록되지 않았습니다. `/등록` 명령어를 먼저 사용해주세요.',
          ephemeral: true
        });
      }

      const apiKey = interaction.options.getString('api_key');

      const config = await loadConfig();

      if (!config.pushbullet) {
        config.pushbullet = {};
      }

      config.pushbullet.api_key = apiKey;
      config.pushbullet.charge_pattern = config.pushbullet.charge_pattern || '충전\\s*(\\d+)원?';
      config.pushbullet.user_id_pattern = config.pushbullet.user_id_pattern || '사용자\\s*ID[:\\s]*(\\d+)';

      await saveConfig(config);

      // Restart Pushbullet service
      const pushbulletService = interaction.client.pushbulletService;
      if (pushbulletService) {
        try {
          if (pushbulletService.connected) {
            pushbulletService.stop();
          }
          await pushbulletService.start();

          await interaction.reply({
            content: '✅ **Pushbullet API 키가 설정되었습니다.**\n자동충전이 활성화되었습니다.',
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({
            content: `⚠️ API 키는 저장되었지만 연결에 실패했습니다.\n오류: ${error.message}`,
            ephemeral: true
          });
        }
      } else {
        await interaction.reply({
          content: '✅ Pushbullet API 키가 저장되었습니다.\n봇을 재시작하면 자동충전이 활성화됩니다.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Pushbullet 설정 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
