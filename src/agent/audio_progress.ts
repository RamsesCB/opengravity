import { logger } from '../utils/logger.js';
import { InputFile } from 'grammy';
import { textToSpeech, isVoiceEnabled, isAutoRespondEnabled } from '../tts/elevenlabs.js';

export interface ProgressMessage {
  step: number;
  totalSteps: number;
  message: string;
}

export async function sendProgressAudio(
  ctx: any,
  userId: string,
  progress: ProgressMessage
): Promise<void> {
  const voiceEnabled = isVoiceEnabled(userId);
  const autoRespond = isAutoRespondEnabled(userId);
  
  const audioMessage = generarMensajeProgreso(progress);
  
  if (voiceEnabled && autoRespond) {
    try {
      const audioBuffer = await textToSpeech(audioMessage);
      if (audioBuffer) {
        await ctx.replyWithVoice(new InputFile(audioBuffer));
        logger.info(`Sent progress audio: ${audioMessage}`);
      } else {
        await ctx.reply(audioMessage);
      }
    } catch (error) {
      logger.error('Error sending progress audio:', error);
      await ctx.reply(audioMessage);
    }
  } else {
    await ctx.reply(audioMessage);
  }
}

export async function sendProgressText(
  ctx: any,
  progress: ProgressMessage
): Promise<void> {
  const message = generarMensajeProgreso(progress);
  await ctx.reply(message);
}

export async function sendAudioMessage(
  ctx: any,
  userId: string,
  message: string
): Promise<void> {
  const voiceEnabled = isVoiceEnabled(userId);
  const autoRespond = isAutoRespondEnabled(userId);
  
  if (voiceEnabled && autoRespond) {
    try {
      const audioBuffer = await textToSpeech(message);
      if (audioBuffer) {
        await ctx.replyWithVoice(new InputFile(audioBuffer));
        logger.info(`Sent audio message: ${message}`);
        return;
      }
    } catch (error) {
      logger.error('Error sending audio message:', error);
    }
  }
  
  await ctx.reply(message);
}

function generarMensajeProgreso(progress: ProgressMessage): string {
  const { step, totalSteps, message } = progress;
  
  let progressText = '';
  
  if (step === 1 && message.toLowerCase().includes('inici')) {
    progressText = `Iniciando ejecución. Preparando entorno para el proyecto.`;
  } else if (message.toLowerCase().includes('anali')) {
    progressText = `Ejecutando paso ${step} de ${totalSteps}: Analizando requisitos del proyecto.`;
  } else if (message.toLowerCase().includes('gener')) {
    progressText = `Ejecutando paso ${step} de ${totalSteps}: Generando código fuente.`;
  } else if (message.toLowerCase().includes('implement')) {
    progressText = `Ejecutando paso ${step} de ${totalSteps}: Implementando funcionalidades.`;
  } else if (message.toLowerCase().includes('valid')) {
    progressText = `Ejecutando paso ${step} de ${totalSteps}: Validando implementación.`;
  } else if (message.toLowerCase().includes('test')) {
    progressText = `Ejecutando paso ${step} de ${totalSteps}: Ejecutando pruebas.`;
  } else if (message.toLowerCase().includes('complet') || message.toLowerCase().includes('finish')) {
    progressText = `Paso ${step} de ${totalSteps} completado exitosamente.`;
  } else {
    progressText = `Ejecutando paso ${step} de ${totalSteps}.`;
  }
  
  return progressText;
}

export async function sendQuestionAudio(
  ctx: any,
  userId: string,
  question: string,
  options: string[]
): Promise<void> {
  const voiceEnabled = isVoiceEnabled(userId);
  const autoRespond = isAutoRespondEnabled(userId);
  
  const audioMessage = `Necesito tu decisión. ${question}`;
  
  if (voiceEnabled && autoRespond) {
    try {
      const audioBuffer = await textToSpeech(audioMessage);
      if (audioBuffer) {
        await ctx.replyWithVoice(new InputFile(audioBuffer));
      }
    } catch (error) {
      logger.error('Error sending question audio:', error);
    }
  }
  
  let textMessage = `🤔 ${question}\n\n`;
  if (options.length > 0) {
    textMessage += `Opciones disponibles:\n`;
    options.forEach((opt, i) => {
      textMessage += `${i + 1}. ${opt}\n`;
    });
  }
  textMessage += `\nResponde con el número o escribe tu respuesta.`;
  
  await ctx.reply(textMessage);
}
