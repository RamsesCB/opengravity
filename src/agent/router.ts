import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { chatCompletion } from './llm.js';
import { getModelByType, ModelType, LOCAL_MODELS } from './local_models.js';

export interface RouterDecision {
  modelId: string;
  modelType: ModelType;
  reason: string;
  projectName: string;
  skills: string[];
}

const ROUTER_SYSTEM_PROMPT = `Eres el Router del Orquestador Multi-Modelo de OpenGravity.
Tu única tarea es analizar la petición del usuario y elegir el modelo local óptimp para ejecutarla.

Catálogo de Modelos Locales:
- minmax_m2.5 (Arquitecto): System Design, lógica compleja, documentos, presentaciones
- nemotron_3_super (Agente): Tool Calling, APIs, flujos empresariales
- mimo_v2_flash (Lógica Rápida): Programación rápida, Flutter/Dart/JS, autocompletado, razonamiento matemático
- big_pickle (Auditor): Code Review extenso, debugging profundo, documentación técnica

Responde en JSON exacto con este formato:
{
  "modelId": "id_del_modelo",
  "modelType": "architect|agent|fast_logic|auditor",
  "reason": "explicación breve de por qué se elige este modelo",
  "projectName": "nombre_del_proyecto_en_kebab_case",
  "skills": ["skill1", "skill2"]
}

Normas:
1. projectName debe ser kebab-case (ej: mi-proyecto)
2. skills deben ser las habilidades necesarias del directorio /home/slerx/Datos/Proyectos/Skills_Engramd
3. Si es diseño de sistema o documentos -> architect
4. Si necesita tool calling o APIs -> agent
5. Si es programación rápida o Flutter/JS -> fast_logic
6. Si es code review o debugging -> auditor`;

export async function routeTask(userMessage: string, history: any[]): Promise<RouterDecision> {
  const messages: any[] = [
    { role: 'system', content: ROUTER_SYSTEM_PROMPT },
    { role: 'user', content: `Analiza esta petición y decide el modelo:\n\n${userMessage}` }
  ];

  try {
    const response = await chatCompletion(messages);
    const content = response.choices[0].message.content;
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('Router did not return JSON, using default model');
      return getDefaultDecision(userMessage);
    }

    const decision = JSON.parse(jsonMatch[0]);
    logger.info(`Router selected model: ${decision.modelId} for task: ${decision.projectName}`);

    return {
      modelId: decision.modelId,
      modelType: decision.modelType,
      reason: decision.reason,
      projectName: decision.projectName,
      skills: decision.skills || []
    };
  } catch (error: any) {
    logger.error('Router failed, using default decision:', error);
    return getDefaultDecision(userMessage);
  }
}

function getDefaultDecision(userMessage: string): RouterDecision {
  const lower = userMessage.toLowerCase();
  
  let modelId = 'mimo_v2_flash';
  let modelType: ModelType = 'fast_logic';

  if (lower.includes('diseño') || lower.includes('documento') || lower.includes('presentación')) {
    modelId = 'minimax_m2.5';
    modelType = 'architect';
  } else if (lower.includes('api') || lower.includes('tool') || lower.includes('flujo')) {
    modelId = 'nemotron_3_super';
    modelType = 'agent';
  } else if (lower.includes('review') || lower.includes('debug') || lower.includes('documentación')) {
    modelId = 'big_pickle';
    modelType = 'auditor';
  }

  const projectName = `proyecto-${Date.now()}`;

  return {
    modelId,
    modelType,
    reason: 'Default fallback based on keyword analysis',
    projectName,
    skills: []
  };
}
