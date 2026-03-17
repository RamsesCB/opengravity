import express from 'express';
import { bot } from './bot/telegram.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import './tools/get_current_time.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('OpenGravity Bot is running!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post(`/webhook/${config.TELEGRAM_BOT_TOKEN}`, async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    logger.error('Error handling update:', error);
    res.sendStatus(500);
  }
});

async function startWebhook() {
  logger.info("Starting OpenGravity Webhook Server...");
  logger.info(`Allowed users: ${config.TELEGRAM_ALLOWED_USER_IDS.join(', ')}`);
  logger.info(`Webhook URL: https://your-render-url.onrender.com/webhook/${config.TELEGRAM_BOT_TOKEN}`);

  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn("WEBHOOK_URL not set. Set webhook URL manually or configure in Render.");
  } else {
    await bot.api.setWebhook(webhookUrl);
    logger.info(`Webhook set to: ${webhookUrl}`);
  }

  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}

process.once('SIGINT', () => {
  bot.stop();
  logger.info("Bot stopped via SIGINT");
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop();
  logger.info("Bot stopped via SIGTERM");
  process.exit(0);
});

startWebhook().catch(err => {
  logger.error("Failed to start:", err);
  process.exit(1);
});
