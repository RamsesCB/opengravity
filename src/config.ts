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

const DEFAULT_VOICE_PROMPT = `gender: Masculino
pitch: Voz profunda de barítono, resonante y con cuerpo
speed: Ritmo controlado y calmado, hablando con pausas reflexivas
volume: Moderado y firme, proyectando autoridad natural sin necesidad de gritar
age: Mediana edad (45-55 años)
clarity: Altamente articulada y elocuente, con una dicción impecable
fluency: Flujo suave y seguro, propio de un líder experimentado
accent: Acento en español (neutro corporativo o peninsular)
texture: Cálida, firme y aterciopelada, que inspira confianza inmediata
emotion: Serenidad, empatía y gran seguridad en sí mismo
tone: Inspirador, profesional y directivo, pero accesible y de buen corazón
personality: Íntegro, líder corporativo, decente y sumo confiable`;

export const config = {
  TELEGRAM_BOT_TOKEN: getEnv('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_ALLOWED_USER_IDS: getEnv('TELEGRAM_ALLOWED_USER_IDS').split(',').map(id => id.trim()).filter(Boolean),
  GROQ_API_KEY: getEnv('GROQ_API_KEY'),
  OPENROUTER_API_KEY: getEnv('OPENROUTER_API_KEY', false),
  OPENROUTER_MODEL: getEnv('OPENROUTER_MODEL', false, 'google/gemini-flash-1.5-8b'),
  GEMINI_API_KEY: getEnv('GEMINI_API_KEY', false),
  DB_PATH: getEnv('DB_PATH', false, './memory.db'),
  GOOGLE_APPLICATION_CREDENTIALS: getEnv('GOOGLE_APPLICATION_CREDENTIALS', false, './service-account.json'),
  ELEVENLABS_API_KEY: getEnv('ELEVENLABS_API_KEY', false),
  ELEVENLABS_VOICE_ID: getEnv('ELEVENLABS_VOICE_ID', false, 'IKne3meq5aSn9XLyUdCD'),
  IS_LOCAL: getEnv('IS_LOCAL', false, 'false').toLowerCase() === 'true',
  LOCAL_TTS_URL: getEnv('LOCAL_TTS_URL', false, 'http://localhost:5001'),
  VOICE_PROMPT: getEnv('VOICE_PROMPT', false, DEFAULT_VOICE_PROMPT),
  MAX_ITERATIONS: 10,
};
