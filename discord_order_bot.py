import discord
from discord.ext import commands
from discord import app_commands
from flask import Flask, request
import threading
import json
from typing import Optional
import os
from dotenv import load_dotenv
from pathlib import Path

# Load config dari .env
load_dotenv()

# Setup
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

# Flask for webhook
app = Flask(__name__)

# Config dari environment
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")
WEBHOOK_HOST = os.getenv("WEBHOOK_HOST", "0.0.0.0")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "5000"))

# Data files
PRODUCTS_FILE = "products.json"
ORDERS_FILE = "orders.json"

# Store pending orders
orders = {}


# ==================== File Utils ====================

def load_products():
    """Load products dari JSON"""
    if Path(PRODUCTS_FILE).exists():
        with open(PRODUCTS_FILE, 'r') as f:
            return json.load(f)
    return {}


def save_products(products):
    """Save products ke JSON"""
    with open(PRODUCTS_FILE, 'w') as f:
        json.dump(products, f, indent=2)


def load_orders():
    """Load orders dari JSON"""
    if Path(ORDERS_FILE).exists():
        with open(ORDERS_FILE, 'r') as f:
            return json.load(f)
    return []


def save_orders(orders_list):
    """Save orders ke JSON"""
    with open(ORDERS_FILE, 'w') as f:
        json.dump(orders_list, f, indent=2)


@bot.event
async def on_ready():
    print(f"✅ Bot logged in as {bot.user}")
    try:
        synced = await bot.tree.sync()
        print(f"✅ Synced {len(synced)} command(s)")
    except Exception as e:
        print(f"❌ Sync error: {e}")


# ==================== Commands ====================

@bot.tree.command(name="addproduct", description="Add new product")
@app_commands.describe(
    name="Product name",
    price="Product price",
    stock="Initial stock quantity"
)
async def add_product(interaction: discord.Interaction, name: str, price: int, stock: int):
    """Tambah produk baru"""
    try:
        products = load_products()
        
        # Check duplicate
        if name.lower() in [p.lower() for p in products.keys()]:
            await interaction.response.send_message(f"❌ Product '{name}' sudah ada!", ephemeral=True)
            return
        
        # Add product
        product_id = name.lower().replace(" ", "_")
        products[product_id] = {
            "name": name,
            "price": price,
            "stock": stock,
            "created_at": str(discord.utils.utcnow())
        }
        
        save_products(products)
        
        await interaction.response.send_message(
            f"✅ Product added!\n"
            f"**Name:** {name}\n"
            f"**Price:** Rp {price:,}\n"
            f"**Stock:** {stock} units",
            ephemeral=True
        )
        print(f"✅ Product added: {name}")
    
    except Exception as e:
        await interaction.response.send_message(f"❌ Error: {e}", ephemeral=True)


@bot.tree.command(name="addstock", description="Add stock to existing product")
@app_commands.describe(
    product="Product name",
    quantity="Quantity to add"
)
async def add_stock(interaction: discord.Interaction, product: str, quantity: int):
    """Tambah stok produk"""
    try:
        products = load_products()
        
        # Find product (case-insensitive)
        product_key = None
        for key in products.keys():
            if products[key]["name"].lower() == product.lower():
                product_key = key
                break
        
        if not product_key:
            await interaction.response.send_message(f"❌ Product '{product}' not found!", ephemeral=True)
            return
        
        # Add stock
        old_stock = products[product_key]["stock"]
        products[product_key]["stock"] += quantity
        new_stock = products[product_key]["stock"]
        
        save_products(products)
        
        await interaction.response.send_message(
            f"✅ Stock updated!\n"
            f"**Product:** {products[product_key]['name']}\n"
            f"**Old Stock:** {old_stock}\n"
            f"**Added:** +{quantity}\n"
            f"**New Stock:** {new_stock}",
            ephemeral=True
        )
        print(f"✅ Stock updated: {products[product_key]['name']} (+{quantity})")
    
    except ValueError:
        await interaction.response.send_message("❌ Quantity harus angka!", ephemeral=True)
    except Exception as e:
        await interaction.response.send_message(f"❌ Error: {e}", ephemeral=True)


