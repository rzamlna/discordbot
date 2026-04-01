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
    .setName('addproduct')
    .setDescription('Add new product')
    .addStringOption(option => option.setName('name').setDescription('Product name').setRequired(true))
    .addIntegerOption(option => option.setName('price').setDescription('Product price').setRequired(true))
    .addIntegerOption(option => option.setName('stock').setDescription('Initial stock quantity').setRequired(true)),

  async execute(interaction) {
    try {
      const name = interaction.options.getString('name');
      const price = interaction.options.getInteger('price');
      const stock = interaction.options.getInteger('stock');

      const products = loadProducts();

      // Check duplicate
      if (Object.values(products).some(p => p.name.toLowerCase() === name.toLowerCase())) {
        return await interaction.reply({ content: `❌ Product '${name}' sudah ada!`, ephemeral: true });
      }

      // Add product
      const productId = name.toLowerCase().replace(/\s+/g, '_');
      products[productId] = {
        name,
        price,
        stock,
        created_at: new Date().toISOString()
      };

      saveProducts(products);

      const embed = new EmbedBuilder()
        .setTitle('✅ Product Added')
        .setColor(0x00ff00)
        .addFields(
          { name: 'Name', value: name },
          { name: '💰 Price', value: `Rp ${price.toLocaleString('id-ID')}` },
          { name: '📦 Stock', value: `${stock} units` }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      console.log(`✅ Product added: ${name}`);
    } catch (error) {
      console.error(`❌ Error: ${error}`);
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
};
