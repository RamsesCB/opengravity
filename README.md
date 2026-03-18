# 🤖 OpenGRBC

> **AI-Powered Telegram Bot** with Triple LLM Fallback System

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**High-Availability AI Bot** | Groq → Gemini → OpenRouter

</div>

---

## 🚀 Overview

OpenGRBC is an intelligent Telegram bot powered by multiple Large Language Models (LLMs) with an intelligent **triple fallback system** that ensures 99.9% uptime. It combines voice processing, AI conversation, and cloud deployment capabilities.

### Why OpenGRBC?

- **Resilient**: Triple LLM fallback (Groq → Gemini Flash → OpenRouter)
- **Voice-Ready**: Full voice message support with ElevenLabs or Qwen3-TTS (local)
- **Memory**: Persistent conversation history via Firebase Firestore
- **Secure**: Whitelist-based access control
- **Production-Ready**: Deploy to Render, Firebase Functions, or any cloud

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Triple LLM Fallback** | Groq → Gemini Flash → OpenRouter automatic failover |
| 🎤 **Voice Messages** | Send voice, receive voice responses |
| 🔊 **TTS Options** | Local: Qwen3-TTS (GPU) \| Production: eSpeak NG (lightweight) |
| 💾 **Persistent Memory** | Firebase Firestore stores conversation history |
| 🔒 **Access Control** | Whitelist-only user access |
| 📝 **Tool Calling** | Execute functions and tools via AI |
| 🖥️ **Flexible Deployment** | Local (polling) or Cloud (webhooks) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenGRBC Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│   │   Telegram   │──────│  Express.js │──────│   Grammy.js  │  │
│   │    Client    │      │   Server    │      │     Bot      │  │
│   └──────────────┘      └──────────────┘      └──────────────┘  │
│                                                        │          │
│                          ┌─────────────────────────────┴────────┐ │
│                          │         LLM Layer (Triple Fallback)   │ │
│                          ├──────────────────────────────────────┤ │
│                          │  1. Groq (llama-3.3-70b-versatile)  │ │
│                          │     ↓ Rate Limit / Error            │ │
│                          │  2. Gemini Flash (gemini-1.5-flash) │ │
│                          │     ↓ Error                          │ │
│                          │  3. OpenRouter (gemini-flash-1.5-8b) │ │
│                          └──────────────────────────────────────┘ │
│                                          │                       │
│   ┌──────────────┐      ┌────────────────┴───────────────────┐  │
│   │  Firebase    │◄─────│         Memory Layer              │  │
│   │  Firestore   │      │  - Conversation History            │  │
│   └──────────────┘      │  - User Context                   │  │
│                         └────────────────────────────────────┘  │
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    Voice Layer                            │  │
│   ├──────────────────────────────────────────────────────────┤  │
│   │  ┌─────────────────┐    ┌─────────────────────────────┐  │  │
│   │  │  ElevenLabs    │    │   Qwen3-TTS (Local)        │  │  │
│   │  │     API        │    │   - Voice Design (GPU)      │  │  │
│   │  │  (cloud)       │    │   - Custom prompts         │  │  │
│   │  └────────┬────────┘    └──────────────┬──────────────┘  │  │
│   │           │                              │                  │  │
│   │  ┌────────┴────────┐                   │                  │  │
│   │  │  eSpeak NG     │◄──────────────────┘                  │  │
│   │  │  (production)  │   (lightweight fallback)             │  │
│   │  └─────────────────┘                                       │  │
│   │           │                                               │  │
│   │           └──────────────┬──────────────┘                  │  │
│   │                          ▼                                 │  │
│   │              ┌─────────────────────┐                      │  │
│   │              │  Whisper (Groq API) │                      │  │
│   │              │   Transcription     │                      │  │
│   │              └─────────────────────┘                      │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Requirements

| Service | Purpose | Required |
|---------|---------|----------|
| **Telegram Bot** | Bot identity & API | ✅ Yes |
| **Groq API** | Primary LLM provider | ✅ Yes |
| **Google Gemini** | Secondary fallback | Optional |
| **OpenRouter** | Tertiary fallback | Optional |
| **Firebase** | Database & auth | ✅ Yes |
| **ElevenLabs** | Voice synthesis (cloud) | Optional |
| **Qwen3-TTS** | Voice synthesis (local, free) | Optional (requires GPU) |

---

## 🎤 Voice Configuration

