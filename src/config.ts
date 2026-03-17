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
  ELEVENLABS_VOICE_ID: getEnv('ELEVENLABS_VOICE_ID', false, 'IKne3meq5aSn9XLyUdCD'), // Charlie - Deep, Confident, Energetic
  OPENAI_API_KEY: getEnv('OPENAI_API_KEY', false),
  MAX_ITERATIONS: 10,
};
