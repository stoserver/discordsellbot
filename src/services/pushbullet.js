import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGuildData, saveGuildData } from '../utils/data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GUILDS_DIR = path.join(__dirname, '../../data/guilds');

export class PushbulletService {
  constructor(client) {
    this.client = client;
    this.pollingInterval = null;
    this.lastChecks = new Map(); // guild_id -> last_check_timestamp
  }

  /**
   * Start Pushbullet polling service
   */
  async start() {
    console.log('[Pushbullet] 자동충전 서비스 시작');

    // Poll every 10 seconds
    this.pollingInterval = setInterval(async () => {
      await this.checkAllGuilds();
    }, 10000);

    // Initial check
    await this.checkAllGuilds();
  }

  /**
   * Stop Pushbullet service
   */
  stop() {
    console.log('[Pushbullet] 자동충전 서비스 중지');
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Check all guilds for new pushes
   */
  async checkAllGuilds() {
    try {
      const files = await fs.readdir(GUILDS_DIR);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const guildId = file.replace('.json', '');
        await this.checkGuild(guildId);
      }
    } catch (error) {
      // Directory doesn't exist yet or other error
      if (error.code !== 'ENOENT') {
        console.error('[Pushbullet] 서버 확인 오류:', error);
      }
    }
  }

  /**
   * Check a single guild for new pushes
   */
  async checkGuild(guildId) {
    try {
      const guildData = await loadGuildData(guildId);
      if (!guildData || !guildData.pushbullet?.api_key) {
        return;
      }

      const lastCheck = this.lastChecks.get(guildId) || 0;
      const now = Date.now() / 1000; // Unix timestamp

      // Fetch pushes since last check
      const response = await fetch(`https://api.pushbullet.com/v2/pushes?modified_after=${lastCheck}`, {
        headers: {
          'Access-Token': guildData.pushbullet.api_key
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error(`[Pushbullet] 서버 ${guildId}: 잘못된 API 키`);
        }
        return;
      }

      const data = await response.json();
      this.lastChecks.set(guildId, now);

      if (!data.pushes || data.pushes.length === 0) {
        return;
      }

      // Process each push
      for (const push of data.pushes) {
        if (push.type === 'mirror' && !push.dismissed) {
          await this.handleNotification(guildId, guildData, push);
        }
      }
    } catch (error) {
      console.error(`[Pushbullet] 서버 ${guildId} 확인 오류:`, error.message);
    }
  }

  /**
   * Handle notification and auto-charge
   */
  async handleNotification(guildId, guildData, push) {
    try {
      const chargePattern = new RegExp(guildData.pushbullet.charge_pattern || '충전\\s*(\\d+)원?');
      const userIdPattern = new RegExp(guildData.pushbullet.user_id_pattern || '사용자\\s*ID[:\\s]*(\\d+)');

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
        console.log(`[Pushbullet] 서버 ${guildId}: 사용자 ID를 찾을 수 없음`);
        return;
      }

      const userId = userIdMatch[1];

      // Auto charge
      await this.autoCharge(guildId, guildData, userId, amount, notificationText);
    } catch (error) {
      console.error(`[Pushbullet] 서버 ${guildId} 알림 처리 오류:`, error);
    }
  }

  /**
   * Auto charge user
   */
  async autoCharge(guildId, guildData, userId, amount, notificationText) {
    try {
      if (!guildData.users[userId]) {
        guildData.users[userId] = {
          balance: 0,
          charges: [],
          purchases: []
        };
      }

      guildData.users[userId].balance += amount;
      guildData.users[userId].charges.unshift({
        amount,
        timestamp: new Date().toISOString(),
        method: 'auto',
        notification: notificationText
      });

      // Keep last 50 charges
      if (guildData.users[userId].charges.length > 50) {
        guildData.users[userId].charges.splice(50);
      }

      await saveGuildData(guildId, guildData);

      console.log(`[Pushbullet] 서버 ${guildId}: 자동 충전 완료 - 사용자 ${userId}, 금액 ${amount}원`);

      // Send DM to user
      try {
        const user = await this.client.users.fetch(userId);
        await user.send(`✅ **자동 충전 완료**\n서버: ${guildData.name}\n금액: ${amount.toLocaleString()}원\n현재 잔액: ${guildData.users[userId].balance.toLocaleString()}원`);
      } catch (error) {
        console.error(`[Pushbullet] DM 전송 실패:`, error.message);
      }
    } catch (error) {
      console.error(`[Pushbullet] 서버 ${guildId} 자동 충전 오류:`, error);
    }
  }
}
