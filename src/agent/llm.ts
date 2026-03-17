import Groq from 'groq-sdk';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const groq = config.GROQ_API_KEY ? new Groq({ apiKey: config.GROQ_API_KEY }) : null;

function convertToGeminiFormat(messages: any[], systemPrompt?: string): { contents: any[], systemInstruction?: any } {
  const contents: any[] = [];
  let systemInstructionText = systemPrompt || "";

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstructionText = msg.content;
    } else if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant') {
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
            }
          });
        }
      }
      if (parts.length > 0) contents.push({ role: 'model', parts });
    } else if (msg.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{ functionResponse: { name: msg.name, response: { result: msg.content } } }]
      });
    }
  }

  const result: any = { contents };
  if (systemInstructionText) {
    result.systemInstruction = { parts: [{ text: systemInstructionText }] };
  }
  return result;
}

async function callGemini(messages: any[], tools?: any[]): Promise<any> {
  if (!config.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  logger.info("Attempting Gemini API...");
  const geminiBody = convertToGeminiFormat(messages);
  
  const requestBody: any = {
    ...geminiBody,
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
  };

  if (tools?.length) {
    requestBody.tools = [{ functionDeclarations: tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    })) }];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts;

  if (!parts?.length) throw new Error("Gemini returned no candidates");

  const responseMessage: any = { role: 'assistant', content: '' };
  if (parts[0].text) {
    responseMessage.content = parts[0].text;
  } else if (parts[0].functionCall) {
    responseMessage.tool_calls = [{
      id: `call_${Date.now()}`,
      type: 'function',
      function: { name: parts[0].functionCall.name, arguments: parts[0].functionCall.arguments }
    }];
  }

  return { choices: [{ message: responseMessage }] };
}

async function callOpenRouter(messages: any[], tools?: any[]): Promise<any> {
  if (!config.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

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
      model: config.OPENROUTER_MODEL,
      messages,
      tools: tools?.length ? tools : undefined,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errText}`);
  }

  return response.json();
}

export async function chatCompletion(messages: any[], tools?: any[]): Promise<any> {
  if (groq) {
    try {
      logger.info("Attempting Groq API...");
      return await groq.chat.completions.create({
        messages,
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        tools: tools?.length ? tools : undefined,
        tool_choice: tools?.length ? "auto" : undefined
      });
    } catch (error: any) {
      const isRetryable = error.status === 429 || error.status === 503 || error.message?.includes('unavailable');
      logger.warn(`Groq failed (${error.status || error.message}). Trying fallback...`);
      if (!isRetryable && !config.GEMINI_API_KEY && !config.OPENROUTER_API_KEY) throw error;
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
