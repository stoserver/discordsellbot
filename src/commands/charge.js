import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadGuildData, saveGuildData } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('충전')
    .setDescription('사용자에게 포인트를 충전합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option
        .setName('사용자')
        .setDescription('충전할 사용자')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('금액')
        .setDescription('충전할 금액')
        .setRequired(true)
        .setMinValue(1)
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

      const targetUser = interaction.options.getUser('사용자');
      const amount = interaction.options.getInteger('금액');

      if (!guildData.users[targetUser.id]) {
        guildData.users[targetUser.id] = {
          balance: 0,
          charges: [],
          purchases: []
        };
      }

      guildData.users[targetUser.id].balance += amount;
      guildData.users[targetUser.id].charges.unshift({
        amount,
        timestamp: new Date().toISOString(),
        method: 'manual',
        charged_by: interaction.user.id
      });

      // Keep last 50 charges
      if (guildData.users[targetUser.id].charges.length > 50) {
        guildData.users[targetUser.id].charges.splice(50);
      }

      await saveGuildData(guildId, guildData);

      await interaction.reply({
        content: `✅ **충전 완료**\n사용자: ${targetUser}\n충전 금액: ${amount.toLocaleString()}원\n현재 잔액: ${guildData.users[targetUser.id].balance.toLocaleString()}원`,
        ephemeral: true
      });

      // Send DM to user
      try {
        await targetUser.send(
          `✅ **포인트 충전 알림**\n서버: ${guildData.name}\n충전 금액: ${amount.toLocaleString()}원\n현재 잔액: ${guildData.users[targetUser.id].balance.toLocaleString()}원`
        );
      } catch (error) {
        console.log('DM 전송 실패:', error.message);
      }
    } catch (error) {
      console.error('충전 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
