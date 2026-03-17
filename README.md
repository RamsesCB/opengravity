# OpenGravity

AI Telegram Bot powered by Groq LLM with Firebase storage and local audio transcription.

## Features

- 🤖 AI-powered Telegram bot using Groq's LLM
- 🎤 **Local Audio Transcription** using Whisper.cpp (offline, free)
- 💾 Firebase Firestore for conversation memory
- 🔒 User access control (whitelist)
- 🖥️ Long polling (local) or Webhook (production)

## Audio Transcription

OpenGravity includes **free, offline audio transcription** using Whisper.cpp:

- **100% Local** - No external APIs, works offline
- **Free** - No API costs
- **Low RAM** - Optimized for ~250MB RAM usage
- **Multiple Languages** - Supports 50+ languages

### Supported Audio

- Voice messages (notes)
- Audio files up to 20MB
- Formats: OGG, WAV, MP3 (Telegram converts to OGG)

### Commands

- `/transcribe` - Transcribe a voice message
- Send voice message directly for auto-transcription

## Voice Output (TTS)

OpenGravity supports **Text-to-Speech** using ElevenLabs for voice responses:

- **Natural Voice** - Deep male voice (James)
- **Multiple Languages** - ElevenLabs multilingual support
- **Auto Mode** - Automatically respond with voice

### Voice Commands

- `/voice on` - Enable voice, use `/hablar` to get voice responses
- `/voice auto` - Automatically respond with voice to all messages
- `/voice off` - Disable voice
- `/voice` - Show current status
- `/hablar <text>` - Convert text to voice

### Example

```
/voice on        # Enable voice
/hablar Hola, como estas?  # Get voice response

/voice auto     # Auto-voice mode
(Any message will get voice response)
```

### Environment Variables

```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=jsCqWAovK14vIlaW1p  # Default: James (deep male voice)
```

## Deployment

### Prerequisites

- Node.js 20
- Telegram Bot Token
- Groq API Key (for LLM)
- Firebase Project (optional, for cloud deployment)

### Environment Variables

Create a `.env` file (see `.env.example`):

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
GROQ_API_KEY=your_groq_api_key
DB_PATH=./memory.db
WHISPER_MODEL=base  # Optional: tiny, base (default: base)
ELEVENLABS_API_KEY=your_elevenlabs_api_key  # Optional: for voice output
ELEVENLABS_VOICE_ID=jsCqWAovK14vIlaW1p    # Optional: voice ID (default: James)
```

### Local Development

```bash
npm install
npm run dev
```

The first run will download the Whisper model (~140MB). Subsequent runs use cached model.

### Deploy to Render

1. Push code to GitHub
2. Create a Web Service on Render
3. Configure:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
4. Add Environment Variables:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_USER_IDS`
   - `GROQ_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (optional)
   - `WHISPER_MODEL` (optional, default: base)
   - `ELEVENLABS_API_KEY` (optional, for voice output)

5. Set webhook:
   ```
   https://your-render-url.onrender.com/webhook
   ```

### Render Free Tier Notes

- **RAM**: 512MB available - Whisper uses ~250MB
- **Disk**: 1GB available - Model is ~140MB
- **Sleep**: Free tier sleeps after 15min of inactivity
- **First Request**: May take 20-30 seconds (model loading)

## Architecture

- **Bot**: Grammy.js
- **LLM**: Groq SDK
- **Storage**: Firebase Firestore
- **Transcription**: Whisper.cpp (local)
- **TTS**: ElevenLabs (voice output)
- **Server**: Express.js (for webhook)

## License

MIT
