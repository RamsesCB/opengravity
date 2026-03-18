import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { spawn } from 'child_process';

const ELEVENLABS_API_KEY = config.ELEVENLABS_API_KEY;
const VOICE_ID = config.ELEVENLABS_VOICE_ID;
const IS_LOCAL = config.IS_LOCAL;
const LOCAL_TTS_URL = config.LOCAL_TTS_URL;
const VOICE_PROMPT = config.VOICE_PROMPT;
const ESPEAK_ENABLED = config.ESPEAK_ENABLED;
const ESPEAK_NG_COMMAND = config.ESPEAK_NG_COMMAND;
const ESPEAK_NG_VOICE = config.ESPEAK_NG_VOICE;
const ESPEAK_NG_SPEED = config.ESPEAK_NG_SPEED;

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
    const audio = await elevenLabsTTS(text);
    if (audio) return audio;
    logger.warn('ElevenLabs failed, falling back to eSpeak NG');
    return espeakTTS(text);
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

async function elevenLabsTTS(text: string): Promise<Buffer | null> {
  if (!ELEVENLABS_API_KEY) return null;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_API_KEY },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true }
        })
      }
    );

    if (!response.ok) {
      logger.error(`ElevenLabs API error: ${response.status} - ${await response.text()}`);
      return null;
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    logger.error('Error generating speech with ElevenLabs:', error);
    return null;
  }
}

async function espeakTTS(text: string): Promise<Buffer | null> {
  if (!ESPEAK_ENABLED) return null;

  return new Promise((resolve) => {
    const args = ['-v', ESPEAK_NG_VOICE, '-s', String(ESPEAK_NG_SPEED), '--stdout', text];
    const process = spawn(ESPEAK_NG_COMMAND, args);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    process.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    process.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)));

    process.on('error', (error) => {
      logger.error('Error starting eSpeak NG:', error);
      resolve(null);
    });

    process.on('close', (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
        logger.error(`eSpeak NG exited with code ${code}${stderr ? `: ${stderr}` : ''}`);
        resolve(null);
        return;
      }

      const audio = Buffer.concat(stdoutChunks);
      if (!audio.length) {
        logger.error('eSpeak NG produced empty audio output');
        resolve(null);
        return;
      }

      resolve(audio);
    });
  });
}

export function isConfigured(): boolean {
  return IS_LOCAL || !!ELEVENLABS_API_KEY || (!IS_LOCAL && ESPEAK_ENABLED);
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string | null> {
  if (!ELEVENLABS_API_KEY) return null;

  try {
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' });
    const formData = new FormData();
    formData.append('file', blob, 'audio.ogg');
    formData.append('model_id', 'scribe_multilingual');

    const response = await fetch('https://api.elevenlabs.io/v1/transcription', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      body: formData
    });

    if (!response.ok) {
      logger.error(`ElevenLabs transcription error: ${response.status} - ${await response.text()}`);
      return null;
    }

    return (await response.json()).text || null;
  } catch (error) {
    logger.error('Error transcribing audio with ElevenLabs:', error);
    return null;
  }
}
