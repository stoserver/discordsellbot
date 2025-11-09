import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadLicenses, saveLicenses, loadGuildData, saveGuildData } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('라이센스등록')
    .setDescription('라이센스를 서버에 등록합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('라이센스코드')
        .setDescription('라이센스 코드')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const licenseCode = interaction.options.getString('라이센스코드').trim();

      // Check if guild is registered
      const guildData = await loadGuildData(guildId);
      if (!guildData) {
        return await interaction.reply({
          content: '❌ 먼저 `/등록` 명령어로 서버를 등록해주세요.',
          ephemeral: true
        });
      }

      // Check if license exists
      const licenses = await loadLicenses();
      const license = licenses[licenseCode];

      if (!license) {
        return await interaction.reply({
          content: '❌ 유효하지 않은 라이센스 코드입니다.',
          ephemeral: true
        });
      }

      // Check if license is already used
      if (license.used) {
        return await interaction.reply({
          content: `❌ 이미 사용된 라이센스입니다.\n사용 서버: ${license.guild_id}\n사용 일시: ${new Date(license.used_at).toLocaleString('ko-KR')}`,
          ephemeral: true
        });
      }

      // Apply license
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + license.duration_days);

      guildData.plan = license.plan;
      guildData.license_code = licenseCode;
      guildData.license_expires_at = expiresAt.toISOString();

      // Mark license as used
      license.used = true;
      license.used_by = interaction.user.id;
      license.used_at = new Date().toISOString();
      license.guild_id = guildId;

      await saveGuildData(guildId, guildData);
      await saveLicenses(licenses);

      await interaction.reply({
        content: `✅ **라이센스 등록 완료**\n\n플랜: ${license.plan.toUpperCase()}\n만료일: ${expiresAt.toLocaleString('ko-KR')}\n\n이제 ${license.plan === 'pro' ? '무제한 카테고리와 상품' : '무제한 카테고리/상품 + 개인봇'}을 사용할 수 있습니다!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('라이센스 등록 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
