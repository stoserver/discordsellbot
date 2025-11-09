import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');

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
  return await loadJSON('config.json');
}

/**
 * Save config
 * @param {Object} config
 */
export async function saveConfig(config) {
  await saveJSON('config.json', config);
}

/**
 * Load guilds data
 * @returns {Promise<Object>}
 */
export async function loadGuilds() {
  return await loadJSON('guilds.json');
}

/**
 * Save guilds data
 * @param {Object} guilds
 */
export async function saveGuilds(guilds) {
  await saveJSON('guilds.json', guilds);
}

/**
 * Load users data
 * @returns {Promise<Object>}
 */
export async function loadUsers() {
  return await loadJSON('users.json');
}

/**
 * Save users data
 * @param {Object} users
 */
export async function saveUsers(users) {
  await saveJSON('users.json', users);
}

/**
 * Load auto charge log
 * @returns {Promise<Array>}
 */
export async function loadAutoChargeLog() {
  try {
    const data = await loadJSON('auto_charge_log.json');
    return data.logs || [];
  } catch {
    return [];
  }
}

/**
 * Save auto charge log
 * @param {Array} logs
 */
export async function saveAutoChargeLog(logs) {
  await saveJSON('auto_charge_log.json', { logs });
}

/**
 * Add auto charge log entry (keep last 100)
 * @param {Object} entry
 */
export async function addAutoChargeLog(entry) {
  const logs = await loadAutoChargeLog();
  logs.unshift(entry);

  // Keep only last 100 entries
  if (logs.length > 100) {
    logs.splice(100);
  }

  await saveAutoChargeLog(logs);
}
