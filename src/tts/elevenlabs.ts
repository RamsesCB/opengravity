import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const IS_LOCAL = config.IS_LOCAL;
const LOCAL_TTS_URL = config.LOCAL_TTS_URL;
const VOICE_PROMPT = config.VOICE_PROMPT;

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
    try {
      const response = await fetch(`${LOCAL_TTS_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: 'es', voice_prompt: VOICE_PROMPT, use_voice_design: true })
      });

      if (!response.ok) {
        logger.error(`Local TTS error: ${response.status}`);
        return null;
      }

      const result = await response.json();
      return result.audio ? Buffer.from(result.audio, 'base64') : null;
    } catch (error) {
      logger.error('Error connecting to local TTS server:', error);
      return null;
    }
  }
  
  return null;
}

export function isConfigured(): boolean {
  return true;
}
