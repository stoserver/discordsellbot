import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { loadGuildData, saveGuildData, canAddProduct } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('상품추가')
    .setDescription('새로운 상품을 추가합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('id')
        .setDescription('상품 ID (영문, 숫자, 하이픈만 가능)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('이름')
        .setDescription('상품 이름')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('가격')
        .setDescription('상품 가격')
        .setRequired(true)
        .setMinValue(0)
    )
    .addStringOption(option =>
      option
        .setName('카테고리')
        .setDescription('카테고리 ID')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('재고')
        .setDescription('초기 재고')
        .setRequired(false)
        .setMinValue(0)
    )
    .addStringOption(option =>
      option
        .setName('설명')
        .setDescription('상품 설명')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const productId = interaction.options.getString('id');
      const name = interaction.options.getString('이름');
      const price = interaction.options.getInteger('가격');
      const categoryId = interaction.options.getString('카테고리');
      const stock = interaction.options.getInteger('재고') ?? -1; // -1 means unlimited
      const description = interaction.options.getString('설명') || '';

      // Validate product ID
      if (!/^[a-zA-Z0-9-]+$/.test(productId)) {
        return await interaction.reply({
          content: '❌ 상품 ID는 영문, 숫자, 하이픈(-)만 사용할 수 있습니다.',
          ephemeral: true
        });
      }

      const guildData = await loadGuildData(guildId);
      if (!guildData) {
        return await interaction.reply({
          content: '❌ 먼저 `/등록` 명령어로 서버를 등록해주세요.',
          ephemeral: true
        });
      }

      // Check if category exists
      if (!guildData.categories[categoryId]) {
        return await interaction.reply({
          content: '❌ 존재하지 않는 카테고리입니다. `/카테고리추가` 명령어로 먼저 카테고리를 생성하세요.',
          ephemeral: true
        });
      }

      // Check if product already exists
      if (guildData.products[productId]) {
        return await interaction.reply({
          content: '❌ 이미 존재하는 상품 ID입니다.',
          ephemeral: true
        });
      }

      // Check plan limits
      if (!canAddProduct(guildData)) {
        return await interaction.reply({
          content: `❌ 현재 플랜(${guildData.plan.toUpperCase()})에서는 더 이상 상품을 추가할 수 없습니다.\nPro 또는 Premium 플랜으로 업그레이드하세요.`,
          ephemeral: true
        });
      }

      // Add product
      guildData.products[productId] = {
        name,
        price,
        category: categoryId,
        stock,
        description,
        created_at: new Date().toISOString()
      };

      await saveGuildData(guildId, guildData);

      await interaction.reply({
        content: `✅ **상품 추가 완료**\n\nID: \`${productId}\`\n이름: ${name}\n가격: ${price.toLocaleString()}원\n카테고리: ${guildData.categories[categoryId].name}\n재고: ${stock === -1 ? '무제한' : stock}\n설명: ${description || '없음'}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('상품 추가 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
