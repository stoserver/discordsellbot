import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { loadConfig } from './utils/data.js';
import { PushbulletService } from './services/pushbullet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

client.commands = new Collection();

/**
 * Load commands
 */
async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = await fs.readdir(commandsPath);

  const commands = [];

  for (const file of commandFiles) {
    if (!file.endsWith('.js')) continue;

    const filePath = join(commandsPath, file);
    const command = await import(`file://${filePath}`);
    const commandModule = command.default;

    if ('data' in commandModule && 'execute' in commandModule) {
      client.commands.set(commandModule.data.name, commandModule);
      commands.push(commandModule.data.toJSON());
      console.log(`[명령어] ${commandModule.data.name} 로드됨`);
    }
  }

  return commands;
}

/**
 * Register slash commands
 */
async function registerCommands(token, clientId, commands) {
  const rest = new REST().setToken(token);

  try {
    console.log(`[명령어] ${commands.length}개의 슬래시 명령어 등록 중...`);

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log('[명령어] 슬래시 명령어 등록 완료');
  } catch (error) {
    console.error('[명령어] 등록 실패:', error);
  }
}

/**
 * Bot ready event
 */
client.once('ready', async () => {
  console.log(`[봇] ${client.user.tag}로 로그인됨`);

  // Initialize Pushbullet service
  client.pushbulletService = new PushbulletService(client);

  try {
    const config = await loadConfig();
    if (config.pushbullet?.api_key) {
      await client.pushbulletService.start();
      console.log('[Pushbullet] 자동충전 시스템 활성화');
    } else {
      console.log('[Pushbullet] API 키가 설정되지 않음');
    }
  } catch (error) {
    console.error('[Pushbullet] 시작 실패:', error.message);
  }
});

/**
 * Interaction create event
 */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`[명령어] ${interaction.commandName}를 찾을 수 없음`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[명령어] 실행 오류:`, error);

    const errorMessage = {
      content: '❌ 명령어 실행 중 오류가 발생했습니다.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

/**
 * Error handling
 */
client.on('error', (error) => {
  console.error('[봇] 오류:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[Process] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught exception:', error);
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n[봇] 종료 중...');

  if (client.pushbulletService?.connected) {
    client.pushbulletService.stop();
  }

  await client.destroy();
  process.exit(0);
});

/**
 * Start bot
 */
async function start() {
  try {
    // Load config
    const config = await loadConfig();

    if (!config.token) {
      throw new Error('봇 토큰이 설정되지 않았습니다. data/config.json 파일을 확인해주세요.');
    }

    // Load commands
    const commands = await loadCommands();

    // Login
    await client.login(config.token);

    // Register commands after login
    await registerCommands(config.token, client.user.id, commands);
  } catch (error) {
    console.error('[봇] 시작 실패:', error);
    process.exit(1);
  }
}

start();
