import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const ELEVENLABS_API_KEY = config.ELEVENLABS_API_KEY;
const VOICE_ID = config.ELEVENLABS_VOICE_ID;
const IS_LOCAL = config.IS_LOCAL;
const LOCAL_TTS_URL = config.LOCAL_TTS_URL;

interface UserVoiceSettings {
  enabled: boolean;
  autoRespond: boolean;
}

const userVoiceSettings = new Map<string, UserVoiceSettings>();

export function isVoiceEnabled(userId: string): boolean {
  const settings = userVoiceSettings.get(userId);
  return settings?.enabled ?? isConfigured();
}

export function isAutoRespondEnabled(userId: string): boolean {
  const settings = userVoiceSettings.get(userId);
  return settings?.autoRespond ?? isConfigured();
}

export function setVoiceEnabled(userId: string, enabled: boolean, autoRespond = false): void {
  userVoiceSettings.set(userId, { enabled, autoRespond });
}

export function getVoiceSettings(userId: string): UserVoiceSettings {
  return userVoiceSettings.get(userId) || { enabled: isConfigured(), autoRespond: isConfigured() };
}

export async function textToSpeech(text: string): Promise<Buffer | null> {
  if (IS_LOCAL) {
    const localAudio = await localTTS(text);
    if (localAudio) return localAudio;
    logger.warn('Local TTS failed, falling back to Coqui API');
    return coquiTTS(text);
  }

  const audioBuffer = await elevenLabsTTS(text);
  if (audioBuffer) return audioBuffer;

  logger.warn('Falling back to Coqui TTS');
  return coquiTTS(text);
}

async function localTTS(text: string): Promise<Buffer | null> {
  try {
    const response = await fetch(`${LOCAL_TTS_URL}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: 'es' }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`Local TTS error: ${response.status} - ${error}`);
      return null;
    }

    const result = await response.json();
    if (result.audio) {
      return Buffer.from(result.audio, 'base64');
    }
    return null;
  } catch (error) {
    logger.error('Error connecting to local TTS server:', error);
    return null;
  }
}

async function elevenLabsTTS(text: string): Promise<Buffer | null> {
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
    logger.error('Error generating speech with ElevenLabs:', error);
    return null;
  }
}

async function coquiTTS(text: string): Promise<Buffer | null> {
  try {
    const response = await fetch(
      'https://api.coqui.ai/v2/tts',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: 'coqui/xtts',
          text: text,
          language: 'es',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error(`Coqui TTS error: ${response.status} - ${error}`);
      return null;
    }

    const audioBase64 = await response.text();
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    return audioBuffer;
  } catch (error) {
    logger.error('Error generating speech with Coqui:', error);
    return null;
  }
}

export function isConfigured(): boolean {
  return !!ELEVENLABS_API_KEY || IS_LOCAL;
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string | null> {
  if (!ELEVENLABS_API_KEY) {
    logger.warn('ElevenLabs API key not configured for transcription');
    return null;
  }

  try {
    const uint8Array = new Uint8Array(audioBuffer);
    const blob = new Blob([uint8Array], { type: 'audio/ogg' });
    
    const formData = new FormData();
    formData.append('file', blob, 'audio.ogg');
    formData.append('model_id', 'scribe_multilingual');

    const response = await fetch(
      'https://api.elevenlabs.io/v1/transcription',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error(`ElevenLabs transcription error: ${response.status} - ${error}`);
      return null;
    }

    const result = await response.json();
    return result.text || null;
  } catch (error) {
    logger.error('Error transcribing audio with ElevenLabs:', error);
    return null;
  }
}
