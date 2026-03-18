import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import text2wav from 'text2wav';

const IS_LOCAL = config.IS_LOCAL;
const LOCAL_TTS_URL = config.LOCAL_TTS_URL;
const VOICE_PROMPT = config.VOICE_PROMPT;
const TTS_TIMEOUT = config.TTS_TIMEOUT;

interface UserVoiceSettings {
  enabled: boolean;
  autoRespond: boolean;
}

const userVoiceSettings = new Map<string, UserVoiceSettings>();

export function isVoiceEnabled(userId: string): boolean {
  return userVoiceSettings.get(userId)?.enabled ?? isConfigured();
}

export function isAutoRespondEnabled(userId: string): boolean {
  return userVoiceSettings.get(userId)?.autoRespond ?? isConfigured();
}

export function setVoiceEnabled(userId: string, enabled: boolean, autoRespond = false): void {
  userVoiceSettings.set(userId, { enabled, autoRespond });
}

export function getVoiceSettings(userId: string): UserVoiceSettings {
  return userVoiceSettings.get(userId) || { enabled: isConfigured(), autoRespond: isConfigured() };
}

export async function textToSpeech(text: string): Promise<Buffer | null> {
  if (IS_LOCAL) {
    const audio = await localTTS(text);
    if (audio) return audio;
    logger.warn('Local TTS failed, no fallback available in local mode');
    return null;
  } else {
    const audio = await text2wavTTS(text);
    if (audio) return audio;
    logger.warn('Production TTS failed');
    return null;
  }
}

async function localTTS(text: string): Promise<Buffer | null> {
  try {
    const response = await fetch(`${LOCAL_TTS_URL}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: 'es', voice_prompt: VOICE_PROMPT, use_voice_design: true })
    });

    if (!response.ok) {
      logger.error(`Local TTS error: ${response.status} - ${await response.text()}`);
      return null;
    }

    const result = await response.json();
    return result.audio ? Buffer.from(result.audio, 'base64') : null;
  } catch (error) {
    logger.error('Error connecting to local TTS server:', error);
    return null;
  }
}

async function text2wavTTS(text: string): Promise<Buffer | null> {
  try {
    logger.info('Generating speech with text2wav...');
    
    const audioBuffer = await Promise.race([
      text2wav(text, { voice: 'es', speed: 175 }),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('TTS timeout')), TTS_TIMEOUT)
      )
    ]) as Uint8Array;
    
    if (audioBuffer && audioBuffer.length > 0) {
      logger.info(`Generated audio: ${audioBuffer.length} bytes`);
      return Buffer.from(audioBuffer);
    }
    
    logger.error('text2wav returned empty audio');
    return null;
  } catch (error) {
    logger.error('Error generating speech with text2wav:', error);
    return null;
  }
}

export function isConfigured(): boolean {
  return IS_LOCAL || true;
}
