import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { memory } from '../memory/firestore.js';
import { registry } from '../tools/registry.js';
import { chatCompletion } from './llm.js';
import { systemPrompt } from './prompt.js';
import { Orchestrator, executeWithOrchestrator, stopACPServerAndCleanup } from './orchestrator.js';
import { getACPServer } from './opencode_acp_server.js';
import type { OrchestratorResult } from './orchestrator.js';
import { buildTelegramNotifications, formatQuestionNotification, formatProgressNotification, formatACPServerStarted } from './orchestrator_telegram.js';
import { sendProgressAudio, sendQuestionAudio } from './audio_progress.js';
import type { ExecutionState } from './executor.js';
import { isVoiceEnabled, isAutoRespondEnabled } from '../tts/elevenlabs.js';

const MAX_TOOL_CONTENT_LENGTH = 500;

let activeOrchestrator: Orchestrator | null = null;

export function setActiveOrchestrator(orchestrator: Orchestrator | null): void {
  activeOrchestrator = orchestrator;
}

export function getActiveOrchestrator(): Orchestrator | null {
  return activeOrchestrator;
}

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

  const history = await memory.getHistory(userId, 12);
  const truncatedHistory = truncateToolMessages(history);
  
  if (content.startsWith('/orchestrate ') || content.startsWith('/ejecutar ')) {
    const task = content.replace(/^\/(orchestrate|ejecutar)\s+/, '');
    return await processOrchestratedTask(userId, task, ctx);
  }

  if (content.match(/^[0-9]+$/)) {
    const selectedOption = parseInt(content);
    const orchestrator = getActiveOrchestrator();
    if (orchestrator && orchestrator.hasPendingQuestion()) {
      const question = orchestrator.getPendingQuestion();
      if (question && question.options && question.options.length >= selectedOption) {
        orchestrator.sendAnswer(question.options[selectedOption - 1]);
        return `✅ Respuesta "${question.options[selectedOption - 1]}" enviada. Continuando ejecución...`;
      }
    }
  }

  if (content.toLowerCase() !== '/stop' && content !== '/stop') {
    const orchestrator = getActiveOrchestrator();
    if (orchestrator && orchestrator.hasPendingQuestion()) {
      orchestrator.sendAnswer(content);
      return `✅ Respuesta "${content}" enviada. Continuando ejecución...`;
    }
  }

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
    userId,
    ctx,
    onStateChange: async (state: ExecutionState, data?: any) => {
      logger.info(`Orchestrator state: ${state}`, data);
      
      if (ctx && (state === 'executing' || state === 'validating')) {
        const message = formatProgressNotification(
          data?.taskId ? parseInt(data.taskId) : 1,
          3,
          `Ejecutando ${state}`
        );
        
        if (isVoiceEnabledInContext(ctx, userId)) {
          await sendProgressAudio(ctx, userId, { step: 1, totalSteps: 3, message: state });
        } else {
          await ctx.reply(message);
        }
      }
    },
    onQuestion: async (question) => {
      logger.info(`Question received: ${question.text}`);
      
      if (ctx) {
        await sendQuestionAudio(ctx, userId, question.text, question.options || []);
        
        const textMessage = formatQuestionNotification(question);
        await ctx.reply(textMessage);
        
        setActiveOrchestrator(orchestrator);
      }
    },
    onProgress: async (step, total, message) => {
      if (ctx) {
        if (isVoiceEnabledInContext(ctx, userId)) {
          await sendProgressAudio(ctx, userId, { step, totalSteps: total, message });
        } else {
          await ctx.reply(formatProgressNotification(step, total, message));
        }
      }
    }
  });

  setActiveOrchestrator(orchestrator);

  try {
    const result = await orchestrator.execute(task);

    const notifications = buildTelegramNotifications(result);
    let finalMessage = notifications.join('\n\n');

    if (result.pendingQuestion) {
      finalMessage += '\n\n' + formatQuestionNotification(result.pendingQuestion);
    }

    await memory.addMessage(userId, 'assistant', finalMessage);
    
    if (result.pendingQuestion) {
      setActiveOrchestrator(orchestrator);
    } else {
      setActiveOrchestrator(null);
    }
    
    return finalMessage;
  } catch (error: any) {
    logger.error('Orchestrator failed:', error);
    setActiveOrchestrator(null);
    const errorMsg = `❌ Error en el Orquestador: ${error.message}`;
    await memory.addMessage(userId, 'assistant', errorMsg);
    return errorMsg;
  }
}

function isVoiceEnabledInContext(ctx: any, userId: string): boolean {
  return isVoiceEnabled(userId) && isAutoRespondEnabled(userId);
}

export { Orchestrator };
export type { OrchestratorResult };
