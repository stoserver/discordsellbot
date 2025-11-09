import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadConfig, saveConfig, loadGuilds } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pushbullet패턴')
    .setDescription('Pushbullet 알림 파싱 패턴을 설정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('충전패턴')
        .setDescription('충전 금액 추출 정규식 (예: 충전\\s*(\\d+)원?)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('사용자id패턴')
        .setDescription('사용자 ID 추출 정규식 (예: 사용자\\s*ID[:\\s]*(\\d+))')
        .setRequired(false)
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

      const chargePattern = interaction.options.getString('충전패턴');
      const userIdPattern = interaction.options.getString('사용자id패턴');

      if (!chargePattern && !userIdPattern) {
        return await interaction.reply({
          content: '❌ 최소 하나의 패턴을 입력해주세요.',
          ephemeral: true
        });
      }

      const config = await loadConfig();

      if (!config.pushbullet) {
        config.pushbullet = {};
      }

      let updated = [];

      if (chargePattern) {
        // Validate regex
        try {
          new RegExp(chargePattern);
          config.pushbullet.charge_pattern = chargePattern;
          updated.push(`충전 패턴: \`${chargePattern}\``);
        } catch (error) {
          return await interaction.reply({
            content: `❌ 충전 패턴이 올바른 정규식이 아닙니다: ${error.message}`,
            ephemeral: true
          });
        }
      }

      if (userIdPattern) {
        // Validate regex
        try {
          new RegExp(userIdPattern);
          config.pushbullet.user_id_pattern = userIdPattern;
          updated.push(`사용자 ID 패턴: \`${userIdPattern}\``);
        } catch (error) {
          return await interaction.reply({
            content: `❌ 사용자 ID 패턴이 올바른 정규식이 아닙니다: ${error.message}`,
            ephemeral: true
          });
        }
      }

      await saveConfig(config);

      await interaction.reply({
        content: `✅ **패턴이 업데이트되었습니다.**\n\n${updated.join('\n')}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('패턴 설정 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
