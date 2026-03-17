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

function convertToGeminiFormat(messages: any[], systemPrompt?: string): any {
  const contents: any[] = [];
  let systemInstruction = "";

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content;
    } else if (msg.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content }]
      });
    } else if (msg.role === 'assistant') {
      const parts: any[] = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              arguments: tc.function.arguments
            }
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'model', parts });
      }
    } else if (msg.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content }]
      });
    }
  }

  const geminiMsg: any = {
    contents
  };

  if (systemInstruction) {
    geminiMsg.systemInstruction = {
      role: 'user',
      parts: [{ text: systemInstruction }]
    };
  }

  return geminiMsg;
}

async function callGemini(messages: any[], tools?: any[]): Promise<any> {
  if (!config.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  logger.info("Attempting Gemini API...");

  const geminiBody = convertToGeminiFormat(messages);
  
  const requestBody: any = {
    ...geminiBody,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    }
  };

  if (tools && tools.length > 0) {
    const toolDeclarations = tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }));
    requestBody.tools = [{ functionDeclarations: toolDeclarations }];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0]) {
    throw new Error("Gemini returned no candidates");
  }

  const candidate = data.candidates[0];
  const parts = candidate.content.parts;

  const responseMessage: any = {
    role: 'assistant',
    content: ''
  };

  if (parts && parts.length > 0) {
    if (parts[0].text) {
      responseMessage.content = parts[0].text;
    } else if (parts[0].functionCall) {
      responseMessage.tool_calls = [{
        id: `call_${Date.now()}`,
        type: 'function',
        function: {
          name: parts[0].functionCall.name,
          arguments: parts[0].functionCall.arguments
        }
      }];
    }
  }

  return {
    choices: [{ message: responseMessage }]
  };
}

async function callOpenRouter(messages: any[], tools?: any[]): Promise<any> {
  if (!config.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  logger.info(`Using OpenRouter with model: ${config.OPENROUTER_MODEL}`);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/RamsesCB/opengravity",
      "X-Title": "OpenGravity Bot"
    },
    body: JSON.stringify({
      model: config.OPENROUTER_MODEL || "google/gemini-flash-1.5-8b",
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
}

export async function chatCompletion(messages: any[], tools?: any[]): Promise<any> {
  const model = "llama-3.3-70b-versatile";

  if (groq && config.GROQ_API_KEY) {
    try {
      logger.info("Attempting Groq API...");
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
      const isRateLimit = error.status === 429;
      const isUnavailable = error.status === 503 || error.message?.includes('unavailable');

      if (isRateLimit || isUnavailable) {
        logger.warn(`Groq failed (${error.status}). Attempting Gemini fallback...`);
      } else {
        logger.warn(`Groq error: ${error.message}. Attempting Gemini fallback...`);
      }
    }
  }

  if (config.GEMINI_API_KEY) {
    try {
      return await callGemini(messages, tools);
    } catch (error: any) {
      logger.error(`Gemini fallback failed: ${error.message}`);
    }
  }

  if (config.OPENROUTER_API_KEY) {
    try {
      return await callOpenRouter(messages, tools);
    } catch (error: any) {
      logger.error(`OpenRouter fallback failed: ${error.message}`);
    }
  }

  throw new Error("All LLM providers failed (Groq, Gemini, OpenRouter).");
}
