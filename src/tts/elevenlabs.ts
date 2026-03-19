import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import text2wav from 'text2wav';

const IS_LOCAL = config.IS_LOCAL;
const LOCAL_TTS_URL = config.LOCAL_TTS_URL;
const VOICE_PROMPT = config.VOICE_PROMPT;
const TTS_TIMEOUT = config.TTS_TIMEOUT;
const LOCAL_TTS_TIMEOUT = 300000;

const MAX_TTS_CHARS = 250;
const MAX_AUDIO_BYTES = 1500000;

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

async function generateWithLocalTTS(text: string): Promise<Buffer | null> {
  if (!IS_LOCAL) return null;
  
  try {
    logger.info(`Generating speech with local Qwen3-TTS (no character limit)...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOCAL_TTS_TIMEOUT);
    
    const response = await fetch(`${LOCAL_TTS_URL}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text, 
        language: 'es', 
        voice_prompt: VOICE_PROMPT, 
        use_voice_design: true 
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error(`Local TTS error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    
    if (result.error) {
      logger.error(`Local TTS error: ${result.error}`);
      return null;
    }
    
    if (!result.audio) {
      logger.error('Local TTS returned no audio');
      return null;
    }
    
    const audioBuffer = Buffer.from(result.audio, 'base64');
    
    const hasAudio = audioBuffer.length > 44 && (() => {
      const int16 = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset + 44);
      let maxAmp = 0;
      for (let i = 0; i < Math.min(int16.length, 10000); i++) {
        const amp = Math.abs(int16[i]);
        if (amp > maxAmp) maxAmp = amp;
      }
      return maxAmp > 10;
    })();
    if (!hasAudio) {
      logger.warn('Local TTS returned silent audio');
      return null;
    }
    
    logger.info(`Generated local TTS audio: ${audioBuffer.length} bytes`);
    return audioBuffer;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      logger.error(`Local TTS timeout after ${LOCAL_TTS_TIMEOUT}ms - server may be slow or overloaded`);
    } else {
      logger.error('Error connecting to local TTS server:', error);
    }
    return null;
  }
}

async function isLocalTTSAvailable(): Promise<boolean> {
  if (!IS_LOCAL) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const healthResponse = await fetch(`${LOCAL_TTS_URL}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return healthResponse.ok;
    } catch {
      clearTimeout(timeoutId);
      
      const testController = new AbortController();
      const testTimeoutId = setTimeout(() => testController.abort(), 5000);
      
      try {
        const testResponse = await fetch(`${LOCAL_TTS_URL}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'test', language: 'es' }),
          signal: testController.signal
        });
        clearTimeout(testTimeoutId);
        return testResponse.ok || testResponse.status === 400;
      } catch {
        clearTimeout(testTimeoutId);
        return false;
      }
    }
  } catch {
    return false;
  }
}

export async function textToSpeech(text: string): Promise<Buffer | null> {
  if (IS_LOCAL) {
    const isAvailable = await isLocalTTSAvailable();
    
    if (isAvailable) {
      const localAudio = await generateWithLocalTTS(text);
      if (localAudio) {
        return localAudio;
      }
    }
    
    if (!isAvailable) {
      logger.info('Local TTS server not available, falling back to text2wav...');
    } else {
      logger.info('Local TTS failed, falling back to text2wav...');
    }
  }
  
  try {
    const truncatedText = truncateText(text, MAX_TTS_CHARS);
    if (truncatedText.length < text.length) {
      logger.info(`TTS text truncated: ${text.length} → ${truncatedText.length} chars`);
    }
    logger.info(`Generating speech with text2wav (${truncatedText.length} chars)...`);
    
    const audioBuffer = await Promise.race([
      text2wav(truncatedText, { voice: 'es', speed: 155 }),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('TTS timeout')), TTS_TIMEOUT)
      )
    ]) as Uint8Array;
    
    if (!audioBuffer || audioBuffer.length === 0) {
      logger.warn('text2wav returned empty audio');
      return null;
    }
    
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      logger.warn(`text2wav audio too large: ${audioBuffer.length} bytes > ${MAX_AUDIO_BYTES} limit, skipping audio`);
      return null;
    }
    
    logger.info(`Generated audio: ${audioBuffer.length} bytes`);
    return Buffer.from(audioBuffer);
  } catch (error) {
    logger.error('Error generating speech with text2wav:', error);
    return null;
  }
}

export function isConfigured(): boolean {
  return IS_LOCAL || true;
}
