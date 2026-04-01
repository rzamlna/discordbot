# Discord Order Bot

Auto-order bot untuk Discord dengan livestock webhook integration.

## Features

- 🛒 **Auto-order** — Webhook dari livestock system, tombol ORDER di Discord
- 📦 **Product Management** — `/addproduct`, `/addstock`, `/listproducts`
- 📝 **Order Tracking** — JSON storage
- ⚡ **Fast** — Built with Node.js & discord.js

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/rzamlna/discordbot.git
cd discordbot
npm install
```

### 2. Config `.env`

```bash
cp .env.example .env
```

Edit `.env`:
```env
DISCORD_TOKEN=your_token_here
WEBHOOK_HOST=0.0.0.0
WEBHOOK_PORT=5000
WEBHOOK_SECRET=optional_key
```

### 3. Run

```bash
npm start
```

Dev mode (auto-restart):
```bash
npm run dev
```

## Commands

### `/addproduct`
Tambah produk baru
```
/addproduct name:"Beef" price:250000 stock:10
```

### `/addstock`
Tambah stok produk
```
/addstock product:"Beef" quantity:5
```

### `/listproducts`
List semua produk
```
/listproducts
```

## Webhook

Livestock system POST ke:
```
POST http://your-server:5000/webhook/livestock
```

Payload:
```json
{
  "product": "Beef Tenderloin",
  "price": 250000,
  "qty": 10,
  "channel_id": 1234567890,
  "id": "livestock_123"
}
```

## Files

```
bot.js              - Main bot
package.json        - Dependencies
.env.example        - Config template
commands/           - Slash commands
utils/              - Utilities
products.json       - Products storage
orders.json         - Orders log
```

## License

MIT
