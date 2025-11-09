import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const GUILDS_DIR = path.join(DATA_DIR, 'guilds');

/**
 * Load JSON file
 * @param {string} filename
 * @returns {Promise<Object>}
 */
export async function loadJSON(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

/**
 * Save JSON file
 * @param {string} filename
 * @param {Object} data
 */
export async function saveJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Load config
 * @returns {Promise<Object>}
 */
export async function loadConfig() {
  try {
    return await loadJSON('config.json');
  } catch {
    return { license_admins: [] };
  }
}

/**
 * Save config
 * @param {Object} config
 */
export async function saveConfig(config) {
  await saveJSON('config.json', config);
}

/**
 * Load licenses
 * @returns {Promise<Object>}
 */
export async function loadLicenses() {
  try {
    return await loadJSON('licenses.json');
  } catch {
    return {};
  }
}

/**
 * Save licenses
 * @param {Object} licenses
 */
export async function saveLicenses(licenses) {
  await saveJSON('licenses.json', licenses);
}

/**
 * Load guild data
 * @param {string} guildId
 * @returns {Promise<Object|null>}
 */
export async function loadGuildData(guildId) {
  try {
    const filePath = path.join(GUILDS_DIR, `${guildId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Save guild data
 * @param {string} guildId
 * @param {Object} data
 */
export async function saveGuildData(guildId, data) {
  const filePath = path.join(GUILDS_DIR, `${guildId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Create new guild data
 * @param {string} guildId
 * @param {string} guildName
 * @returns {Object}
 */
export function createGuildData(guildId, guildName) {
  return {
    guild_id: guildId,
    name: guildName,
    registered_at: new Date().toISOString(),
    plan: 'free',
    license_code: null,
    license_expires_at: null,
    pushbullet: {
      api_key: null,
      charge_pattern: '충전\\s*(\\d+)원?',
      user_id_pattern: '사용자\\s*ID[:\\s]*(\\d+)'
    },
    categories: {},
    products: {},
    users: {}
  };
}

/**
 * Get plan limits
 * @param {string} plan
 * @returns {Object}
 */
export function getPlanLimits(plan) {
  switch (plan) {
    case 'free':
      return {
        maxCategories: 1,
        maxProducts: 3,
        canUseSelfBot: false
      };
    case 'pro':
      return {
        maxCategories: Infinity,
        maxProducts: Infinity,
        canUseSelfBot: false
      };
    case 'premium':
      return {
        maxCategories: Infinity,
        maxProducts: Infinity,
        canUseSelfBot: true
      };
    default:
      return {
        maxCategories: 1,
        maxProducts: 3,
        canUseSelfBot: false
      };
  }
}

/**
 * Check if guild can add category
 * @param {Object} guildData
 * @returns {boolean}
 */
export function canAddCategory(guildData) {
  const limits = getPlanLimits(guildData.plan);
  const currentCount = Object.keys(guildData.categories || {}).length;
  return currentCount < limits.maxCategories;
}

/**
 * Check if guild can add product
 * @param {Object} guildData
 * @returns {boolean}
 */
export function canAddProduct(guildData) {
  const limits = getPlanLimits(guildData.plan);
  const currentCount = Object.keys(guildData.products || {}).length;
  return currentCount < limits.maxProducts;
}

/**
 * Add auto charge log
 * @param {string} guildId
 * @param {string} userId
 * @param {number} amount
 * @param {string} notification
 */
export async function addChargeLog(guildId, userId, amount, notification) {
  const guildData = await loadGuildData(guildId);
  if (!guildData) return;

  if (!guildData.users[userId]) {
    guildData.users[userId] = {
      balance: 0,
      charges: [],
      purchases: []
    };
  }

  guildData.users[userId].charges.unshift({
    amount,
    timestamp: new Date().toISOString(),
    method: 'auto',
    notification
  });

  // Keep last 50 charges per user
  if (guildData.users[userId].charges.length > 50) {
    guildData.users[userId].charges.splice(50);
  }

  await saveGuildData(guildId, guildData);
}
