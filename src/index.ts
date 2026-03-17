import { onRequest } from "firebase-functions/v2/https";
import { webhookCallback } from "grammy";
import { bot } from "./bot/telegram.js";
import { logger } from "./utils/logger.js";
import "./tools/get_current_time.js"; // Ensure tools are registered

// Custom request handler wrapper to catch and log errors securely
export const opengravity = onRequest({
    maxInstances: 5,            // Prevent large bills
    timeoutSeconds: 120,        // Allow LLM some time
    region: 'us-central1'
}, async (req, res) => {
    logger.info("Received Webhook Request.");
    
    // grammy webhook handler for express-like environments
    const handler = webhookCallback(bot, "express");
    
    try {
        // Grammy's express handler usually takes 3 args in some versions, but 
        // for Firebase onRequest, we can just pass req and res.
        // If it still complains about arguments, we cast to any or check signature.
        await (handler as any)(req, res);
    } catch (err) {
        logger.error("Error in webhook handler", err);
        if (!res.headersSent) {
            res.status(200).send("OK"); // Always 200 to Telegram
        }
    }
});

