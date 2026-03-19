import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { memory } from '../memory/firestore.js';
import { registry } from '../tools/registry.js';
import { chatCompletion } from './llm.js';
import { systemPrompt } from './prompt.js';
import { Orchestrator } from './orchestrator.js';
import type { OrchestratorResult } from './orchestrator.js';
import { isVoiceEnabled, textToSpeech } from '../tts/elevenlabs.js';

const MAX_TOOL_CONTENT_LENGTH = 500;

function truncateToolMessages(messages: any[]): any[] {
  return messages.map(msg => {
    if (msg.role === 'tool' && msg.content && msg.content.length > MAX_TOOL_CONTENT_LENGTH) {
      return {
        ...msg,
        content: msg.content.substring(0, MAX_TOOL_CONTENT_LENGTH) + ' [Truncated]'
      };
    }
    return msg;
  });
}

export async function processUserMessage(userId: string, content: string, ctx?: any): Promise<string> {
  await memory.addMessage(userId, 'user', content);

  if (content.startsWith('/ejecutar ')) {
    const task = content.replace(/^\/ejecutar\s+/, '');
    return await processOrchestratedTask(userId, task, ctx);
  }

  const history = await memory.getHistory(userId, 12);
  const truncatedHistory = truncateToolMessages(history);
  
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...truncatedHistory
  ];

  const tools = registry.getGroqToolDefinitions();

  let iterations = 0;
  
  while (iterations < config.MAX_ITERATIONS) {
    iterations++;
    logger.info(`Agent loop iteration ${iterations} for user ${userId}`);
    
    try {
      const response = await chatCompletion(messages, tools);
      const choice = response.choices[0];
      const resMessage = choice.message;
      
      messages.push(resMessage);

      if (resMessage.tool_calls && resMessage.tool_calls.length > 0) {
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
          await memory.addMessage(userId, 'tool', toolResult, fnName, toolCall.id);
        }
      } else {
        let finalContent = resMessage.content || "";
        finalContent = finalContent
          .replace(/<function=.*?>|<\/function>|<tool_code>|<\/tool_code>|<tool_call>|<\/tool_call>/gis, '')
          .trim();

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

async function processOrchestratedTask(userId: string, task: string, ctx?: any): Promise<string> {
  logger.info(`Orchestrating task for user ${userId}: ${task}`);

  const orchestrator = new Orchestrator({
    userId
  });

  try {
    const result = await orchestrator.execute(task);

    let summary = '';
    if (result.success) {
      summary = `✅ *Tarea completada exitosamente*\n\n`;
      summary += result.steps.map((s, i) => 
        `${s.status === 'done' ? '✅' : '❌'} Paso ${i + 1}: ${s.description}`
      ).join('\n');
      summary += `\n\n📁 Proyecto: \`${result.projectName}\``;
    } else {
      summary = `⚠️ *Tarea completada con errores*\n\n`;
      summary += result.steps.map((s, i) => 
        `${s.status === 'done' ? '✅' : '❌'} Paso ${i + 1}: ${s.description}`
      ).join('\n');
      if (result.errors.length > 0) {
        summary += `\n\n❌ Errores:\n${result.errors.map(e => `- ${e}`).join('\n')}`;
      }
    }

    await memory.addMessage(userId, 'assistant', summary);
    return summary;
  } catch (error: any) {
    logger.error('Orchestrator failed:', error);
    const errorMsg = `❌ *Error en el Orquestador:* ${error.message}`;
    await memory.addMessage(userId, 'assistant', errorMsg);
    return errorMsg;
  }
}

export { Orchestrator };
export type { OrchestratorResult };
