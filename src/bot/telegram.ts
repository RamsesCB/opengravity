import { Bot, InputFile } from 'grammy';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { processUserMessage } from '../agent/loop.js';
import { textToSpeech, setVoiceEnabled, isVoiceEnabled, isAutoRespondEnabled, getVoiceSettings, isConfigured, transcribeAudio as elevenTranscribe } from '../tts/elevenlabs.js';
import { isAudioSizeValid, formatAudioSize } from '../transcription/whisper.js';
import { tmpdir } from 'os';
import { writeFile, unlink } from 'fs/promises';

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
    
    const transcription = await elevenTranscribe(audioBuffer);
    if (transcription) {
      await ctx.reply(`📝 Transcripción:\n\n${transcription}`);
    } else {
      await ctx.reply('No pude transcribir el audio. Intenta de nuevo.');
    }
  } catch (error) {
    logger.error('Error transcribing voice:', error);
    await ctx.reply('Error al transcribir el audio. Intenta de nuevo.');
  }
});

bot.command('voice', async (ctx) => {
  const userId = ctx.from?.id.toString() || '';
  const message = ctx.message;
  if (!message) return;
  
  const args = message.text.split(' ').slice(1);
  const action = args[0]?.toLowerCase();
  
  if (!isConfigured()) {
    await ctx.reply('⚠️ ElevenLabs no está configurado. Agrega ELEVENLABS_API_KEY en las variables de entorno.');
    return;
  }
  
  if (action === 'on' || action === 'auto') {
    const autoRespond = action === 'auto';
    setVoiceEnabled(userId, true, autoRespond);
    await ctx.reply(autoRespond 
      ? '🔊 Voz activada. Siempre te responderé por voz.'
      : '🔊 Voz activada. Usa /hablar para que te responda por voz.');
  } else if (action === 'off') {
    setVoiceEnabled(userId, false);
    await ctx.reply('🔇 Voz desactivada.');
  } else {
    const settings = getVoiceSettings(userId);
    const status = settings.enabled 
      ? (settings.autoRespond ? '🔊 Auto (siempre)' : '🔊 Activado')
      : '🔇 Desactivado';
    
    await ctx.reply(`Estado de voz: ${status}\n\nUso: /voice on | auto | off\n- /voice on: Activa voz, usa /hablar\n- /voice auto: Siempre responde por voz\n- /voice off: Desactiva voz`);
  }
});

bot.command('hablar', async (ctx) => {
  const userId = ctx.from?.id.toString() || '';
  const message = ctx.message;
  if (!message) return;
  
  if (!isConfigured()) {
    await ctx.reply('⚠️ ElevenLabs no está configurado.');
    return;
  }
  
  if (!isVoiceEnabled(userId)) {
    await ctx.reply('🔇 Primero activa la voz con /voice on');
    return;
  }
  
  const args = ctx.message.text.split(' ').slice(1);
  const text = args.join(' ');
  
  if (!text) {
    await ctx.reply('Escribe el texto que quieres que diga. Ejemplo: /hablar Hola mundo');
    return;
  }
  
  await ctx.reply('🎤 Generando audio...');
  
  try {
    const audioBuffer = await textToSpeech(text);
    if (audioBuffer) {
      const tempFile = `${tmpdir()}/voice_${Date.now()}.mp3`;
      await writeFile(tempFile, audioBuffer);
      await ctx.replyWithVoice(new InputFile(tempFile));
      await unlink(tempFile).catch(() => {});
    } else {
      await ctx.reply('Error al generar el audio.');
    }
  } catch (error) {
    logger.error('Error generating speech:', error);
    await ctx.reply('Error al generar el audio.');
  }
});

async function sendVoiceReply(ctx: any, text: string) {
  try {
    const audioBuffer = await textToSpeech(text);
    if (audioBuffer) {
      const tempFile = `${tmpdir()}/voice_${Date.now()}.mp3`;
      await writeFile(tempFile, audioBuffer);
      await ctx.replyWithVoice(new InputFile(tempFile));
      await unlink(tempFile).catch(() => {});
    } else {
      await ctx.reply(text);
    }
  } catch {
    await ctx.reply(text);
  }
}

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
    
    const transcription = await elevenTranscribe(audioBuffer);
    
    if (!transcription) {
      await ctx.reply('No pude transcribir el audio. Intenta de nuevo.');
      return;
    }
    
    // Process the transcribed text with the LLM
    const reply = await processUserMessage(userId, transcription);
    
    if (reply) {
      if (isAutoRespondEnabled(userId) && isVoiceEnabled(userId)) {
        await sendVoiceReply(ctx, reply);
      } else {
        await ctx.reply(reply);
      }
    }
    
  } catch (error) {
    logger.error('Error handling voice message:', error);
    await ctx.reply("Error al procesar el audio. Intenta de nuevo.");
  }
});

// Ignore other commands manually for now or pass them to the LLM
bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id.toString() || '';
  const message = ctx.message;
  if (!message) return;
  
  const text = message.text;

  logger.info(`Received message from ${userId}: ${text}`);

  // Typing indicator
  await ctx.api.sendChatAction(ctx.chat.id, 'typing');

  try {
    const reply = await processUserMessage(userId, text);
    if (reply) {
      if (isAutoRespondEnabled(userId) && isVoiceEnabled(userId)) {
        await sendVoiceReply(ctx, reply);
      } else {
        await ctx.reply(reply);
      }
    }
  } catch (error) {
    logger.error('Error handling message:', error);
    await ctx.reply("Lo siento, ocurrió un error procesando tu mensaje.");
  }
});
