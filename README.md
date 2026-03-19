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
| 🔊 **TTS Options** | Local: Qwen3-TTS (GPU) \| Production: text2wav (npm) |
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
│   │  │  Qwen3-TTS     │    │   text2wav (Production)    │  │  │
│   │  │  (Local GPU)    │    │   - Pure npm package       │  │  │
│   │  │  - Voice Design │    │   - No external deps       │  │  │
│   │  │  - Custom promt │    │   - 150 char limit         │  │  │
│   │  └────────┬────────┘    └──────────────┬──────────────┘  │  │
│   │           │                              │                  │  │
│   │           └──────────────┬───────────────┘                  │  │
│   │                          │                                  │  │
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

### Option A: Local Voice (Qwen3-TTS) - Recommended

| Pros | Cons |
|------|------|
| ✅ 100% Free & Open Source | ❌ Requires GPU (4GB+ VRAM) |
| ✅ Custom voice with prompts | ❌ Local setup required |
| ✅ No cloud dependency | ❌ Only works when running locally |
| ✅ No account/API needed | |

### Option B: Production Voice (text2wav) - Default

| Pros | Cons |
|------|------|
| ✅ 100% npm package (no binaries) | ❌ Voz robótica |
| ✅ Works on any Node.js server | ❌ Menor calidad natural |
| ✅ No API keys needed | |
| ✅ No IP blocking issues | |
| ✅ OOM protection (150 char limit) | |

**Behavior:**
- **Local mode (`IS_LOCAL=true`)**: Qwen3-TTS (GPU, custom voice) → text2wav fallback
- **Production mode (`IS_LOCAL=false`)**: text2wav (npm package, 150 char limit)

**TTS Limits (Production):**
- `MAX_TTS_CHARS`: 150 characters (prevents OOM on free tier)
- `MAX_AUDIO_BYTES`: 500KB hard limit
- Responses exceeding limits will be sent as text

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

#### Option A: Qwen3-TTS Local (Recommended for best voice quality)
See [Local Voice Server](#-local-voice-server-qwen3-tts) section below.

#### Option B: Production (text2wav - no config needed)
The production voice is automatically enabled. No additional configuration required!

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
# Voice Configuration
# ===================

# Local Mode (Qwen3-TTS) - Enable when running locally with GPU
IS_LOCAL=false
LOCAL_TTS_URL=http://localhost:5001
# VOICE_PROMPT=your_custom_voice_prompt (optional)

# Production voice (text2wav) - No config needed, works automatically
# TTS_TIMEOUT=10000 (optional, in milliseconds)

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

| Mode | Voice | Memory Protection |
|------|-------|-------------------|
| **Render/Cloud** | text2wav (npm) | ✅ 150 char limit, 500KB audio limit |
| **Local** | Qwen3-TTS → text2wav | ✅ 60s timeout, silent detection |

**Note:** No additional installation required! text2wav is a pure npm package. OOM protection is built-in.

### ✅ Definitive Plan (March 2026)

| Mode | Voice | Transcription |
|------|-------|---------------|
| **Local** | Qwen3-TTS (custom voice) | Groq Whisper |
| **Production** | text2wav (npm) | Groq Whisper |

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
   Add all required variables in Render's dashboard:

   | Variable | Value | Notes |
   |----------|-------|-------|
   | `NODE_OPTIONS` | `--max-old-space-size=256` | Optional: limits RAM to prevent OOM |
   | `TTS_TIMEOUT` | `10000` | 10 second timeout for TTS |

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
- [Qwen](https://qwen.ai/) - Open Source TTS Models
- [text2wav](https://www.npmjs.com/package/text2wav) - Pure npm TTS for production
- [Firebase](https://firebase.google.com/) - Backend Services

---

<div align="center">

**Made with ❤️ by [RamsesCB](https://github.com/RamsesCB)**

⭐ Star this repo if you find it useful!

</div>
