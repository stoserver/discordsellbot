# Discord Auto Charge Bot

Discord 봇과 Pushbullet을 연동한 자동 충전 시스템입니다.

> **v2.0.0**: Python에서 JavaScript (Node.js)로 전환되었습니다. 기존 Python 버전은 `legacy/` 폴더에 보관되어 있습니다.

## 주요 기능

- **서버별 등록 시스템**: `/등록` 명령어로 서버에서 봇을 활성화
- **자동 충전**: Pushbullet 알림을 감지하여 자동으로 포인트 충전
- **관리자 수동 충전**: `/충전` 명령어로 사용자에게 직접 포인트 지급
- **실시간 연결**: WebSocket을 통한 Pushbullet 실시간 알림 수신
- **자동 재연결**: 연결 끊김 시 자동으로 재연결 시도
- **커스텀 패턴**: 정규식으로 알림 파싱 패턴 커스터마이징 가능

## 설치 방법

### 1. 저장소 클론

```bash
git clone <repository-url>
cd discordsellbot
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 설정 파일 생성

`data/config.json` 파일을 생성하고 아래 내용을 입력:

```json
{
  "token": "YOUR_DISCORD_BOT_TOKEN",
  "pushbullet": {
    "api_key": "YOUR_PUSHBULLET_API_KEY",
    "charge_pattern": "충전\\s*(\\d+)원?",
    "user_id_pattern": "사용자\\s*ID[:\\s]*(\\d+)"
  }
}
```

### 4. Discord 봇 토큰 발급

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 봇 생성
2. Bot 탭에서 토큰 복사
3. `config.json`의 `token`에 입력

### 5. Pushbullet API 키 발급

1. [Pushbullet Settings](https://www.pushbullet.com/#settings/account)에서 API 키 생성
2. `config.json`의 `pushbullet.api_key`에 입력 (또는 `/pushbullet설정` 명령어 사용)

### 6. 봇 실행

```bash
npm start
```

개발 모드 (자동 재시작):

```bash
npm run dev
```

## 프로젝트 구조

```
discordsellbot/
├── src/
│   ├── bot.js                    # 메인 봇 파일
│   ├── commands/                 # 슬래시 명령어
│   │   ├── register.js          # /등록
│   │   ├── charge.js            # /충전
│   │   ├── pushbullet-setup.js  # /pushbullet설정
│   │   ├── pushbullet-pattern.js # /pushbullet패턴
│   │   └── pushbullet-status.js # /pushbullet상태
│   ├── services/
│   │   └── pushbullet.js        # Pushbullet WebSocket 서비스
│   └── utils/
│       └── data.js              # JSON 데이터 관리
├── data/
│   ├── config.json              # 봇 설정 (gitignore)
│   ├── guilds.json              # 등록된 서버 목록 (gitignore)
│   ├── users.json               # 사용자 잔액 데이터 (gitignore)
│   └── auto_charge_log.json     # 자동충전 로그 (gitignore)
├── legacy/                      # 기존 Python 파일들
└── package.json
```

## 사용 방법

### 서버 등록 (관리자 전용)

서버에서 봇을 사용하려면 먼저 등록이 필요합니다:

```
/등록
```

이 명령어는 자동으로 Pushbullet 연결을 시작합니다.

### 수동 충전 (관리자 전용)

사용자에게 포인트를 수동으로 충전:

```
/충전 사용자:@user 금액:10000
```

### Pushbullet 설정 (관리자 전용)

API 키 설정 또는 변경:

```
/pushbullet설정 api_key:YOUR_API_KEY
```

### 알림 패턴 커스터마이징 (관리자 전용)

자동충전 시 사용할 정규식 패턴 변경:

```
/pushbullet패턴 충전패턴:충전\s*(\d+)원? 사용자id패턴:사용자\s*ID[:\s]*(\d+)
```

**기본 패턴 예시:**

알림 내용이 다음과 같다면:
```
충전 10000원
사용자 ID: 123456789
```

위 패턴이 자동으로 추출하여 사용자 `123456789`에게 `10000`원을 충전합니다.

### 연결 상태 확인

Pushbullet 연결 상태 및 설정 확인:

```
/pushbullet상태
```

## 자동 충전 작동 방식

1. Android 기기에 Pushbullet 앱 설치 및 로그인
2. 충전 관련 알림이 오면 Pushbullet이 자동으로 미러링
3. 봇이 WebSocket으로 실시간 수신
4. 설정된 정규식 패턴으로 금액과 사용자 ID 추출
5. 자동으로 해당 사용자에게 포인트 충전
6. DM으로 충전 알림 전송

## 데이터 구조

### guilds.json

```json
{
  "guild_id": {
    "name": "서버 이름",
    "registered_at": "2024-01-01T00:00:00.000Z",
    "enabled": true
  }
}
```

### users.json

```json
{
  "user_id": {
    "balance": 10000,
    "charges": [
      {
        "amount": 10000,
        "timestamp": "2024-01-01T00:00:00.000Z",
        "method": "auto",
        "notification": "충전 10000원..."
      }
    ]
  }
}
```

### auto_charge_log.json

```json
{
  "logs": [
    {
      "user_id": "123456789",
      "amount": 10000,
      "timestamp": "2024-01-01T00:00:00.000Z",
      "notification": "충전 10000원..."
    }
  ]
}
```

## 요구사항

- Node.js 18 이상
- Discord 봇 토큰
- Pushbullet API 키
- Android 기기 (iOS는 알림 미러링 미지원)

## 주의사항

- `data/config.json` 파일은 민감한 정보를 포함하므로 절대 공개하지 마세요
- Pushbullet API 키는 개인 키이므로 안전하게 관리하세요
- iOS는 알림 미러링을 지원하지 않으므로 Android 기기가 필요합니다

## 문제 해결

### 봇이 시작되지 않음

- `data/config.json`에 올바른 Discord 봇 토큰이 입력되었는지 확인
- Node.js 버전이 18 이상인지 확인

### Pushbullet 연결 실패

- API 키가 올바른지 확인
- 네트워크 연결 상태 확인
- `/pushbullet상태` 명령어로 상태 확인

### 자동 충전이 작동하지 않음

- 정규식 패턴이 알림 내용과 일치하는지 확인
- `/pushbullet패턴` 명령어로 패턴 수정
- Android 기기에서 Pushbullet이 실행 중인지 확인

## 라이선스

MIT License

## 변경 이력

### v2.0.0 (JavaScript 버전)

- Python에서 JavaScript (Node.js)로 전환
- 서버별 등록 시스템 추가
- 사용자 기능 (자판기, 상품 구매 등) 제거
- Pushbullet 자동 시작/중지 기능 제거 (등록 시 자동 활성화)
- 모듈화된 구조로 재구성

### v1.0.0 (Python 버전)

- 초기 버전 (legacy 폴더에 보관)
- 자판기 UI 및 상품 관리 기능
- Pushbullet 자동충전 시스템