OpenGRBC supports **two voice (TTS) modes**:

### Option A: Local Voice (Qwen3-TTS)

| Pros | Cons |
|------|------|
| ✅ 100% Free & Open Source | ❌ Requires GPU (4GB+ VRAM) |
| ✅ Custom voice with prompts | ❌ Local setup required |
| ✅ No cloud dependency | ❌ Only works when running locally |
| ✅ No account/API needed | |

### Option B: Production Voice Fallback (eSpeak NG)

| Pros | Cons |
|------|------|
| ✅ Gratis y simple | ❌ Voz robótica |
| ✅ Sin APIs externas | ❌ Menor calidad natural |
| ✅ Útil cuando ElevenLabs falla | ❌ Requiere `espeak-ng` instalado en servidor |

**Behavior:**
- **Modo local (`IS_LOCAL=true`)**: usa Qwen3-TTS.
- **Modo producción (`IS_LOCAL=false`)**: usa ElevenLabs si está configurado; si falla, hace fallback a eSpeak NG.

---

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/RamsesCB/OpenGRBC.git
cd OpenGRBC
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Choose Your Voice Mode

#### Option A: Qwen3-TTS Local (Recommended)
See [Local Voice Server](#-local-voice-server-qwen3-tts) section below.

#### Option B: Production fallback (eSpeak NG + optional ElevenLabs)
Add to your `.env` if you want ElevenLabs as primary in production:
```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# ===================
# Required Variables
# ===================

# Telegram Bot Token (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Whitelist user IDs (comma-separated)
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321

# Groq API Key (primary LLM)
GROQ_API_KEY=your_groq_api_key

# ===================
# Optional Variables
# ===================

# Google Gemini API (secondary fallback)
GEMINI_API_KEY=your_gemini_api_key

# OpenRouter API (tertiary fallback)
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=google/gemini-flash-1.5-8b

# Firebase Configuration
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json

# ===================
# Voice Configuration (Choose One)
# ===================

# Option A: ElevenLabs API (cloud)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=IKne3meq5aSn9XLyUdCD

# Option B: Qwen3-TTS Local (enable local mode)
IS_LOCAL=true
LOCAL_TTS_URL=http://localhost:5001
# VOICE_PROMPT=your_custom_voice_prompt (optional, default provided)

# Production fallback voice (eSpeak NG)
ESPEAK_ENABLED=true
ESPEAK_NG_COMMAND=espeak-ng
ESPEAK_NG_VOICE=es-la
ESPEAK_NG_SPEED=155

# Database Path (local development)
DB_PATH=./memory.db
```

### 4. Run Locally

```bash
npm run dev
```

The bot will start in long-polling mode. Send `/start` to your bot!

---

## 🔊 Local Voice Server (Qwen3-TTS)

**Requires:** GPU with 4GB+ VRAM (e.g., RTX 3060, RTX 4060, RTX 5060)

### Quick Setup (One-time)

```bash
# Navigate to local folder
cd local

# Create virtual environment and install dependencies
bash setup_tts.sh
```

### Running the Bot with Local Voice

**Terminal 1 - Start Qwen3-TTS Server:**
```bash
cd OpenGRBC/local
source venv_tts/bin/activate
python qwen_tts_server.py
```

**Terminal 2 - Start the Bot:**
```bash
cd OpenGRBC
IS_LOCAL=true npm run dev
```

### Custom Voice Prompt

The default voice is configured with a professional male voice in Spanish. You can customize it by setting the `VOICE_PROMPT` environment variable:

```env
VOICE_PROMPT=gender: Feminino
pitch: Voz aguda y juvenil
age: twenties
accent: Español latinoamericano (méxico)
...
```

Or modify the default in `src/config.ts`.

### Voice Prompt Example (Pre-configured)

```env
VOICE_PROMPT=gender: Masculino
pitch: Voz profunda de barítono, resonante y con cuerpo
speed: Ritmo controlado y calmado, hablando con pausas reflexivas
volume: Moderado y firme
age: Mediana edad (45-55 años)
clarity: Altamente articulada y elocuente
accent: Español (neutro corporativo o peninsular)
texture: Cálida, firme y aterciopelada
emotion: Serenidad, empatía y gran seguridad
tone: Inspirador, profesional y directivo
personality: Íntegro, líder corporativo, deceno y confiable
```

---

## 📖 Usage

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize the bot |
| `/voice auto` | Auto-respond with voice |
| `/voice on` | Enable voice mode |
| `/voice off` | Disable voice mode |
| `/hablar <text>` | Convert text to voice |
| `/transcribe` | Transcribe last voice message |

### Voice Message Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ Telegram │────▶│  Bot     │────▶│  Whisper │
│  Voice   │     │   API   │     │          │     │ (local)  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                │
                                                ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │◀────│ Telegram │◀────│ ElevenLabs│◀────│  LLM     │
│  Voice   │     │   API    │     │   TTS     │     │ Processing│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

---

## ☁️ Deployment

### ⚠️ Important: Voice in Production

| Mode | Voice Support |
|------|---------------|
| **Render/Cloud** | ElevenLabs (optional) + eSpeak NG fallback |
| **Local** | Qwen3-TTS with custom voice prompts |

**Note:** In production install `espeak-ng` in the host OS (example Ubuntu/Debian: `sudo apt-get install -y espeak-ng`).

### ✅ Definitive Plan (March 2026)

| Mode | Voice | Transcription |
|------|-------|---------------|
| **Local** | Qwen3-TTS (custom voice) | Groq Whisper |
| **Production** | eSpeak NG fallback (optional ElevenLabs primary) | Groq Whisper |

Whisper limit reference (free tier): **20 RPM** on `whisper-large-v3`, equivalent to ~**8 hours/day** of audio.

### Deploy to Render (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy to production"
   git push origin main
   ```

2. **Create Web Service on Render**
   - Go to [render.com](https://render.com)
   - Create new **Web Service**
   - Connect your GitHub repository
   - Configure:
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm run start`

3. **Set Environment Variables**
   Add all required variables in Render's dashboard.

4. **Configure Webhook**
   ```
   https://your-service.onrender.com/webhook
   ```
   
   Set it via Telegram:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-service.onrender.com/webhook
   ```

### Deploy to Firebase Functions

```bash
npm run build
npm run deploy
```

---

## 🔧 Configuration Reference

### LLM Fallback System

The system automatically handles provider failures:

| Priority | Provider | Model | Trigger |
|----------|----------|-------|---------|
| 1️⃣ | **Groq** | llama-3.3-70b-versatile | Primary (always first) |
| 2️⃣ | **Gemini** | gemini-1.5-flash | Groq rate limit (429) or unavailable |
| 3️⃣ | **OpenRouter** | gemini-flash-1.5-8b | Gemini failure |

### Token Optimization

- **History Limit**: Last 12 messages (configurable)
- **Tool Truncation**: Tool responses >500 chars truncated with `[Truncated]`
- **Prompt Compression**: Minimal system prompt (~200 tokens)

---

## 📁 Project Structure

```
OpenGRBC/
├── src/
│   ├── agent/           # AI Agent logic
│   │   ├── llm.ts      # LLM with triple fallback
│   │   ├── loop.ts     # Main agent loop
│   │   └── prompt.ts   # System prompt
│   ├── bot/            # Telegram bot handlers
│   ├── config.ts       # Configuration
│   ├── memory/         # Firestore memory
│   ├── tts/            # Voice synthesis (Qwen local, ElevenLabs, eSpeak fallback)
│   ├── transcription/  # Voice transcription
│   ├── tools/          # Tool registry
│   ├── utils/          # Utilities
│   └── index.ts        # Entry point
├── local/
│   ├── qwen_tts_server.py  # Qwen3-TTS local server
│   └── setup_tts.sh        # Setup script
├── .env.example        # Environment template
├── package.json        # Dependencies
└── tsconfig.json       # TypeScript config
```

---

## 🤝 Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Grammy.js](https://grammy.dev/) - Telegram Bot Framework
- [Groq](https://groq.com/) - Fast LLM Inference
- [Google Gemini](https://gemini.google.com/) - AI Models
- [OpenRouter](https://openrouter.ai/) - Unified AI Access
- [ElevenLabs](https://elevenlabs.io/) - Voice Synthesis
- [Qwen](https://qwen.ai/) - Open Source TTS Models
- [eSpeak NG](https://github.com/espeak-ng/espeak-ng) - Lightweight offline TTS fallback
- [Firebase](https://firebase.google.com/) - Backend Services

---

<div align="center">

**Made with ❤️ by [RamsesCB](https://github.com/RamsesCB)**

⭐ Star this repo if you find it useful!

</div>
