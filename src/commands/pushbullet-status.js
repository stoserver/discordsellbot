import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadConfig, loadGuilds } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pushbullet상태')
    .setDescription('Pushbullet 연결 상태를 확인합니다.'),

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

      const config = await loadConfig();
      const pushbulletService = interaction.client.pushbulletService;

      const embed = new EmbedBuilder()
        .setTitle('📡 Pushbullet 상태')
        .setColor(pushbulletService?.connected ? 0x00ff00 : 0xff0000)
        .setTimestamp();

      if (!config.pushbullet?.api_key) {
        embed.setDescription('❌ API 키가 설정되지 않았습니다.\n`/pushbullet설정` 명령어로 설정해주세요.');
      } else {
        const status = pushbulletService?.getStatus();
        const connected = status?.connected || false;

        embed.addFields(
          { name: '연결 상태', value: connected ? '✅ 연결됨' : '❌ 연결 안됨', inline: true },
          { name: 'API 키', value: '✅ 설정됨', inline: true },
          { name: '재연결 시도', value: `${status?.reconnectAttempts || 0}회`, inline: true }
        );

        if (config.pushbullet.charge_pattern) {
          embed.addFields({
            name: '충전 패턴',
            value: `\`${config.pushbullet.charge_pattern}\``,
            inline: false
          });
        }

        if (config.pushbullet.user_id_pattern) {
          embed.addFields({
            name: '사용자 ID 패턴',
            value: `\`${config.pushbullet.user_id_pattern}\``,
            inline: false
          });
        }
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('상태 확인 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
