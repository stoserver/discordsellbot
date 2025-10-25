import discord
from discord import app_commands
from discord.ext import commands
import json
import os
from datetime import datetime
from typing import Optional

# 봇 설정
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

class VendingMachineBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix='!', intents=intents)
        self.products = {}
        self.users = {}

    async def setup_hook(self):
        """봇 시작 시 데이터 로드"""
        self.load_data()
        await self.tree.sync()
        print("슬래시 커맨드 동기화 완료!")

    def load_data(self):
        """제품 및 사용자 데이터 로드"""
        if os.path.exists('products.json'):
            with open('products.json', 'r', encoding='utf-8') as f:
                self.products = json.load(f)
        else:
            self.products = {}

        if os.path.exists('users.json'):
            with open('users.json', 'r', encoding='utf-8') as f:
                self.users = json.load(f)
        else:
            self.users = {}

    def save_data(self):
        """제품 및 사용자 데이터 저장"""
        with open('products.json', 'w', encoding='utf-8') as f:
            json.dump(self.products, f, ensure_ascii=False, indent=2)

        with open('users.json', 'w', encoding='utf-8') as f:
            json.dump(self.users, f, ensure_ascii=False, indent=2)

bot = VendingMachineBot()

@bot.event
async def on_ready():
    print(f'{bot.user} 봇이 준비되었습니다!')
    print(f'서버 수: {len(bot.guilds)}')

# ========================
# 사용자 명령어
# ========================

@bot.tree.command(name="상품목록", description="구매 가능한 상품 목록을 확인합니다")
async def product_list(interaction: discord.Interaction):
    """상품 목록 보기"""
    if not bot.products:
        await interaction.response.send_message("❌ 현재 등록된 상품이 없습니다.", ephemeral=True)
        return

    embed = discord.Embed(
        title="🏪 자판기 상품 목록",
        description="구매 가능한 상품들입니다",
        color=discord.Color.blue(),
        timestamp=datetime.now()
    )

    for product_id, product in bot.products.items():
        stock_text = f"{product['stock']}개" if product['stock'] > 0 else "품절"
        embed.add_field(
            name=f"{product['name']} - {product['price']:,}원",
            value=f"```\n설명: {product['description']}\n재고: {stock_text}\nID: {product_id}\n```",
            inline=False
        )

    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="잔액", description="내 잔액을 확인합니다")
async def check_balance(interaction: discord.Interaction):
    """잔액 확인"""
    user_id = str(interaction.user.id)

    if user_id not in bot.users:
        bot.users[user_id] = {"balance": 0, "purchases": []}
        bot.save_data()

    balance = bot.users[user_id]["balance"]
    embed = discord.Embed(
        title="💰 내 잔액",
        description=f"현재 잔액: **{balance:,}원**",
        color=discord.Color.green()
    )

    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.tree.command(name="구매", description="상품을 구매합니다")
@app_commands.describe(product_id="구매할 상품의 ID", quantity="구매 수량 (기본값: 1)")
async def purchase(interaction: discord.Interaction, product_id: str, quantity: int = 1):
    """상품 구매"""
    user_id = str(interaction.user.id)

    # 사용자 초기화
    if user_id not in bot.users:
        bot.users[user_id] = {"balance": 0, "purchases": []}

    # 상품 확인
    if product_id not in bot.products:
        await interaction.response.send_message("❌ 존재하지 않는 상품입니다.", ephemeral=True)
        return

    product = bot.products[product_id]

    # 수량 확인
    if quantity <= 0:
        await interaction.response.send_message("❌ 수량은 1개 이상이어야 합니다.", ephemeral=True)
        return

    # 재고 확인
    if product['stock'] < quantity:
        await interaction.response.send_message(f"❌ 재고가 부족합니다. (남은 재고: {product['stock']}개)", ephemeral=True)
        return

    total_price = product['price'] * quantity

    # 잔액 확인
    if bot.users[user_id]['balance'] < total_price:
        await interaction.response.send_message(
            f"❌ 잔액이 부족합니다.\n필요 금액: {total_price:,}원\n현재 잔액: {bot.users[user_id]['balance']:,}원",
            ephemeral=True
        )
        return

    # 구매 처리
    bot.users[user_id]['balance'] -= total_price
    bot.products[product_id]['stock'] -= quantity

    # 구매 기록
    purchase_record = {
        "product_id": product_id,
        "product_name": product['name'],
        "quantity": quantity,
        "total_price": total_price,
        "timestamp": datetime.now().isoformat()
    }
    bot.users[user_id]['purchases'].append(purchase_record)

    bot.save_data()

    embed = discord.Embed(
        title="✅ 구매 완료!",
        description=f"**{product['name']}** {quantity}개를 구매했습니다!",
        color=discord.Color.green()
    )
    embed.add_field(name="결제 금액", value=f"{total_price:,}원", inline=True)
    embed.add_field(name="남은 잔액", value=f"{bot.users[user_id]['balance']:,}원", inline=True)

    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.tree.command(name="구매내역", description="내 구매 내역을 확인합니다")
