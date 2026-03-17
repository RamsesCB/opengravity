import { Bot } from 'grammy';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { processUserMessage } from '../agent/loop.js';

export const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

// Auth middleware
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return; // Ignore updates without user

  if (!config.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
    logger.warn(`Unauthorized access attempt from User ID: ${userId}`);
    return;
  }
  
  await next();
});

bot.command('start', (ctx) => {
  ctx.reply("Hola, soy OpenGravity. Tu agente personal. ¿En qué puedo ayudarte?");
});

// Ignore other commands manually for now or pass them to the LLM
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const text = ctx.message.text;

  logger.info(`Received message from ${userId}: ${text}`);

  // Typing indicator
  await ctx.api.sendChatAction(ctx.chat.id, 'typing');

  try {
    const reply = await processUserMessage(userId, text);
    if (reply) {
      await ctx.reply(reply);
    }
  } catch (error) {
    logger.error('Error handling message:', error);
    await ctx.reply("Lo siento, ocurrió un error procesando tu mensaje.");
  }
});
