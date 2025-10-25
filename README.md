# 디스코드 자판기 봇

Discord에서 사용할 수 있는 자판기 봇입니다. 사용자들은 포인트를 사용하여 상품을 구매할 수 있습니다.

## 주요 기능

### 사용자 기능 (인터랙티브 UI)
- **자판기 패널**: 버튼과 드롭다운으로 편리한 쇼핑
- **상품 선택**: 드롭다운 메뉴에서 상품 선택
- **수량 입력**: 모달 팝업으로 수량 입력
- **잔액 확인**: 버튼 클릭으로 즉시 확인
- **구매 내역**: 최근 구매 내역 조회

### 관리자 기능 (인터랙티브 UI)
- **관리자 패널**: 버튼 기반 관리 인터페이스
- **상품 추가**: 모달 폼으로 간편한 상품 등록
- **재고 관리**: 버튼으로 재고 추가
- **상품 목록 조회**: 등록된 상품 확인
- **포인트 충전**: 사용자에게 포인트 지급

## 설치 방법

### 1. 필요한 패키지 설치

```bash
pip install -r requirements.txt
```

### 2. 디스코드 봇 생성

1. [Discord Developer Portal](https://discord.com/developers/applications)에 접속
2. "New Application" 클릭하여 새 애플리케이션 생성
3. "Bot" 메뉴에서 봇 생성
4. "Reset Token"을 클릭하여 토큰 복사
5. "Privileged Gateway Intents"에서 다음 항목 활성화:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent

### 3. 봇 초대하기

1. "OAuth2" > "URL Generator" 메뉴로 이동
2. "SCOPES"에서 `bot`과 `applications.commands` 선택
3. "BOT PERMISSIONS"에서 다음 권한 선택:
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
4. 생성된 URL로 봇을 서버에 초대

### 4. 설정 파일 구성

`config.json` 파일을 열어 봇 토큰을 입력합니다:

```json
{
  "token": "여기에_봇_토큰_입력"
}
```

### 5. 봇 실행

```bash
python bot.py
```

## 슬래시 커맨드 사용법

### 메인 명령어 (UI 기반)

#### `/자판기`
**인터랙티브 자판기 패널을 엽니다** (권장!)
- 드롭다운 메뉴에서 상품 선택
- 모달 창에서 수량 입력
- 버튼으로 잔액 확인, 구매 내역 조회
- 실시간 상품 새로고침

**사용 방법:**
1. `/자판기` 명령어 입력
2. 드롭다운 메뉴에서 원하는 상품 선택
3. 팝업 창에서 구매 수량 입력
4. 하단 버튼으로 잔액/내역 확인

#### `/관리자패널`
**관리자 전용 패널을 엽니다** (관리자만)
- 버튼으로 상품 추가
- 버튼으로 재고 추가
- 상품 목록 조회

### 사용자 명령어 (텍스트 기반)

#### `/상품목록`
구매 가능한 모든 상품의 목록을 임베드로 확인합니다.
- 상품명, 가격, 설명, 재고 정보 표시
- 각 상품의 ID 확인 가능

#### `/잔액`
현재 내 포인트 잔액을 확인합니다.

#### `/구매 [product_id] [quantity]`
상품을 구매합니다.
- `product_id`: 구매할 상품의 ID
- `quantity`: 구매 수량 (기본값: 1)

예시:
```
/구매 product_id:product1 quantity:2
```

#### `/구매내역`
최근 10개의 구매 내역을 확인합니다.
- 구매 상품, 수량, 금액, 구매 시각 표시

### 관리자 명령어

#### `/상품추가 [product_id] [name] [price] [description] [stock]`
새로운 상품을 등록합니다.
- `product_id`: 상품의 고유 ID
- `name`: 상품 이름
- `price`: 가격 (정수)
- `description`: 상품 설명
- `stock`: 초기 재고

예시:
```
/상품추가 product_id:cola name:콜라 price:1500 description:시원한_콜라 stock:100
```

#### `/상품삭제 [product_id]`
등록된 상품을 삭제합니다.
- `product_id`: 삭제할 상품의 ID

예시:
```
/상품삭제 product_id:cola
```

#### `/재고추가 [product_id] [amount]`
상품의 재고를 추가합니다.
- `product_id`: 상품 ID
- `amount`: 추가할 재고 수량

예시:
```
/재고추가 product_id:cola amount:50
```

#### `/충전 [user] [amount]`
사용자에게 포인트를 충전합니다.
- `user`: 충전할 사용자 멘션
- `amount`: 충전할 금액

예시:
```
/충전 user:@사용자 amount:10000
```

## 데이터 저장

봇은 다음 두 개의 JSON 파일에 데이터를 저장합니다:

### `products.json`
상품 정보를 저장합니다.
```json
{
  "product1": {
    "name": "콜라",
    "price": 1500,
    "description": "시원한 콜라",
    "stock": 100
  }
}
```

### `users.json`
사용자 정보와 구매 내역을 저장합니다.
```json
{
  "123456789012345678": {
    "balance": 10000,
    "purchases": [
      {
        "product_id": "product1",
        "product_name": "콜라",
        "quantity": 2,
        "total_price": 3000,
        "timestamp": "2025-10-25T12:00:00"
      }
    ]
  }
}
```

## 구조

```
discordsellbot/
├── bot.py                    # 메인 봇 파일
├── config.json               # 봇 설정 (토큰)
├── requirements.txt          # Python 패키지 의존성
├── products.json             # 상품 데이터 (자동 생성)
├── users.json                # 사용자 데이터 (자동 생성)
├── products.example.json     # 상품 데이터 예시
├── users.example.json        # 사용자 데이터 예시
└── README.md                 # 이 파일
```

## 주의사항

- 관리자 명령어는 서버 관리자 권한이 있는 사용자만 사용할 수 있습니다
- 데이터는 JSON 파일로 저장되므로 정기적으로 백업하는 것이 좋습니다
- 봇 토큰은 절대 공개하지 마세요
- `config.json`은 `.gitignore`에 추가하는 것을 권장합니다

## 향후 개선 사항

- [ ] 데이터베이스 연동 (SQLite, PostgreSQL 등)
- [ ] 결제 시스템 통합
- [ ] 상품 카테고리 기능
- [ ] 할인/쿠폰 시스템
- [ ] 구매 제한 기능
- [ ] 통계 및 리포트 기능

## 라이선스

MIT License

## 문의

버그 리포트나 기능 제안은 이슈로 등록해주세요.
