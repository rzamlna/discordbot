import discord
from discord.ext import commands
from discord import app_commands
import json
from pathlib import Path


class ProductCommands(commands.Cog):
    """Product management commands"""
    
    def __init__(self, bot):
        self.bot = bot
        self.PRODUCTS_FILE = "products.json"
    
    def load_products(self):
        """Load products dari JSON"""
        if Path(self.PRODUCTS_FILE).exists():
            with open(self.PRODUCTS_FILE, 'r') as f:
                return json.load(f)
        return {}
    
    def save_products(self, products):
        """Save products ke JSON"""
        with open(self.PRODUCTS_FILE, 'w') as f:
            json.dump(products, f, indent=2)
    
    @app_commands.command(name="addproduct", description="Add new product")
    @app_commands.describe(
        name="Product name",
        price="Product price",
        stock="Initial stock quantity"
    )
    async def add_product(self, interaction: discord.Interaction, name: str, price: int, stock: int):
        """Tambah produk baru"""
        try:
            products = self.load_products()
            
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
            
            self.save_products(products)
            
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
    
    @app_commands.command(name="addstock", description="Add stock to existing product")
    @app_commands.describe(
        product="Product name",
        quantity="Quantity to add"
    )
    async def add_stock(self, interaction: discord.Interaction, product: str, quantity: int):
        """Tambah stok produk"""
        try:
            products = self.load_products()
            
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
            
            self.save_products(products)
            
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
    
    @app_commands.command(name="listproducts", description="List all products")
    async def list_products(self, interaction: discord.Interaction):
        """List semua produk"""
        try:
            products = self.load_products()
            
            if not products:
                await interaction.response.send_message("❌ No products found!", ephemeral=True)
                return
            
            embed = discord.Embed(title="📦 Product List", color=discord.Color.blue())
            
            for product_id, product in products.items():
                embed.add_field(
                    name=product["name"],
                    value=f"💰 Rp {product['price']:,} | 📊 Stock: {product['stock']}",
                    inline=False
                )
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            print(f"✅ Listed {len(products)} products")
        
        except Exception as e:
            await interaction.response.send_message(f"❌ Error: {e}", ephemeral=True)


async def setup(bot):
    await bot.add_cog(ProductCommands(bot))
