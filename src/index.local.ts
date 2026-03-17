import { bot } from './bot/telegram.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import './tools/get_current_time.js';

process.once('SIGINT', () => {
    bot.stop();
    logger.info("Bot stopped via SIGINT");
});
process.once('SIGTERM', () => {
    bot.stop();
    logger.info("Bot stopped via SIGTERM");
});

async function start() {
  logger.info("Starting OpenGravity Local (Long Polling)...");
  logger.info(`Allowed users: ${config.TELEGRAM_ALLOWED_USER_IDS.join(', ')}`);
  
  await bot.start({
     drop_pending_updates: true,
  });
}

start().catch(err => {
  logger.error("Failed to start:", err);
  process.exit(1);
});
