import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadGuildData } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pushbullet상태')
    .setDescription('Pushbullet 설정 상태를 확인합니다.'),

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

      const embed = new EmbedBuilder()
        .setTitle('📡 Pushbullet 설정 상태')
        .setColor(guildData.pushbullet.api_key ? 0x00ff00 : 0xff0000)
        .setTimestamp();

      if (!guildData.pushbullet.api_key) {
        embed.setDescription('❌ API 키가 설정되지 않았습니다.\n`/pushbullet설정` 명령어로 설정해주세요.');
      } else {
        embed.addFields(
          { name: 'API 키', value: '✅ 설정됨', inline: true },
          { name: '상태', value: '✅ 자동충전 활성화', inline: true }
        );

        if (guildData.pushbullet.charge_pattern) {
          embed.addFields({
            name: '충전 패턴',
            value: `\`${guildData.pushbullet.charge_pattern}\``,
            inline: false
          });
        }

        if (guildData.pushbullet.user_id_pattern) {
          embed.addFields({
            name: '사용자 ID 패턴',
            value: `\`${guildData.pushbullet.user_id_pattern}\``,
            inline: false
          });
        }

        embed.setFooter({ text: 'Android 기기에서 Pushbullet 앱 실행 시 자동충전이 작동합니다.' });
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
