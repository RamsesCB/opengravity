import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const ELEVENLABS_API_KEY = config.ELEVENLABS_API_KEY;
const VOICE_ID = config.ELEVENLABS_VOICE_ID;
const OPENAI_API_KEY = config.OPENAI_API_KEY;

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
  const audioBuffer = await elevenLabsTTS(text);
  if (audioBuffer) return audioBuffer;

  logger.warn('Falling back to OpenAI TTS');
  return openaiTTS(text);
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

async function openaiTTS(text: string): Promise<Buffer | null> {
  if (!OPENAI_API_KEY) {
    logger.warn('OpenAI API key not configured, TTS unavailable');
    return null;
  }

  try {
    const response = await fetch(
      'https://api.openai.com/v1/audio/speech',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'alloy',
          input: text,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error(`OpenAI TTS error: ${response.status} - ${error}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.error('Error generating speech with OpenAI:', error);
    return null;
  }
}

export function isConfigured(): boolean {
  return !!ELEVENLABS_API_KEY;
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
