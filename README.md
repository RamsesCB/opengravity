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
- **Voice-Ready**: Full voice message support with ElevenLabs TTS
- **Memory**: Persistent conversation history via Firebase Firestore
- **Secure**: Whitelist-based access control
- **Production-Ready**: Deploy to Render, Firebase Functions, or any cloud

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Triple LLM Fallback** | Groq → Gemini Flash → OpenRouter automatic failover |
| 🎤 **Voice Messages** | Send voice, receive voice responses |
| 🔊 **ElevenLabs TTS** | High-quality text-to-speech with custom voices |
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
│   ┌──────────────┐      ┌────────────────────────────────────┐  │
│   │  ElevenLabs  │◄─────│         Voice Layer               │  │
│   │     TTS      │      │  - Whisper Transcription           │  │
│   └──────────────┘      │  - ElevenLabs Synthesis            │  │
│                         └────────────────────────────────────┘  │
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
| **ElevenLabs** | Voice synthesis | Optional |

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

# ElevenLabs Voice (optional)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=IKne3meq5aSn9XLyUdCD

# Database Path (local development)
DB_PATH=./memory.db
```

### 4. Run Locally

```bash
npm run dev
```

The bot will start in long-polling mode. Send `/start` to your bot!

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
│   ├── config.ts       # Configuration
│   ├── memory/         # Firestore memory
│   ├── tools/          # Tool registry
│   ├── utils/          # Utilities
│   └── index.ts        # Entry point
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
- [Firebase](https://firebase.google.com/) - Backend Services

---

<div align="center">

**Made with ❤️ by [RamsesCB](https://github.com/RamsesCB)**

⭐ Star this repo if you find it useful!

</div>
