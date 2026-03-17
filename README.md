# OpenGravity

AI Telegram Bot powered by Groq LLM with Firebase storage.

## Features

- 🤖 AI-powered Telegram bot using Groq's LLM
- 💾 Firebase Firestore for conversation memory
- 🔒 User access control (whitelist)
- 🖥️ Long polling (local) or Webhook (production)

## Deployment

### Prerequisites

- Node.js 20
- Telegram Bot Token
- Groq API Key
- Firebase Project (optional, for cloud deployment)

### Environment Variables

Create a `.env` file (see `.env.example`):

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
GROQ_API_KEY=your_groq_api_key
DB_PATH=./memory.db
```

### Local Development

```bash
npm install
npm run dev
```

### Deploy to Render

1. Push code to GitHub
2. Create a Web Service on Render
3. Configure:
   - Build Command: `npm run build`
   - Start Command: `npm run start`
4. Add Environment Variables:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_USER_IDS`
   - `GROQ_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (optional, paste full JSON)

5. Set webhook:
   ```
   https://your-render-url.onrender.com/webhook
   ```

## Architecture

- **Bot**: Grammy.js
- **LLM**: Groq SDK
- **Storage**: Firebase Firestore
- **Server**: Express.js (for webhook)

## License

MIT
