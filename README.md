# OpenGravity

AI Telegram Bot powered by Groq LLM with voice synthesis.

## Features

- 🤖 AI-powered Telegram bot using Groq's LLM
- 🎤 **Voice Messages** - Send voice, get voice response
- 🔊 **Dual TTS** - ElevenLabs (premium) + Google Cloud TTS (free)
- 💾 Firebase Firestore for conversation memory
- 🔒 User access control (whitelist)
- 🖥️ Long polling (local) or Webhook (production)

## How It Works

### Voice Message Flow

```
1. Send voice message
2. ElevenLabs transcribes (cloud)
3. Groq processes with LLM
4. ElevenLabs converts response to voice
5. Receive audio response
```

### Text Message Flow

```
1. Send text message
2. Groq processes with LLM
3. (Optional) Convert to voice with ElevenLabs
4. Receive text or voice response
```

## Commands

### Voice Commands

| Command | Description |
|---------|-------------|
| `/voice auto` | Auto-respond with voice |
| `/voice on` | Enable voice, use `/hablar` |
| `/voice off` | Disable voice |
| `/hablar <text>` | Convert text to voice |

### Other Commands

| Command | Description |
|---------|-------------|
| `/start` | Start bot |
| `/transcribe` | Transcribe voice message |

## Environment Variables

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_USER_IDS=123456789
GROQ_API_KEY=your_groq_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=jsCqWAovK14vIlaW1p
```

## Deployment

### Local Development

```bash
npm install
npm run dev
```

### Deploy to Render

1. Push code to GitHub
2. Create a Web Service on Render
3. Configure:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
4. Add Environment Variables
5. Set webhook:
   ```
   https://your-render-url.onrender.com/webhook
   ```

## Architecture

- **Bot**: Grammy.js
- **LLM**: Groq SDK
- **Storage**: Firebase Firestore
- **Voice**: ElevenLabs (transcription + TTS)
- **Server**: Express.js (webhook)

## License

MIT
