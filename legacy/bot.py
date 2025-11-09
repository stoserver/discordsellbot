import discord
from discord import app_commands
from discord.ext import commands
from discord.ui import Button, Select, View, Modal, TextInput
import json
import os
from datetime import datetime
from typing import Optional
import asyncio
import re
import threading
import websocket
from pushbullet import Pushbullet

# 봇 설정
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

class VendingMachineBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix='!', intents=intents)
        self.products = {}
        self.users = {}
        self.config = {}
        self.pushbullet_listener = None
        self.pushbullet_thread = None

    async def setup_hook(self):
        """봇 시작 시 데이터 로드"""
        self.load_data()
        self.load_config()
        await self.tree.sync()
        print("슬래시 커맨드 동기화 완료!")

        # Pushbullet 자동 시작
        if self.config.get('pushbullet', {}).get('enabled', False):
            self.start_pushbullet_listener()

    def load_config(self):
        """설정 파일 로드"""
        if os.path.exists('config.json'):
            with open('config.json', 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        else:
            self.config = {}

    def save_config(self):
        """설정 파일 저장"""
        with open('config.json', 'w', encoding='utf-8') as f:
            json.dump(self.config, f, ensure_ascii=False, indent=2)

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

    def start_pushbullet_listener(self):
        """Pushbullet 리스너 시작"""
        if self.pushbullet_thread and self.pushbullet_thread.is_alive():
            print("⚠️ Pushbullet 리스너가 이미 실행 중입니다.")
            return

        start_pushbullet_listener_thread(self)

    def stop_pushbullet_listener(self):
        """Pushbullet 리스너 중지"""
        if self.pushbullet_listener:
            self.pushbullet_listener.stop()
            self.pushbullet_listener = None
            self.pushbullet_thread = None

bot = VendingMachineBot()

# ========================
# Pushbullet 자동 충전 시스템
# ========================

class PushbulletListener:
    """Pushbullet WebSocket 리스너"""
    def __init__(self, api_key, bot_instance):
        self.api_key = api_key
        self.bot = bot_instance
        self.ws = None
        self.running = False

    def on_message(self, ws, message):
        """메시지 수신 처리"""
        try:
            data = json.loads(message)

            # nop 메시지는 heartbeat이므로 무시
            if data.get('type') == 'nop':
                return

            # push 타입의 ephemeral (notification mirroring)
            if data.get('type') == 'push':
                push_data = data.get('push', {})

                # notification mirroring인지 확인
                if push_data.get('type') == 'mirror':
                    notification = push_data
                    self.handle_notification(notification)

        except Exception as e:
            print(f"❌ Pushbullet 메시지 처리 오류: {e}")

    def handle_notification(self, notification):
        """알림 처리 및 자동 충전"""
        try:
            # 알림 제목과 내용 추출
            title = notification.get('title', '')
            body = notification.get('body', '')
            full_text = f"{title} {body}"

            print(f"📱 알림 수신: {title}")

            # 설정에서 패턴 가져오기
            charge_pattern = self.bot.config.get('pushbullet', {}).get('charge_pattern', r'충전\s*(\d+)원?')
            user_id_pattern = self.bot.config.get('pushbullet', {}).get('user_id_pattern', r'사용자\s*ID[:\s]*(\d+)')

            # 충전 금액 찾기
            charge_match = re.search(charge_pattern, full_text)
            # 사용자 ID 찾기
            user_match = re.search(user_id_pattern, full_text)

            if charge_match and user_match:
                amount = int(charge_match.group(1))
                user_id = user_match.group(1)

                # 자동 충전 실행
                self.auto_charge(user_id, amount, full_text)
            else:
                # 패턴 매칭 실패 - 디버그 정보만 출력
                if charge_match and not user_match:
                    print(f"⚠️ 충전 금액은 발견했으나 사용자 ID를 찾을 수 없습니다.")
                elif user_match and not charge_match:
                    print(f"⚠️ 사용자 ID는 발견했으나 충전 금액을 찾을 수 없습니다.")

        except Exception as e:
            print(f"❌ 알림 처리 오류: {e}")

    def auto_charge(self, user_id, amount, notification_text):
        """자동 충전 실행"""
        try:
            user_id_str = str(user_id)

            # 사용자 초기화
            if user_id_str not in self.bot.users:
                self.bot.users[user_id_str] = {"balance": 0, "purchases": []}

            # 충전 실행
            old_balance = self.bot.users[user_id_str]['balance']
            self.bot.users[user_id_str]['balance'] += amount
            new_balance = self.bot.users[user_id_str]['balance']

            # 데이터 저장
            self.bot.save_data()

            print(f"✅ 자동 충전 완료: 사용자 {user_id} | {amount:,}원")
            print(f"   이전 잔액: {old_balance:,}원 → 현재 잔액: {new_balance:,}원")

            # 충전 로그 기록 (선택사항)
            self.log_auto_charge(user_id, amount, notification_text)

        except Exception as e:
            print(f"❌ 자동 충전 오류: {e}")

    def log_auto_charge(self, user_id, amount, notification_text):
        """자동 충전 로그 기록"""
        try:
            log_entry = {
                "user_id": user_id,
                "amount": amount,
                "timestamp": datetime.now().isoformat(),
                "notification": notification_text[:200]  # 처음 200자만 저장
            }

            # 로그 파일에 기록
            log_file = 'auto_charge_log.json'
            logs = []

            if os.path.exists(log_file):
                with open(log_file, 'r', encoding='utf-8') as f:
                    logs = json.load(f)

            logs.append(log_entry)

            # 최근 100개만 유지
            logs = logs[-100:]

            with open(log_file, 'w', encoding='utf-8') as f:
                json.dump(logs, f, ensure_ascii=False, indent=2)

        except Exception as e:
            print(f"⚠️ 로그 기록 실패: {e}")

    def on_error(self, ws, error):
        """WebSocket 오류 처리"""
        print(f"❌ Pushbullet WebSocket 오류: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        """WebSocket 연결 종료"""
        print(f"📴 Pushbullet 연결 종료 (코드: {close_status_code})")
        self.running = False

    def on_open(self, ws):
        """WebSocket 연결 시작"""
        print("✅ Pushbullet 알림 미러링 연결 성공!")
        print("📱 Android 기기의 알림을 수신 대기 중...")
        self.running = True

    def start(self):
        """WebSocket 연결 시작"""
        try:
            url = f"wss://stream.pushbullet.com/websocket/{self.api_key}"

            self.ws = websocket.WebSocketApp(
                url,
                on_open=self.on_open,
                on_message=self.on_message,
                on_error=self.on_error,
                on_close=self.on_close
            )

            # 영구 실행
            self.ws.run_forever()

        except Exception as e:
            print(f"❌ Pushbullet 연결 실패: {e}")
            self.running = False

    def stop(self):
        """WebSocket 연결 중지"""
        self.running = False
        if self.ws:
            self.ws.close()
        print("📴 Pushbullet 리스너 중지")


def start_pushbullet_listener_thread(bot_instance):
    """별도 스레드에서 Pushbullet 리스너 시작"""
    api_key = bot_instance.config.get('pushbullet', {}).get('api_key')

    if not api_key:
        print("⚠️ Pushbullet API 키가 설정되지 않았습니다.")
        return

    listener = PushbulletListener(api_key, bot_instance)
    bot_instance.pushbullet_listener = listener

    # 별도 스레드에서 실행
    thread = threading.Thread(target=listener.start, daemon=True)
    bot_instance.pushbullet_thread = thread
    thread.start()


# ========================
# UI 컴포넌트
# ========================

class QuantityModal(Modal, title="구매 수량 입력"):
    """수량 입력 모달"""
    quantity_input = TextInput(
        label="구매 수량",
        placeholder="구매할 수량을 입력하세요 (예: 1, 2, 3...)",
        required=True,
        max_length=5
    )

    def __init__(self, product_id: str, product_name: str):
        super().__init__()
        self.product_id = product_id
        self.product_name = product_name

    async def on_submit(self, interaction: discord.Interaction):
        try:
            quantity = int(self.quantity_input.value)
            if quantity <= 0:
                await interaction.response.send_message("❌ 수량은 1개 이상이어야 합니다.", ephemeral=True)
                return

            # 구매 처리
            await process_purchase(interaction, self.product_id, quantity)
        except ValueError:
            await interaction.response.send_message("❌ 올바른 숫자를 입력해주세요.", ephemeral=True)


class ProductSelect(Select):
    """상품 선택 드롭다운"""
    def __init__(self):
        # 상품이 없으면 기본 옵션 표시
        if not bot.products:
            options = [
                discord.SelectOption(label="등록된 상품이 없습니다", value="none", emoji="❌")
            ]
        else:
            # 최대 25개 상품만 표시 (Discord 제한)
            options = []
            for product_id, product in list(bot.products.items())[:25]:
                stock_text = f"재고: {product['stock']}개" if product['stock'] > 0 else "품절"
                emoji = "✅" if product['stock'] > 0 else "❌"
                options.append(
                    discord.SelectOption(
                        label=f"{product['name']} - {product['price']:,}원",
                        value=product_id,
                        description=f"{product['description'][:50]} | {stock_text}",
                        emoji=emoji
                    )
                )

        super().__init__(
            placeholder="상품을 선택하세요",
            min_values=1,
            max_values=1,
            options=options
        )

    async def callback(self, interaction: discord.Interaction):
        if self.values[0] == "none":
            await interaction.response.send_message("❌ 등록된 상품이 없습니다.", ephemeral=True)
            return

        product_id = self.values[0]
        product = bot.products.get(product_id)

        if not product:
            await interaction.response.send_message("❌ 존재하지 않는 상품입니다.", ephemeral=True)
            return

        if product['stock'] <= 0:
            await interaction.response.send_message("❌ 이 상품은 품절되었습니다.", ephemeral=True)
            return

        # 수량 입력 모달 표시
        modal = QuantityModal(product_id, product['name'])
        await interaction.response.send_modal(modal)


class ShopView(View):
    """메인 쇼핑 패널"""
    def __init__(self):
        super().__init__(timeout=None)  # 영구적 View
        self.add_item(ProductSelect())

    @discord.ui.button(label="잔액 확인", style=discord.ButtonStyle.green, emoji="💰", row=1)
    async def balance_button(self, interaction: discord.Interaction, button: Button):
        user_id = str(interaction.user.id)

        if user_id not in bot.users:
            bot.users[user_id] = {"balance": 0, "purchases": []}
            bot.save_data()

        balance = bot.users[user_id]["balance"]
        await interaction.response.send_message(
            f"💰 **잔액**: {balance:,}원",
            ephemeral=True
        )

    @discord.ui.button(label="구매 내역", style=discord.ButtonStyle.blurple, emoji="📋", row=1)
    async def history_button(self, interaction: discord.Interaction, button: Button):
        user_id = str(interaction.user.id)

        if user_id not in bot.users or not bot.users[user_id]['purchases']:
            await interaction.response.send_message("❌ 구매 내역이 없습니다.", ephemeral=True)
            return

        # 최근 5개만 간단히 표시
        recent = bot.users[user_id]['purchases'][-5:]
        history_text = "📋 **최근 구매 내역**\n\n"

        for i, purchase in enumerate(reversed(recent), 1):
            timestamp = datetime.fromisoformat(purchase['timestamp']).strftime('%m/%d %H:%M')
            history_text += f"{i}. **{purchase['product_name']}** x{purchase['quantity']} - {purchase['total_price']:,}원 ({timestamp})\n"

        await interaction.response.send_message(history_text, ephemeral=True)

    @discord.ui.button(label="상품 새로고침", style=discord.ButtonStyle.gray, emoji="🔄", row=1)
    async def refresh_button(self, interaction: discord.Interaction, button: Button):
        # View를 새로 생성하여 업데이트된 상품 목록 반영
        new_view = ShopView()

        if not bot.products:
            product_list = "❌ 현재 등록된 상품이 없습니다."
        else:
            product_list = "🏪 **자판기 상품 목록**\n\n"
            for product_id, product in bot.products.items():
                stock_text = f"{product['stock']}개" if product['stock'] > 0 else "품절"
                product_list += f"• **{product['name']}** - {product['price']:,}원\n"
                product_list += f"  ↳ {product['description']} | 재고: {stock_text}\n\n"

        await interaction.response.edit_message(content=product_list, view=new_view)


async def process_purchase(interaction: discord.Interaction, product_id: str, quantity: int):
    """구매 처리 함수"""
    user_id = str(interaction.user.id)

    # 사용자 초기화
    if user_id not in bot.users:
        bot.users[user_id] = {"balance": 0, "purchases": []}

    # 상품 확인
    if product_id not in bot.products:
        await interaction.response.send_message("❌ 존재하지 않는 상품입니다.", ephemeral=True)
        return

    product = bot.products[product_id]

    # 재고 확인
    if product['stock'] < quantity:
        await interaction.response.send_message(
            f"❌ 재고가 부족합니다. (남은 재고: {product['stock']}개)",
            ephemeral=True
        )
        return

    total_price = product['price'] * quantity

    # 잔액 확인
    if bot.users[user_id]['balance'] < total_price:
        await interaction.response.send_message(
            f"❌ 잔액이 부족합니다.\n💰 필요 금액: {total_price:,}원\n💳 현재 잔액: {bot.users[user_id]['balance']:,}원",
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

    # 구매 완료 메시지
    success_msg = (
        f"✅ **구매 완료!**\n\n"
        f"🛒 상품: **{product['name']}** x{quantity}개\n"
        f"💳 결제 금액: {total_price:,}원\n"
        f"💰 남은 잔액: {bot.users[user_id]['balance']:,}원"
    )

    await interaction.response.send_message(success_msg, ephemeral=True)


@bot.event
async def on_ready():
    print(f'{bot.user} 봇이 준비되었습니다!')
    print(f'서버 수: {len(bot.guilds)}')

# ========================
# 사용자 명령어
# ========================

@bot.tree.command(name="자판기", description="자판기 쇼핑 패널을 엽니다")
async def vending_machine(interaction: discord.Interaction):
    """메인 자판기 패널"""
    if not bot.products:
        product_list = "❌ 현재 등록된 상품이 없습니다.\n\n관리자에게 문의해주세요."
    else:
        product_list = "🏪 **자판기 상품 목록**\n\n"
        for product_id, product in bot.products.items():
            stock_text = f"{product['stock']}개" if product['stock'] > 0 else "품절"
            product_list += f"• **{product['name']}** - {product['price']:,}원\n"
            product_list += f"  ↳ {product['description']} | 재고: {stock_text}\n\n"

        product_list += "\n💡 **사용 방법**\n"
        product_list += "1️⃣ 드롭다운에서 상품 선택\n"
        product_list += "2️⃣ 수량 입력\n"
        product_list += "3️⃣ 버튼으로 잔액/내역 확인"

    view = ShopView()
    await interaction.response.send_message(product_list, view=view)

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
# 관리자 UI 컴포넌트
# ========================

class AdminProductModal(Modal, title="상품 추가"):
    """관리자 상품 추가 모달"""
    product_id_input = TextInput(
        label="상품 ID",
        placeholder="예: cola, snack1",
        required=True,
        max_length=50
    )
    name_input = TextInput(
        label="상품 이름",
        placeholder="예: 콜라",
        required=True,
        max_length=100
    )
    price_input = TextInput(
        label="가격",
        placeholder="예: 1500",
        required=True,
        max_length=10
    )
    description_input = TextInput(
        label="상품 설명",
        placeholder="예: 시원한 콜라",
        required=True,
        max_length=200
    )
    stock_input = TextInput(
        label="초기 재고",
        placeholder="예: 100",
        required=True,
        max_length=10
    )

    async def on_submit(self, interaction: discord.Interaction):
        try:
            product_id = self.product_id_input.value.strip()
            name = self.name_input.value.strip()
            price = int(self.price_input.value.strip())
            description = self.description_input.value.strip()
            stock = int(self.stock_input.value.strip())

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

            success_msg = (
                f"✅ **상품 추가 완료**\n\n"
                f"🆔 ID: {product_id}\n"
                f"📦 이름: {name}\n"
                f"💰 가격: {price:,}원\n"
                f"📊 재고: {stock}개"
            )

            await interaction.response.send_message(success_msg, ephemeral=True)

        except ValueError:
            await interaction.response.send_message("❌ 가격과 재고는 숫자로 입력해주세요.", ephemeral=True)


class AdminStockModal(Modal, title="재고 추가"):
    """관리자 재고 추가 모달"""
    product_id_input = TextInput(
        label="상품 ID",
        placeholder="재고를 추가할 상품 ID를 입력하세요",
        required=True,
        max_length=50
    )
    amount_input = TextInput(
        label="추가 수량",
        placeholder="예: 50",
        required=True,
        max_length=10
    )

    async def on_submit(self, interaction: discord.Interaction):
        try:
            product_id = self.product_id_input.value.strip()
            amount = int(self.amount_input.value.strip())

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
                f"📊 현재 재고: {bot.products[product_id]['stock']}개",
                ephemeral=True
            )

        except ValueError:
            await interaction.response.send_message("❌ 수량은 숫자로 입력해주세요.", ephemeral=True)


class AdminView(View):
    """관리자 패널"""
    def __init__(self):
        super().__init__(timeout=180)

    @discord.ui.button(label="상품 추가", style=discord.ButtonStyle.green, emoji="➕")
    async def add_product_button(self, interaction: discord.Interaction, button: Button):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자 권한이 필요합니다.", ephemeral=True)
            return

        modal = AdminProductModal()
        await interaction.response.send_modal(modal)

    @discord.ui.button(label="재고 추가", style=discord.ButtonStyle.blurple, emoji="📦")
    async def add_stock_button(self, interaction: discord.Interaction, button: Button):
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ 관리자 권한이 필요합니다.", ephemeral=True)
            return

        modal = AdminStockModal()
        await interaction.response.send_modal(modal)

    @discord.ui.button(label="상품 목록", style=discord.ButtonStyle.gray, emoji="📋")
    async def list_products_button(self, interaction: discord.Interaction, button: Button):
        if not bot.products:
            await interaction.response.send_message("❌ 등록된 상품이 없습니다.", ephemeral=True)
            return

        product_list = "📋 **등록된 상품 목록**\n\n"
        for product_id, product in bot.products.items():
            product_list += f"🆔 **ID**: `{product_id}`\n"
            product_list += f"📦 이름: {product['name']}\n"
            product_list += f"💰 가격: {product['price']:,}원\n"
            product_list += f"📊 재고: {product['stock']}개\n"
            product_list += f"📝 설명: {product['description']}\n\n"

        await interaction.response.send_message(product_list, ephemeral=True)


# ========================
# 관리자 명령어
# ========================

@bot.tree.command(name="관리자패널", description="[관리자] 관리자 패널을 엽니다")
async def admin_panel(interaction: discord.Interaction):
    """관리자 패널"""
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ 관리자 권한이 필요합니다.", ephemeral=True)
        return

    admin_info = (
        "🔧 **관리자 패널**\n\n"
        f"📊 등록된 상품 수: {len(bot.products)}개\n"
        f"👥 등록된 사용자 수: {len(bot.users)}명\n\n"
        "버튼을 사용하여 상품을 관리하세요."
    )

    view = AdminView()
    await interaction.response.send_message(admin_info, view=view, ephemeral=True)

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

# ========================
# Pushbullet 관리 명령어
# ========================

@bot.tree.command(name="pushbullet설정", description="[관리자] Pushbullet API 키를 설정합니다")
@app_commands.describe(api_key="Pushbullet API 키")
@is_admin()
async def setup_pushbullet(interaction: discord.Interaction, api_key: str):
    """Pushbullet API 키 설정"""
    if 'pushbullet' not in bot.config:
        bot.config['pushbullet'] = {}

    bot.config['pushbullet']['api_key'] = api_key
    bot.config['pushbullet']['enabled'] = False  # 기본값은 비활성화
    bot.save_config()

    info_msg = (
        "✅ **Pushbullet API 키가 설정되었습니다!**\n\n"
        "📱 **중요 안내:**\n"
        "• Pushbullet 알림 미러링은 **Android 기기만** 지원됩니다.\n"
        "• iOS(아이폰)는 지원되지 않습니다.\n\n"
        "🔧 **다음 단계:**\n"
        "1. Android 기기에 Pushbullet 앱 설치\n"
        "2. 같은 계정으로 로그인\n"
        "3. 알림 미러링 권한 허용\n"
        "4. `/pushbullet시작` 명령어로 연결 시작\n\n"
        "💡 **알림 형식:**\n"
        "```\n"
        "제목 또는 내용에 다음 형식 포함:\n"
        "충전 10000원\n"
        "사용자 ID: 123456789\n"
        "```"
    )

    await interaction.response.send_message(info_msg, ephemeral=True)

@bot.tree.command(name="pushbullet시작", description="[관리자] Pushbullet 알림 미러링을 시작합니다")
@is_admin()
async def start_pushbullet(interaction: discord.Interaction):
    """Pushbullet 리스너 시작"""
    await interaction.response.defer(ephemeral=True)

    api_key = bot.config.get('pushbullet', {}).get('api_key')

    if not api_key:
        await interaction.followup.send(
            "❌ Pushbullet API 키가 설정되지 않았습니다.\n"
            "`/pushbullet설정` 명령어로 먼저 API 키를 설정해주세요.",
            ephemeral=True
        )
        return

    if bot.pushbullet_thread and bot.pushbullet_thread.is_alive():
        await interaction.followup.send(
            "⚠️ Pushbullet 리스너가 이미 실행 중입니다.\n"
            "중지하려면 `/pushbullet중지` 명령어를 사용하세요.",
            ephemeral=True
        )
        return

    # 리스너 시작
    bot.config['pushbullet']['enabled'] = True
    bot.save_config()
    bot.start_pushbullet_listener()

    # 잠시 대기 후 상태 확인
    await asyncio.sleep(2)

    if bot.pushbullet_listener and bot.pushbullet_listener.running:
        status_msg = (
            "✅ **Pushbullet 알림 미러링 시작!**\n\n"
            "📱 **상태:** 연결됨\n"
            "🔔 **모드:** 자동 충전 활성화\n\n"
            "💡 **알림 형식 예시:**\n"
            "```\n"
            "제목: 충전 요청\n"
            "내용: 충전 10000원 사용자 ID: 123456789\n"
            "```\n\n"
            "⚠️ **주의:** Android 기기만 지원됩니다!"
        )
    else:
        status_msg = (
            "❌ Pushbullet 연결 실패\n\n"
            "다음을 확인해주세요:\n"
            "• API 키가 올바른지 확인\n"
            "• 인터넷 연결 상태 확인\n"
            "• 콘솔 로그에서 상세 오류 확인"
        )

    await interaction.followup.send(status_msg, ephemeral=True)

@bot.tree.command(name="pushbullet중지", description="[관리자] Pushbullet 알림 미러링을 중지합니다")
@is_admin()
async def stop_pushbullet(interaction: discord.Interaction):
    """Pushbullet 리스너 중지"""
    if not bot.pushbullet_listener or not bot.pushbullet_thread:
        await interaction.response.send_message(
            "⚠️ Pushbullet 리스너가 실행 중이 아닙니다.",
            ephemeral=True
        )
        return

    bot.stop_pushbullet_listener()
    bot.config['pushbullet']['enabled'] = False
    bot.save_config()

    await interaction.response.send_message(
        "✅ Pushbullet 알림 미러링이 중지되었습니다.",
        ephemeral=True
    )

@bot.tree.command(name="pushbullet상태", description="[관리자] Pushbullet 연결 상태를 확인합니다")
@is_admin()
async def pushbullet_status(interaction: discord.Interaction):
    """Pushbullet 상태 확인"""
    api_key_set = bool(bot.config.get('pushbullet', {}).get('api_key'))
    enabled = bot.config.get('pushbullet', {}).get('enabled', False)
    running = bot.pushbullet_thread and bot.pushbullet_thread.is_alive()

    # 자동 충전 로그 읽기
    log_count = 0
    if os.path.exists('auto_charge_log.json'):
        try:
            with open('auto_charge_log.json', 'r', encoding='utf-8') as f:
                logs = json.load(f)
                log_count = len(logs)
        except:
            pass

    status_msg = "🔧 **Pushbullet 상태**\n\n"
    status_msg += f"🔑 API 키 설정: {'✅ 설정됨' if api_key_set else '❌ 미설정'}\n"
    status_msg += f"⚙️ 활성화 상태: {'✅ 활성화' if enabled else '❌ 비활성화'}\n"
    status_msg += f"🔗 연결 상태: {'✅ 연결됨' if running else '❌ 연결 안됨'}\n"
    status_msg += f"📊 자동 충전 기록: {log_count}건\n\n"

    if not api_key_set:
        status_msg += "💡 `/pushbullet설정` 명령어로 API 키를 설정하세요.\n"
    elif not running:
        status_msg += "💡 `/pushbullet시작` 명령어로 연결을 시작하세요.\n"
    else:
        status_msg += "✅ 정상 작동 중입니다!\n"

    status_msg += "\n⚠️ **Android 기기만 지원됩니다.**"

    await interaction.response.send_message(status_msg, ephemeral=True)

@bot.tree.command(name="pushbullet패턴", description="[관리자] 알림 패턴을 설정합니다")
@app_commands.describe(
    charge_pattern="충전 금액 추출 패턴 (정규식)",
    user_id_pattern="사용자 ID 추출 패턴 (정규식)"
)
@is_admin()
async def set_pushbullet_pattern(
    interaction: discord.Interaction,
    charge_pattern: str = None,
    user_id_pattern: str = None
):
    """Pushbullet 알림 패턴 설정"""
    if 'pushbullet' not in bot.config:
        bot.config['pushbullet'] = {}

    updated = []

    if charge_pattern:
        bot.config['pushbullet']['charge_pattern'] = charge_pattern
        updated.append(f"충전 패턴: `{charge_pattern}`")

    if user_id_pattern:
        bot.config['pushbullet']['user_id_pattern'] = user_id_pattern
        updated.append(f"사용자 ID 패턴: `{user_id_pattern}`")

    if not updated:
        current_charge = bot.config.get('pushbullet', {}).get('charge_pattern', '설정 안됨')
        current_user = bot.config.get('pushbullet', {}).get('user_id_pattern', '설정 안됨')

        msg = (
            "🔧 **현재 패턴 설정**\n\n"
            f"💰 충전 패턴: `{current_charge}`\n"
            f"👤 사용자 ID 패턴: `{current_user}`\n\n"
            "💡 패턴을 변경하려면 파라미터를 입력하세요."
        )
    else:
        bot.save_config()
        msg = "✅ **패턴이 업데이트되었습니다!**\n\n" + "\n".join(updated)

    await interaction.response.send_message(msg, ephemeral=True)

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
