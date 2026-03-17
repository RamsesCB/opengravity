import Groq from 'groq-sdk';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let groq: Groq;
try {
  groq = new Groq({
    apiKey: config.GROQ_API_KEY,
  });
} catch (error) {
  console.warn("GROQ_API_KEY not configured or invalid.");
}

/**
 * Enhanced chatCompletion with OpenRouter fallback to prevent Rate Limits.
 */
export async function chatCompletion(messages: any[], tools?: any[]): Promise<any> {
  const model = "llama-3.3-70b-versatile";
  
  // Try Groq first
  if (groq && config.GROQ_API_KEY) {
    try {
      const options: any = {
        messages,
        model,
        temperature: 0.1,
      };

      if (tools && tools.length > 0) {
        options.tools = tools;
        options.tool_choice = "auto";
      }

      return await groq.chat.completions.create(options);
    } catch (error: any) {
      // If result is a Rate Limit (429) and we have OpenRouter, fallback
      if (error.status === 429 && config.OPENROUTER_API_KEY) {
        logger.warn("Groq Rate Limit reached. Falling back to OpenRouter...");
      } else {
        throw error;
      }
    }
  }

  // Fallback to OpenRouter
  if (config.OPENROUTER_API_KEY) {
    try {
      logger.info(`Using OpenRouter fallback with model: ${config.OPENROUTER_MODEL}`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/RamsesCB/opengravity",
          "X-Title": "OpenGravity Bot"
        },
        body: JSON.stringify({
          model: config.OPENROUTER_MODEL || "meta-llama/llama-3.1-70b-instruct",
          messages,
          tools: (tools && tools.length > 0) ? tools : undefined,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("OpenRouter fallback failed:", error);
      throw error;
    }
  }

  throw new Error("No LLM provider available (Groq failed and no OpenRouter key).");
}
