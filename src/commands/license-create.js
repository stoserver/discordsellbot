import { SlashCommandBuilder } from 'discord.js';
import { loadConfig, loadLicenses, saveLicenses } from '../utils/data.js';
import crypto from 'crypto';

export default {
  data: new SlashCommandBuilder()
    .setName('라이센스생성')
    .setDescription('라이센스 코드를 생성합니다. (관리자 전용)')
    .addStringOption(option =>
      option
        .setName('플랜')
        .setDescription('플랜 종류')
        .setRequired(true)
        .addChoices(
          { name: 'Pro', value: 'pro' },
          { name: 'Premium', value: 'premium' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('기간')
        .setDescription('라이센스 기간 (일)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(3650)
    ),

  async execute(interaction) {
    try {
      // Check if user is license admin
      const config = await loadConfig();
      const licenseAdmins = config.license_admins || [];

      if (!licenseAdmins.includes(interaction.user.id)) {
        return await interaction.reply({
          content: '❌ 라이센스 생성 권한이 없습니다.',
          ephemeral: true
        });
      }

      const plan = interaction.options.getString('플랜');
      const durationDays = interaction.options.getInteger('기간');

      // Generate license code
      const code = `LICENSE-${plan.toUpperCase()}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

      const licenses = await loadLicenses();

      licenses[code] = {
        code,
        plan,
        created_at: new Date().toISOString(),
        created_by: interaction.user.id,
        duration_days: durationDays,
        used: false,
        used_by: null,
        used_at: null,
        guild_id: null
      };

      await saveLicenses(licenses);

      await interaction.reply({
        content: `✅ **라이센스 생성 완료**\n\n코드: \`${code}\`\n플랜: ${plan.toUpperCase()}\n기간: ${durationDays}일`,
        ephemeral: true
      });
    } catch (error) {
      console.error('라이센스 생성 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
