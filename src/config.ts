import dotenv from 'dotenv';
dotenv.config();

function getEnv(key: string, required = true, defaultValue = ''): string {
  const value = process.env[key];
  if (!value && required) {
    if (defaultValue) return defaultValue;
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

const DEFAULT_VOICE_PROMPT = `gender: Masculino
pitch: Voz profunda de barítono, resonante y con cuerpo
speed: Ritmo controlado y calmado, hablando con pausas reflexivas
volume: Moderado y firme
age: Mediana edad (45-55 años)
clarity: Altamente articulada y elocuente
accent: Español (neutro corporativo o peninsular)
texture: Cálida, firme y aterciopelada
emotion: Serenidad, empatía y gran seguridad
tone: Inspirador, profesional y directivo
personality: Íntegro, líder corporativo, confiable`;

export const config = {
  TELEGRAM_BOT_TOKEN: getEnv('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_ALLOWED_USER_IDS: getEnv('TELEGRAM_ALLOWED_USER_IDS').split(',').map(id => id.trim()).filter(Boolean),
  GROQ_API_KEY: getEnv('GROQ_API_KEY'),
  OPENROUTER_API_KEY: getEnv('OPENROUTER_API_KEY', false),
  OPENROUTER_MODEL: getEnv('OPENROUTER_MODEL', false, 'google/gemini-flash-1.5-8b'),
  GEMINI_API_KEY: getEnv('GEMINI_API_KEY', false),
  DB_PATH: getEnv('DB_PATH', false, './memory.db'),
  GOOGLE_APPLICATION_CREDENTIALS: getEnv('GOOGLE_APPLICATION_CREDENTIALS', false, './service-account.json'),
  
  // Voice Configuration
  IS_LOCAL: getEnv('IS_LOCAL', false, 'false').toLowerCase() === 'true',
  LOCAL_TTS_URL: getEnv('LOCAL_TTS_URL', false, 'http://localhost:5001'),
  VOICE_PROMPT: getEnv('VOICE_PROMPT', false, DEFAULT_VOICE_PROMPT),
  TTS_TIMEOUT: getEnvNumber('TTS_TIMEOUT', 10000),
  
  MAX_ITERATIONS: 10,
};
