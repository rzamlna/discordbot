const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const PRODUCTS_FILE = 'products.json';

function loadProducts() {
  if (fs.existsSync(PRODUCTS_FILE)) {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  }
  return {};
}

function saveProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addstock')
    .setDescription('Add stock to existing product')
    .addStringOption(option => option.setName('product').setDescription('Product name').setRequired(true))
    .addIntegerOption(option => option.setName('quantity').setDescription('Quantity to add').setRequired(true)),

  async execute(interaction) {
    try {
      const productName = interaction.options.getString('product');
      const quantity = interaction.options.getInteger('quantity');

      const products = loadProducts();

      // Find product (case-insensitive)
      const productKey = Object.keys(products).find(key =>
        products[key].name.toLowerCase() === productName.toLowerCase()
      );

      if (!productKey) {
        return await interaction.reply({ content: `❌ Product '${productName}' not found!`, ephemeral: true });
      }

      // Add stock
      const oldStock = products[productKey].stock;
      products[productKey].stock += quantity;
      const newStock = products[productKey].stock;

      saveProducts(products);

      const embed = new EmbedBuilder()
        .setTitle('✅ Stock Updated')
        .setColor(0x0099ff)
        .addFields(
          { name: 'Product', value: products[productKey].name },
          { name: 'Old Stock', value: `${oldStock}` },
          { name: 'Added', value: `+${quantity}` },
          { name: 'New Stock', value: `${newStock}` }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      console.log(`✅ Stock updated: ${products[productKey].name} (+${quantity})`);
    } catch (error) {
      console.error(`❌ Error: ${error}`);
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
};
