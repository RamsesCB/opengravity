import express, { Request, Response } from "express";
import { webhookCallback } from "grammy";
import { bot } from "./bot/telegram.js";
import { logger } from "./utils/logger.js";
import "./tools/get_current_time.js";

const app = express();
app.use(express.json());

// Create handler once
const handler = webhookCallback(bot, "express");

// Endpoint for Telegram Webhook
app.post("/webhook", (req: Request, res: Response) => {
    logger.info(`Received Webhook from Telegram! Body: ${JSON.stringify(req.body?.message?.text || req.body)}`);
    (handler as any)(req, res).catch((err: any) => logger.error("Webhook error:", err));
});


// Health check endpoint
app.get("/", (req: Request, res: Response) => {
    res.send("OpenGravity is running on Render!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
