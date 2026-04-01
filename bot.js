const { Client, Collection, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const app = express();

// Config
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WEBHOOK_HOST = process.env.WEBHOOK_HOST || '0.0.0.0';
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 5000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Data files
const PRODUCTS_FILE = 'products.json';
const ORDERS_FILE = 'orders.json';

// Commands collection
bot.commands = new Collection();

// Middleware
app.use(express.json());

// ==================== File Utils ====================

function loadProducts() {
  if (fs.existsSync(PRODUCTS_FILE)) {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  }
  return {};
}

function saveProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

function loadOrders() {
  if (fs.existsSync(ORDERS_FILE)) {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  }
  return [];
}

function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// ==================== Bot Events ====================

bot.once('ready', () => {
  console.log(`✅ Bot logged in as ${bot.user.tag}`);
});

bot.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = bot.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Command error: ${error}`);
    await interaction.reply({ content: '❌ Error executing command', ephemeral: true });
  }
});

// ==================== Load Commands ====================

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  bot.commands.set(command.data.name, command);
  console.log(`✅ Loaded command: ${command.data.name}`);
}

// ==================== Webhook ====================

app.post('/webhook/livestock', (req, res) => {
  try {
    const data = req.body;

    // Validasi
    const required = ['product', 'price', 'qty', 'channel_id'];
    if (!required.every(key => key in data)) {
      return res.status(400).json({ error: 'Missing fields. Required: product, price, qty, channel_id' });
    }

    const orderId = data.id || `order_${Date.now()}`;
    const channel = bot.channels.cache.get(data.channel_id);

    if (!channel) {
      return res.status(404).json({ error: `Channel ${data.channel_id} not found` });
    }

    sendOrderEmbed(channel, data, orderId).catch(err => console.error(`❌ Send error: ${err}`));

    res.json({ status: 'received', id: orderId });
  } catch (error) {
    console.error(`❌ Webhook error: ${error}`);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Order Functions ====================

async function sendOrderEmbed(channel, data, orderId) {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const embed = new EmbedBuilder()
    .setTitle(data.product || 'Unknown Product')
    .setColor(0x0099ff)
    .addFields(
      { name: '💰 Price', value: `Rp ${data.price.toLocaleString('id-ID')}`, inline: true },
      { name: '📦 Qty', value: `${data.qty} units`, inline: true }
    )
    .setFooter({ text: `ID: ${orderId}` });

  if (data.weight) {
    embed.addFields({ name: '⚖️ Weight', value: data.weight, inline: true });
  }

  const button = new ButtonBuilder()
    .setCustomId(`order_${orderId}`)
    .setLabel('ORDER')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🛒');

  const row = new ActionRowBuilder().addComponents(button);

  await channel.send({ embeds: [embed], components: [row] });
  console.log(`✅ Order sent to channel ${data.channel_id}`);
}

// ==================== Button Interaction ====================

bot.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('order_')) {
    const orderId = interaction.customId.replace('order_', '').replace('livestock_', '');
    const modal = require('./utils/orderModal');
    await interaction.showModal(modal.create(orderId));
  }
});

bot.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId.startsWith('orderModal_')) {
    const orderId = interaction.customId.replace('orderModal_', '');
    const qty = interaction.fields.getTextInputValue('qty');
    const notes = interaction.fields.getTextInputValue('notes');

    try {
      if (parseInt(qty) <= 0) {
        return await interaction.reply({ content: '❌ Qty harus > 0', ephemeral: true });
      }

      const orderData = {
        order_id: orderId,
        qty_ordered: parseInt(qty),
        notes: notes,
        user: interaction.user.username,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Order received:`, orderData);

      await interaction.reply({
        content: `✅ Order confirmed!\n**Qty:** ${qty} units\n**Notes:** ${notes || 'None'}`,
        ephemeral: true
      });
    } catch (error) {
      console.error(`❌ Modal error: ${error}`);
      await interaction.reply({ content: '❌ Error processing order', ephemeral: true });
    }
  }
});

// ==================== Run ====================

// Register commands
async function registerCommands() {
  try {
    const { REST, Routes } = require('discord.js');
    const commands = bot.commands.map(cmd => cmd.data.toJSON());

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(bot.user.id), { body: commands });
    console.log(`✅ Registered ${commands.length} commands`);
  } catch (error) {
    console.error(`❌ Failed to register commands: ${error}`);
  }
}

bot.once('ready', async () => {
  await registerCommands();
});

// Start bot
bot.login(DISCORD_TOKEN);

// Start webhook server
app.listen(WEBHOOK_PORT, WEBHOOK_HOST, () => {
  console.log(`🚀 Webhook server running on ${WEBHOOK_HOST}:${WEBHOOK_PORT}`);
});

// Error handling
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled Rejection:', error);
});
