import Groq from 'groq-sdk';
import { config } from '../config.js';

let groq: Groq;
try {
  groq = new Groq({
    apiKey: config.GROQ_API_KEY,
  });
} catch (error) {
  console.warn("GROQ_API_KEY not configured or invalid.");
}

export async function chatCompletion(messages: any[], tools?: any[]): Promise<any> {

  if (!groq) {
    throw new Error("Groq SDK is not initialized properly. Check your GROQ_API_KEY.");
  }
  
  const model = "llama-3.3-70b-versatile";
  
  const options: any = {
    messages,
    model,
    temperature: 0.1,
  };

  if (tools && tools.length > 0) {
    options.tools = tools;
    options.tool_choice = "auto";
  }

  return groq.chat.completions.create(options);
}