# Webhook endpoint (Flask)
@app.route("/webhook/livestock", methods=["POST"])
def livestock_webhook():
    """
    Terima data dari livestock system
    Expected JSON:
    {
        "product": "Beef Tenderloin",
        "price": 250000,
        "qty": 10,
        "weight": "1kg",
        "id": "livestock_123",
        "channel_id": 1234567890  # Target Discord channel
    }
    """
    try:
        data = request.json
        
        # Validasi
        required = ["product", "price", "qty", "channel_id"]
        if not all(k in data for k in required):
            return {"error": "Missing fields. Required: product, price, qty, channel_id"}, 400
        
        # Queue untuk dikirim ke Discord
        order_id = data.get("id", f"order_{len(orders)}")
        orders[order_id] = data
        
        # Trigger send ke Discord (async)
        import asyncio
        asyncio.run_coroutine_threadsafe(
            send_order_to_channel(data, order_id),
            bot.loop
        )
        
        return {"status": "received", "id": order_id}, 200
    
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        return {"error": str(e)}, 500


async def send_order_to_channel(data: dict, order_id: str):
    """Kirim order langsung ke channel yang di-specify"""
    try:
        channel_id = data.get("channel_id")
        channel = bot.get_channel(int(channel_id))
        
        if not channel:
            print(f"❌ Channel {channel_id} not found")
            return
        
        await send_order_embed(channel, data, order_id)
        print(f"✅ Order sent to channel {channel_id}")
    
    except Exception as e:
        print(f"❌ Send error: {e}")



async def send_order_embed(channel, data, order_id):
    """Kirim embed dengan tombol ORDER"""
    embed = discord.Embed(
        title=data.get("product", "Unknown Product"),
        color=discord.Color.blue()
    )
    
    embed.add_field(name="💰 Price", value=f"Rp {data.get('price', 0):,}", inline=True)
    embed.add_field(name="📦 Qty", value=f"{data.get('qty', 0)} units", inline=True)
    
    if "weight" in data:
        embed.add_field(name="⚖️ Weight", value=data["weight"], inline=True)
    
    embed.set_footer(text=f"ID: {order_id}")
    
    # Buat button view
    view = OrderView(order_id, data)
    
    await channel.send(embed=embed, view=view)


class OrderView(discord.ui.View):
    def __init__(self, order_id: str, data: dict):
        super().__init__(timeout=3600)  # 1 hour timeout
        self.order_id = order_id
        self.data = data
    
    @discord.ui.button(label="ORDER", style=discord.ButtonStyle.success, emoji="🛒")
    async def order_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        """Handle ORDER button click"""
        
        # Modal untuk input qty
        await interaction.response.send_modal(OrderModal(self.order_id, self.data))


class OrderModal(discord.ui.Modal, title="Order Details"):
    """Form input untuk order"""
    
    def __init__(self, order_id: str, data: dict):
        super().__init__()
        self.order_id = order_id
        self.data = data
    
    qty = discord.ui.TextInput(
        label="Quantity",
        placeholder="Berapa unit?",
        min_length=1,
        max_length=5
    )
    
    notes = discord.ui.TextInput(
        label="Notes (Optional)",
        placeholder="Catatan tambahan...",
        required=False,
        max_length=500
    )
    
    async def on_submit(self, interaction: discord.Interaction):
        """Process order submission"""
        try:
            qty = int(self.qty.value)
            
            if qty <= 0:
                await interaction.response.send_message("❌ Qty harus > 0", ephemeral=True)
                return
            
            # Build order data
            order_data = {
                "order_id": self.order_id,
                "product": self.data.get("product"),
                "price": self.data.get("price"),
                "qty_ordered": qty,
                "total": self.data.get("price", 0) * qty,
                "notes": self.notes.value or "",
                "user": interaction.user.name
            }
            
            # Log order
            print(f"✅ Order received: {order_data}")
            
            # Reply
            await interaction.response.send_message(
                f"✅ Order confirmed!\n"
                f"**Product:** {order_data['product']}\n"
                f"**Qty:** {qty} units\n"
                f"**Total:** Rp {order_data['total']:,}",
                ephemeral=True
            )
            
            # TODO: Send to backend/database
            # await send_to_backend(order_data)
        
        except ValueError:
            await interaction.response.send_message("❌ Qty harus angka!", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ Error: {e}", ephemeral=True)


# Run bot in background thread
def run_bot():
    bot.run(DISCORD_TOKEN)


def run_webhook():
    app.run(host=WEBHOOK_HOST, port=WEBHOOK_PORT, debug=False)


if __name__ == "__main__":
    if not DISCORD_TOKEN:
        print("❌ DISCORD_TOKEN not found in .env")
        exit(1)
    
    # Start bot thread
    bot_thread = threading.Thread(target=run_bot, daemon=True)
    bot_thread.start()
    
    # Start webhook server
    print(f"🚀 Starting webhook server on {WEBHOOK_HOST}:{WEBHOOK_PORT}...")
    run_webhook()
