import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { loadGuildData, getPlanLimits } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('플랜확인')
    .setDescription('현재 서버의 플랜 정보를 확인합니다.'),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const guildData = await loadGuildData(guildId);

      if (!guildData) {
        return await interaction.reply({
          content: '❌ 먼저 `/등록` 명령어로 서버를 등록해주세요.',
          ephemeral: true
        });
      }

      const limits = getPlanLimits(guildData.plan);
      const currentCategories = Object.keys(guildData.categories || {}).length;
      const currentProducts = Object.keys(guildData.products || {}).length;

      const embed = new EmbedBuilder()
        .setTitle('📊 서버 플랜 정보')
        .setColor(guildData.plan === 'free' ? 0x808080 : guildData.plan === 'pro' ? 0x0099ff : 0xffd700)
        .addFields(
          { name: '현재 플랜', value: guildData.plan.toUpperCase(), inline: true },
          { name: '등록일', value: new Date(guildData.registered_at).toLocaleDateString('ko-KR'), inline: true }
        );

      if (guildData.plan !== 'free' && guildData.license_expires_at) {
        const expiresAt = new Date(guildData.license_expires_at);
        const now = new Date();
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

        embed.addFields(
          { name: '만료일', value: expiresAt.toLocaleDateString('ko-KR'), inline: true },
          { name: '남은 기간', value: `${daysLeft}일`, inline: true }
        );
      }

      embed.addFields(
        {
          name: '카테고리',
          value: limits.maxCategories === Infinity
            ? `${currentCategories}개 (무제한)`
            : `${currentCategories}/${limits.maxCategories}개`,
          inline: true
        },
        {
          name: '상품',
          value: limits.maxProducts === Infinity
            ? `${currentProducts}개 (무제한)`
            : `${currentProducts}/${limits.maxProducts}개`,
          inline: true
        },
        {
          name: '개인봇 사용',
          value: limits.canUseSelfBot ? '✅ 가능' : '❌ 불가능',
          inline: true
        }
      );

      if (guildData.plan === 'free') {
        embed.setFooter({ text: '더 많은 기능을 사용하려면 Pro 또는 Premium 플랜으로 업그레이드하세요!' });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('플랜 확인 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
