import WebSocket from 'ws';
import { loadConfig, loadUsers, saveUsers, addAutoChargeLog } from '../utils/data.js';

export class PushbulletService {
  constructor(client) {
    this.client = client;
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }

  /**
   * Start Pushbullet WebSocket connection
   */
  async start() {
    const config = await loadConfig();

    if (!config.pushbullet?.api_key) {
      throw new Error('Pushbullet API 키가 설정되지 않았습니다.');
    }

    if (this.connected) {
      throw new Error('이미 연결되어 있습니다.');
    }

    this.connect(config.pushbullet.api_key);
  }

  /**
   * Connect to Pushbullet WebSocket
   */
  connect(apiKey) {
    const wsUrl = `wss://stream.pushbullet.com/websocket/${apiKey}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('[Pushbullet] WebSocket 연결됨');
      this.connected = true;
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('error', (error) => {
      console.error('[Pushbullet] WebSocket 오류:', error.message);
    });

    this.ws.on('close', () => {
      console.log('[Pushbullet] WebSocket 연결 종료');
      this.connected = false;

      // Auto reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`[Pushbullet] 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
        setTimeout(() => {
          this.start().catch(err => {
            console.error('[Pushbullet] 재연결 실패:', err.message);
          });
        }, this.reconnectDelay);
      }
    });
  }

  /**
   * Stop Pushbullet connection
   */
  stop() {
    if (!this.connected) {
      throw new Error('연결되어 있지 않습니다.');
    }

    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(data) {
    try {
      const message = JSON.parse(data);

      if (message.type === 'tickle' && message.subtype === 'push') {
        // Fetch latest push
        await this.checkLatestPush();
      } else if (message.type === 'push') {
        // Direct push notification
        await this.handleNotification(message.push);
      }
    } catch (error) {
      console.error('[Pushbullet] 메시지 처리 오류:', error);
    }
  }

  /**
   * Check latest push from Pushbullet API
   */
  async checkLatestPush() {
    try {
      const config = await loadConfig();
      const response = await fetch('https://api.pushbullet.com/v2/pushes?limit=1', {
        headers: {
          'Access-Token': config.pushbullet.api_key
        }
      });

      const data = await response.json();
      if (data.pushes && data.pushes.length > 0) {
        await this.handleNotification(data.pushes[0]);
      }
    } catch (error) {
      console.error('[Pushbullet] Push 확인 오류:', error);
    }
  }

  /**
   * Handle notification and auto-charge
   */
  async handleNotification(push) {
    try {
      // Only process mirror notifications
      if (push.type !== 'mirror') {
        return;
      }

      const config = await loadConfig();
      const chargePattern = new RegExp(config.pushbullet.charge_pattern || '충전\\s*(\\d+)원?');
      const userIdPattern = new RegExp(config.pushbullet.user_id_pattern || '사용자\\s*ID[:\\s]*(\\d+)');

      const notificationText = push.body || push.title || '';

      // Extract charge amount
      const chargeMatch = notificationText.match(chargePattern);
      if (!chargeMatch) {
        return;
      }

      const amount = parseInt(chargeMatch[1]);

      // Extract user ID
      const userIdMatch = notificationText.match(userIdPattern);
      if (!userIdMatch) {
        console.log('[Pushbullet] 사용자 ID를 찾을 수 없습니다.');
        return;
      }

      const userId = userIdMatch[1];

      // Auto charge
      await this.autoCharge(userId, amount, notificationText);
    } catch (error) {
      console.error('[Pushbullet] 알림 처리 오류:', error);
    }
  }

  /**
   * Auto charge user
   */
  async autoCharge(userId, amount, notificationText) {
    try {
      const users = await loadUsers();

      if (!users[userId]) {
        users[userId] = {
          balance: 0,
          charges: []
        };
      }

      users[userId].balance += amount;
      users[userId].charges = users[userId].charges || [];
      users[userId].charges.unshift({
        amount,
        timestamp: new Date().toISOString(),
        method: 'auto',
        notification: notificationText
      });

      await saveUsers(users);

      // Log
      await addAutoChargeLog({
        user_id: userId,
        amount,
        timestamp: new Date().toISOString(),
        notification: notificationText
      });

      console.log(`[Pushbullet] 자동 충전 완료: 사용자 ${userId}, 금액 ${amount}원`);

      // Send DM to user
      try {
        const user = await this.client.users.fetch(userId);
        await user.send(`✅ **자동 충전 완료**\n금액: ${amount.toLocaleString()}원\n현재 잔액: ${users[userId].balance.toLocaleString()}원`);
      } catch (error) {
        console.error('[Pushbullet] DM 전송 실패:', error.message);
      }
    } catch (error) {
      console.error('[Pushbullet] 자동 충전 오류:', error);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}
