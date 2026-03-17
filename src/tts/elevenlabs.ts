import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const ELEVENLABS_API_KEY = config.ELEVENLABS_API_KEY;
const VOICE_ID = config.ELEVENLABS_VOICE_ID;

interface UserVoiceSettings {
  enabled: boolean;
  autoRespond: boolean;
}

const userVoiceSettings = new Map<string, UserVoiceSettings>();

export function isVoiceEnabled(userId: string): boolean {
  const settings = userVoiceSettings.get(userId);
  return settings?.enabled ?? false;
}

export function isAutoRespondEnabled(userId: string): boolean {
  const settings = userVoiceSettings.get(userId);
  return settings?.autoRespond ?? false;
}

export function setVoiceEnabled(userId: string, enabled: boolean, autoRespond = false): void {
  userVoiceSettings.set(userId, { enabled, autoRespond });
}

export function getVoiceSettings(userId: string): UserVoiceSettings {
  return userVoiceSettings.get(userId) || { enabled: false, autoRespond: false };
}

export async function textToSpeech(text: string): Promise<Buffer | null> {
  if (!ELEVENLABS_API_KEY) {
    logger.warn('ElevenLabs API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error(`ElevenLabs API error: ${response.status} - ${error}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.error('Error generating speech:', error);
    return null;
  }
}

export function isConfigured(): boolean {
  return !!ELEVENLABS_API_KEY;
}
