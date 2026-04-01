const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder } = require('discord.js');
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
    .setName('livestock')
    .setDescription('Post livestock products to channel')
    .addChannelOption(option =>
      option.setName('channel').setDescription('Target channel').setRequired(true)
    ),

  async execute(interaction) {
    try {
      const targetChannel = interaction.options.getChannel('channel');
      const products = loadProducts();

      if (Object.keys(products).length === 0) {
        return await interaction.reply({ content: '❌ No products found!', ephemeral: true });
      }

      // Post each product to channel
      let count = 0;
      for (const [id, product] of Object.entries(products)) {
        const embed = new EmbedBuilder()
          .setTitle(product.name)
          .setColor(0x0099ff)
          .addFields(
            { name: '💰 Price', value: `Rp ${product.price.toLocaleString('id-ID')}`, inline: true },
            { name: '📦 Stock', value: `${product.stock} units`, inline: true }
          )
          .setFooter({ text: `ID: ${id}` });

        const button = new ButtonBuilder()
          .setCustomId(`order_livestock_${id}`)
          .setLabel('ORDER')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🛒');

        const row = new ActionRowBuilder().addComponents(button);

        await targetChannel.send({ embeds: [embed], components: [row] });
        count++;
      }

      await interaction.reply({
        content: `✅ Posted ${count} product(s) to <#${targetChannel.id}>`,
        ephemeral: true
      });

      console.log(`✅ Livestock posted to #${targetChannel.name} (${count} products)`);
    } catch (error) {
      console.error(`❌ Error: ${error}`);
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
};
