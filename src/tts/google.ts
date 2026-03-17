import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const client = new TextToSpeechClient();

const VOICE_NAME = process.env.GOOGLE_TTS_VOICE || 'es-ES-Neural2-C';
const LANGUAGE_CODE = process.env.GOOGLE_TTS_LANGUAGE || 'es-ES';

export async function textToSpeechGoogle(text: string): Promise<Buffer | null> {
  try {
    const request = {
      input: { text },
      voice: {
        languageCode: LANGUAGE_CODE,
        name: VOICE_NAME,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0,
      },
    };

    const [response] = await client.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      logger.error('No audio content returned from Google TTS');
      return null;
    }

    return Buffer.from(response.audioContent as Uint8Array);
  } catch (error) {
    logger.error('Error generating speech with Google TTS:', error);
    return null;
  }
}

export function isGoogleTTSConfigured(): boolean {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
}
