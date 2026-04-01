const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const PRODUCTS_FILE = 'products.json';

function loadProducts() {
  if (fs.existsSync(PRODUCTS_FILE)) {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  }
  return {};
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listproducts')
    .setDescription('List all products'),

  async execute(interaction) {
    try {
      const products = loadProducts();

      if (Object.keys(products).length === 0) {
        return await interaction.reply({ content: '❌ No products found!', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('📦 Product List')
        .setColor(0x0099ff);

      for (const [id, product] of Object.entries(products)) {
        embed.addFields({
          name: product.name,
          value: `💰 Rp ${product.price.toLocaleString('id-ID')} | 📊 Stock: ${product.stock}`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      console.log(`✅ Listed ${Object.keys(products).length} products`);
    } catch (error) {
      console.error(`❌ Error: ${error}`);
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
};
