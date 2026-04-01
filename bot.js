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

// ==================== Order Functions ====================

async function createTicketChannel(guild, ticketNumber, user, product, qty, totalPrice, notes, paymentResult) {
  try {
    const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

    // Create private ticket channel
    const ticketChannel = await guild.channels.create({
      name: `ticket-${ticketNumber.toLowerCase().replace(/#/g, '').slice(-8)}`,
      type: ChannelType.GuildText,
      topic: `Order Ticket: ${ticketNumber}`,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        }
      ]
    });

    console.log(`✅ Ticket channel created: ${ticketChannel.name}`);

    // Build order details embed
    const orderEmbed = new EmbedBuilder()
      .setTitle(`🎫 Ticket: ${ticketNumber}`)
      .setColor(0x0099ff)
      .addFields(
        { name: '👤 Customer', value: user.username, inline: true },
        { name: '📦 Product', value: product.name, inline: true },
        { name: '📊 Quantity', value: `${qty} units`, inline: true },
        { name: '💰 Unit Price', value: `Rp ${product.price.toLocaleString('id-ID')}`, inline: true },
        { name: '🧮 Total Price', value: `Rp ${totalPrice.toLocaleString('id-ID')}`, inline: false },
        { name: '📝 Notes', value: notes || 'None', inline: false }
      )
      .setTimestamp();

    // Send order details
    await ticketChannel.send({ embeds: [orderEmbed] });

    // Build QRIS embed with image
    const qrisEmbed = new EmbedBuilder()
      .setTitle('💳 Payment QRIS')
      .setColor(0x00aa00)
      .addFields(
        { name: '💰 Amount', value: `Rp ${totalPrice.toLocaleString('id-ID')}`, inline: true },
        { name: '⏰ Status', value: 'PENDING', inline: true }
      )
      .setFooter({ text: 'Scan QRIS di bawah untuk melakukan pembayaran' });

    // If QRIS available, add image
    if (paymentResult.qris) {
      qrisEmbed.setImage(paymentResult.qris);
      console.log(`✅ QRIS image set: ${paymentResult.qris}`);
    }

    // Send QRIS embed
    const qrisMessage = await ticketChannel.send({ embeds: [qrisEmbed] });

    // Store message ID for payment verification
    const orders = loadOrders();
    const orderIndex = orders.findIndex(o => o.ticket_number === ticketNumber);
    if (orderIndex !== -1) {
      orders[orderIndex].discord_message_id = qrisMessage.id;
      orders[orderIndex].discord_channel_id = ticketChannel.id;
      saveOrders(orders);
    }

    return ticketChannel;
  } catch (error) {
    console.error(`❌ Ticket channel creation error: ${error}`);
    return null;
  }
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

      // Get product data from products.json
      const products = loadProducts();
      const product = products[orderId];

      if (!product) {
        return await interaction.reply({ content: '❌ Product not found', ephemeral: true });
      }

      // Calculate total
      const totalPrice = product.price * parseInt(qty);

      // Generate ticket
      const { generateTicketNumber, createPayment } = require('./utils/payment');
      const ticketNumber = generateTicketNumber();

      // Create payment via PaKasir
      const paymentResult = await createPayment(
        totalPrice,
        `Order ${ticketNumber} - ${product.name}`,
        ticketNumber
      );

      if (!paymentResult.success) {
        return await interaction.reply({
          content: `❌ Payment error: ${paymentResult.error}`,
          ephemeral: true
        });
      }

      // Save order
      const orderData = {
        ticket_number: ticketNumber,
        product_id: orderId,
        product_name: product.name,
        qty_ordered: parseInt(qty),
        unit_price: product.price,
        total_price: totalPrice,
        notes: notes,
        user: interaction.user.username,
        user_id: interaction.user.id,
        payment_invoice_id: paymentResult.invoice_id,
        payment_status: 'PENDING',
        timestamp: new Date().toISOString()
      };

      // Save to orders.json
      const orders = loadOrders();
      orders.push(orderData);
      saveOrders(orders);

      console.log(`✅ Order created:`, orderData);

      // Create private ticket channel
      const guild = interaction.guild;
      const ticketChannel = await createTicketChannel(guild, ticketNumber, interaction.user, product, qty, totalPrice, notes, paymentResult);

      if (ticketChannel) {
        // Build confirmation embed for user
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setTitle('🎟️ Order Confirmation')
          .setColor(0x00aa00)
          .addFields(
            { name: '🎫 Ticket', value: ticketNumber, inline: true },
            { name: '📦 Product', value: product.name, inline: true },
            { name: '📊 Quantity', value: `${qty} units`, inline: true },
            { name: '💰 Unit Price', value: `Rp ${product.price.toLocaleString('id-ID')}`, inline: true },
            { name: '🧮 Total Price', value: `Rp ${totalPrice.toLocaleString('id-ID')}`, inline: true },
            { name: '📝 Notes', value: notes || 'None', inline: false }
          )
          .addFields({ name: '🎟️ Ticket Channel', value: `${ticketChannel}`, inline: false })
          .setFooter({ text: 'Lihat detail pembayaran di ticket channel' });

        // Send embed to user
        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

    } catch (error) {
      console.error(`❌ Modal error: ${error}`);
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
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