async def purchase_history(interaction: discord.Interaction):
    """구매 내역 확인"""
    user_id = str(interaction.user.id)

    if user_id not in bot.users or not bot.users[user_id]['purchases']:
        await interaction.response.send_message("❌ 구매 내역이 없습니다.", ephemeral=True)
        return

    embed = discord.Embed(
        title="📋 구매 내역",
        color=discord.Color.blue(),
        timestamp=datetime.now()
    )

    # 최근 10개만 표시
    recent_purchases = bot.users[user_id]['purchases'][-10:]

    for i, purchase in enumerate(reversed(recent_purchases), 1):
        timestamp = datetime.fromisoformat(purchase['timestamp']).strftime('%Y-%m-%d %H:%M')
        embed.add_field(
            name=f"{i}. {purchase['product_name']}",
            value=f"수량: {purchase['quantity']}개 | 금액: {purchase['total_price']:,}원\n{timestamp}",
            inline=False
        )

    await interaction.response.send_message(embed=embed, ephemeral=True)

# ========================
# 관리자 명령어
# ========================

def is_admin():
    """관리자 권한 확인"""
    def predicate(interaction: discord.Interaction) -> bool:
        return interaction.user.guild_permissions.administrator
    return app_commands.check(predicate)

@bot.tree.command(name="상품추가", description="[관리자] 새로운 상품을 추가합니다")
@app_commands.describe(
    product_id="상품 ID (고유값)",
    name="상품 이름",
    price="가격",
    description="상품 설명",
    stock="초기 재고"
)
@is_admin()
async def add_product(
    interaction: discord.Interaction,
    product_id: str,
    name: str,
    price: int,
    description: str,
    stock: int
):
    """상품 추가"""
    if product_id in bot.products:
        await interaction.response.send_message("❌ 이미 존재하는 상품 ID입니다.", ephemeral=True)
        return

    if price <= 0 or stock < 0:
        await interaction.response.send_message("❌ 가격과 재고는 올바른 값이어야 합니다.", ephemeral=True)
        return

    bot.products[product_id] = {
        "name": name,
        "price": price,
        "description": description,
        "stock": stock
    }

    bot.save_data()

    embed = discord.Embed(
        title="✅ 상품 추가 완료",
        description=f"**{name}** 상품이 추가되었습니다!",
        color=discord.Color.green()
    )
    embed.add_field(name="ID", value=product_id, inline=True)
    embed.add_field(name="가격", value=f"{price:,}원", inline=True)
    embed.add_field(name="재고", value=f"{stock}개", inline=True)

    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="상품삭제", description="[관리자] 상품을 삭제합니다")
@app_commands.describe(product_id="삭제할 상품의 ID")
@is_admin()
async def remove_product(interaction: discord.Interaction, product_id: str):
    """상품 삭제"""
    if product_id not in bot.products:
        await interaction.response.send_message("❌ 존재하지 않는 상품입니다.", ephemeral=True)
        return

    product_name = bot.products[product_id]['name']
    del bot.products[product_id]
    bot.save_data()

    await interaction.response.send_message(f"✅ **{product_name}** 상품이 삭제되었습니다.")

@bot.tree.command(name="재고추가", description="[관리자] 상품의 재고를 추가합니다")
@app_commands.describe(product_id="상품 ID", amount="추가할 재고 수량")
@is_admin()
async def add_stock(interaction: discord.Interaction, product_id: str, amount: int):
    """재고 추가"""
    if product_id not in bot.products:
        await interaction.response.send_message("❌ 존재하지 않는 상품입니다.", ephemeral=True)
        return

    if amount <= 0:
        await interaction.response.send_message("❌ 수량은 1개 이상이어야 합니다.", ephemeral=True)
        return

    bot.products[product_id]['stock'] += amount
    bot.save_data()

    await interaction.response.send_message(
        f"✅ **{bot.products[product_id]['name']}** 재고가 {amount}개 추가되었습니다.\n"
        f"현재 재고: {bot.products[product_id]['stock']}개"
    )

@bot.tree.command(name="충전", description="[관리자] 사용자에게 포인트를 충전합니다")
@app_commands.describe(user="충전할 사용자", amount="충전 금액")
@is_admin()
async def charge_balance(interaction: discord.Interaction, user: discord.User, amount: int):
    """사용자 잔액 충전"""
    if amount <= 0:
        await interaction.response.send_message("❌ 금액은 0보다 커야 합니다.", ephemeral=True)
        return

    user_id = str(user.id)

    if user_id not in bot.users:
        bot.users[user_id] = {"balance": 0, "purchases": []}

    bot.users[user_id]['balance'] += amount
    bot.save_data()

    embed = discord.Embed(
        title="✅ 충전 완료",
        description=f"{user.mention}님에게 **{amount:,}원**을 충전했습니다!",
        color=discord.Color.green()
    )
    embed.add_field(name="현재 잔액", value=f"{bot.users[user_id]['balance']:,}원")

    await interaction.response.send_message(embed=embed)

# 에러 핸들러
@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.CheckFailure):
        await interaction.response.send_message("❌ 이 명령어는 관리자만 사용할 수 있습니다.", ephemeral=True)
    else:
        await interaction.response.send_message(f"❌ 오류가 발생했습니다: {str(error)}", ephemeral=True)
        print(f"Error: {error}")

# 봇 실행
if __name__ == "__main__":
    # config.json에서 토큰 읽기
    if os.path.exists('config.json'):
        with open('config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
            TOKEN = config.get('token')
    else:
        print("❌ config.json 파일이 없습니다. 파일을 생성해주세요.")
        exit(1)

    if not TOKEN:
        print("❌ config.json에 토큰을 입력해주세요.")
        exit(1)

    bot.run(TOKEN)
