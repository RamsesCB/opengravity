import { Bot } from 'grammy';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { processUserMessage } from '../agent/loop.js';
import { transcribeAudio, isAudioSizeValid, formatAudioSize } from '../transcription/whisper.js';

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

bot.command('transcribe', async (ctx) => {
  const voice = ctx.message?.voice;
  if (!voice) {
    await ctx.reply('Envía una nota de voz para transcribirla.');
    return;
  }
  
  await ctx.reply('🎤 Transcribiendo audio...');
  
  try {
    const file = await ctx.api.getFile(voice.file_id);
    const audioUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    const response = await fetch(audioUrl);
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    if (!isAudioSizeValid(audioBuffer.length)) {
      await ctx.reply(`El audio es muy grande (${formatAudioSize(audioBuffer.length)}). Máximo 20MB.`);
      return;
    }
    
    const transcription = await transcribeAudio(audioBuffer);
    await ctx.reply(`📝 Transcripción:\n\n${transcription}`);
  } catch (error) {
    logger.error('Error transcribing voice:', error);
    await ctx.reply('Error al transcribir el audio. Intenta de nuevo.');
  }
});

bot.on('message:voice', async (ctx) => {
  const userId = ctx.from.id.toString();
  const voice = ctx.message.voice;
  
  logger.info(`Received voice message from ${userId}`);
  
  await ctx.api.sendChatAction(ctx.chat.id, 'typing');
  
  try {
    const file = await ctx.api.getFile(voice.file_id);
    const audioUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    const response = await fetch(audioUrl);
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    if (!isAudioSizeValid(audioBuffer.length)) {
      await ctx.reply(`El audio es muy grande (${formatAudioSize(audioBuffer.length)}). Máximo 20MB. Envía /transcribe para una transcripción más detallada.`);
      return;
    }
    
    const transcription = await transcribeAudio(audioBuffer);
    
    await ctx.reply(`🎤 Transcripción:\n\n${transcription}\n\n¿quieres que procese esto con la IA?`);
    
  } catch (error) {
    logger.error('Error handling voice message:', error);
    await ctx.reply("Error al transcribir el audio. Intenta de nuevo o usa /transcribe.");
  }
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
