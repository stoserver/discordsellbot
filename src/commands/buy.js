import { SlashCommandBuilder } from 'discord.js';
import { loadGuildData, saveGuildData } from '../utils/data.js';

export default {
  data: new SlashCommandBuilder()
    .setName('구매')
    .setDescription('상품을 구매합니다.')
    .addStringOption(option =>
      option
        .setName('상품id')
        .setDescription('구매할 상품 ID')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('수량')
        .setDescription('구매 수량')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;
      const productId = interaction.options.getString('상품id');
      const quantity = interaction.options.getInteger('수량') ?? 1;

      const guildData = await loadGuildData(guildId);
      if (!guildData) {
        return await interaction.reply({
          content: '❌ 서버가 등록되지 않았습니다.',
          ephemeral: true
        });
      }

      // Check if product exists
      const product = guildData.products[productId];
      if (!product) {
        return await interaction.reply({
          content: '❌ 존재하지 않는 상품입니다.',
          ephemeral: true
        });
      }

      // Check stock
      if (product.stock !== -1 && product.stock < quantity) {
        return await interaction.reply({
          content: `❌ 재고가 부족합니다. (현재 재고: ${product.stock})`,
          ephemeral: true
        });
      }

      // Initialize user if not exists
      if (!guildData.users[userId]) {
        guildData.users[userId] = {
          balance: 0,
          charges: [],
          purchases: []
        };
      }

      const user = guildData.users[userId];
      const totalPrice = product.price * quantity;

      // Check balance
      if (user.balance < totalPrice) {
        return await interaction.reply({
          content: `❌ 잔액이 부족합니다.\n필요 금액: ${totalPrice.toLocaleString()}원\n현재 잔액: ${user.balance.toLocaleString()}원\n부족 금액: ${(totalPrice - user.balance).toLocaleString()}원`,
          ephemeral: true
        });
      }

      // Process purchase
      user.balance -= totalPrice;
      if (product.stock !== -1) {
        product.stock -= quantity;
      }

      user.purchases.unshift({
        product_id: productId,
        product_name: product.name,
        quantity,
        unit_price: product.price,
        total_price: totalPrice,
        timestamp: new Date().toISOString()
      });

      // Keep last 50 purchases per user
      if (user.purchases.length > 50) {
        user.purchases.splice(50);
      }

      await saveGuildData(guildId, guildData);

      await interaction.reply({
        content: `✅ **구매 완료**\n\n상품: ${product.name}\n수량: ${quantity}개\n총 금액: ${totalPrice.toLocaleString()}원\n\n남은 잔액: ${user.balance.toLocaleString()}원`,
        ephemeral: true
      });
    } catch (error) {
      console.error('구매 오류:', error);
      await interaction.reply({
        content: `❌ 오류가 발생했습니다: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
