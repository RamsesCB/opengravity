import express, { Request, Response } from "express";
import { webhookCallback } from "grammy";
import { bot } from "./bot/telegram.js";
import { logger } from "./utils/logger.js";
import "./tools/get_current_time.js";

const app = express();
app.use(express.json());

// Endpoint for Telegram Webhook
// We cast to any because grammy's express handler signature can be tricky with Firebase/Express types
app.post("/webhook", async (req: Request, res: Response) => {
    logger.info("Received Webhook from Telegram");
    try {
        const handler = webhookCallback(bot, "express");
        await (handler as any)(req, res);
    } catch (err) {
        logger.error("Error in webhook handler", err);
        if (!res.headersSent) {
            res.status(200).send("OK");
        }
    }
});

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
    res.send("OpenGravity is running on Render!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
