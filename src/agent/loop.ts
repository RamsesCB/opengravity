import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { memory } from '../memory/firestore.js'; // Using firestore instead of sqlite
import { registry } from '../tools/registry.js';
import { chatCompletion } from './llm.js';
import { systemPrompt } from './prompt.js';

export async function processUserMessage(userId: string, content: string): Promise<string> {
  // 1. Save user message to memory
  await memory.addMessage(userId, 'user', content);

  // 2. Fetch history
  const history = await memory.getHistory(userId, 50); // Get last 50 messages
  
  // 3. Build context
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history
  ];

  const tools = registry.getGroqToolDefinitions();

  // 4. Agent loop
  let iterations = 0;
  
  while (iterations < config.MAX_ITERATIONS) {
    iterations++;
    logger.info(`Agent loop iteration ${iterations} for user ${userId}`);
    
    try {
      const response = await chatCompletion(messages, tools);
      const choice = response.choices[0];
      const resMessage = choice.message;
      
      messages.push(resMessage);

      // If the model wants to call a tool
      if (resMessage.tool_calls && resMessage.tool_calls.length > 0) {
        // Save the assistant's tool calls intent
        await memory.addMessage(
          userId,
          'assistant',
          resMessage.content || null,
          undefined,
          undefined,
          resMessage.tool_calls
        );
        
        for (const toolCall of resMessage.tool_calls) {
          const fnName = toolCall.function.name;
          const fnArgs = toolCall.function.arguments;
          
          logger.info(`Executing tool: ${fnName} with args ${fnArgs}`);
          const tool = registry.getTool(fnName);
          
          let toolResult = "";
          if (tool) {
            try {
              const parsedArgs = fnArgs ? JSON.parse(fnArgs) : {};
              toolResult = await Promise.resolve(tool.execute(parsedArgs));
            } catch (err: any) {
              toolResult = `Error executing tool: ${err.message}`;
              logger.error(`Tool execution error`, err);
            }
          } else {
            toolResult = `Error: Tool '${fnName}' not found.`;
          }

          const toolMsg = {
            role: 'tool',
            name: fnName,
            content: toolResult,
            tool_call_id: toolCall.id,
          };
          messages.push(toolMsg);
          // Save tool response
          await memory.addMessage(userId, 'tool', toolResult, fnName, toolCall.id);
        }
      } else {
        // No tool calls, final response
        let finalContent = resMessage.content || "";
        // Clean up Llama3 tool leak artifacts
        finalContent = finalContent.replace(/<function=.*?>.*?<\/function>/gis, '').trim();
        await memory.addMessage(userId, 'assistant', finalContent);
        return finalContent;
      }
      
    } catch (error: any) {
      logger.error('Error during LLM completion:', error);
      return `Lo siento, ocurrió un error interno: ${error.message}`;
    }
  }

  const timeoutMsg = "Alcancé el límite máximo de iteraciones pensando en tu solicitud.";
  await memory.addMessage(userId, 'assistant', timeoutMsg);
  return timeoutMsg;
}
