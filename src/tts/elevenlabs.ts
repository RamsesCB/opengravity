import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import text2wav from 'text2wav';

const IS_LOCAL = config.IS_LOCAL;
const LOCAL_TTS_URL = config.LOCAL_TTS_URL;
const VOICE_PROMPT = config.VOICE_PROMPT;
const TTS_TIMEOUT = config.TTS_TIMEOUT;

const MAX_TTS_CHARS = 300;

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

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars).trim() + '...';
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
  
  try {
    const truncatedText = truncateText(text, MAX_TTS_CHARS);
    logger.info(`Generating speech with text2wav (${truncatedText.length} chars)...`);
    
    const audioBuffer = await Promise.race([
      text2wav(truncatedText, { voice: 'es', speed: 175 }),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('TTS timeout')), TTS_TIMEOUT)
      )
    ]) as Uint8Array;
    
    if (audioBuffer && audioBuffer.length > 0) {
      logger.info(`Generated audio: ${audioBuffer.length} bytes`);
      return Buffer.from(audioBuffer);
    }
    
    return null;
  } catch (error) {
    logger.error('Error generating speech with text2wav:', error);
    return null;
  }
}

export function isConfigured(): boolean {
  return true;
}
