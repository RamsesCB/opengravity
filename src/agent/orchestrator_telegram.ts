import { ExecutionState, ExecutionResult } from './executor.js';
import { OrchestratorResult } from './orchestrator.js';
import { Question } from './opencode_acp_server.js';

export interface TelegramNotification {
  chatId: string;
  message: string;
  parseMode?: 'Markdown' | 'HTML';
}

export function formatInitializationNotification(
  result: OrchestratorResult
): string {
  return `🤖 Inicializando entorno.\n📂 Carpeta: ${result.projectName}\n🧠 Modelo a cargo: ${result.modelUsed}`;
}

export function formatACPServerStarted(projectName: string, model: string): string {
  return `🖥️ Servidor ACP iniciado.\n📂 Proyecto: ${projectName}\n🤖 Modelo: ${model}\n\nEspera mientras preparo todo...`;
}

export function formatErrorPivotNotification(
  result: OrchestratorResult,
  file: string,
  newModel: string
): string {
  return `⚠️ Detectado error complejo en ${file}. Invocando a ${newModel} para el fix crítico...`;
}

export function formatSuccessNotification(
  result: OrchestratorResult,
  summary?: string
): string {
  return `✅ ¡Tarea completada! Plan ejecutado a la perfección sin errores de sintaxis ni de compilación tras la validación técnica.\n\n${summary || result.summary}`;
}

export function formatRecoverySuccessNotification(
  result: OrchestratorResult,
  file: string,
  step: string
): string {
  return `✅ Tarea completada. ⚠️ Hubo errores detectados en ${file} durante el paso ${step}, pero el Protocolo de Recuperación los aisló y corrigió exitosamente. Retornando control a ti.`;
}

export function formatFailureNotification(
  result: OrchestratorResult,
  modelName: string,
  logsPath?: string
): string {
  let msg = `❌ Múltiples reintentos de ${modelName} agotados sin exit code 0. Deteniendo automatización por seguridad.`;
  if (logsPath) {
    msg += `\nEl log completo lo tienes en el servidor: ${logsPath}`;
  }
  return msg;
}

export function formatStateNotification(
  state: ExecutionState,
  data?: any
): string {
  switch (state) {
    case 'initialized':
      return '🔧 Entorno inicializado';
    case 'planning':
      return '📋 Generando plan de ejecución...';
    case 'executing':
      return '⚡ Ejecutando tareas...';
    case 'validating':
      return '✅ Validando implementación...';
    case 'error_recovery':
      return '🔄 Recuperando de error...';
    case 'pivot_model':
      return '🔀 Cambiando a modelo especialista...';
    case 'completed':
      return '✅ Ejecución completada';
    case 'failed':
      return '❌ Ejecución fallida';
    default:
      return `Estado: ${state}`;
  }
}

export function formatProgressNotification(
  step: number,
  totalSteps: number,
  message: string
): string {
  let stepDescription = '';
  
  if (message.toLowerCase().includes('inici')) {
    stepDescription = 'Preparando entorno';
  } else if (message.toLowerCase().includes('anali')) {
    stepDescription = 'Analizando requisitos';
  } else if (message.toLowerCase().includes('gener')) {
    stepDescription = 'Generando código';
  } else if (message.toLowerCase().includes('implement')) {
    stepDescription = 'Implementando funcionalidades';
  } else if (message.toLowerCase().includes('valid')) {
    stepDescription = 'Validando';
  } else if (message.toLowerCase().includes('test')) {
    stepDescription = 'Ejecutando pruebas';
  } else if (message.toLowerCase().includes('complet') || message.toLowerCase().includes('finish')) {
    stepDescription = 'Completado';
  } else {
    stepDescription = 'En progreso';
  }
  
  return `⚡ Paso ${step}/${totalSteps}: ${stepDescription}`;
}

export function formatQuestionNotification(question: Question): string {
  let message = `🤔 **OpenCode necesita tu decisión:**\n\n`;
  message += `${question.text}\n\n`;
  
  if (question.options && question.options.length > 0) {
    message += `📋 **Opciones:**\n`;
    question.options.forEach((opt, i) => {
      message += `${i + 1}. ${opt}\n`;
    });
  }
  
  message += `\nResponde con el número (1, 2, 3...) o escribe tu respuesta libre.`;
  
  return message;
}

export function formatACPServerStopped(): string {
  return `🛑 Servidor ACP detenido.\n\nEl servicio de ejecución de código se ha cerrado.`;
}

export function formatACPTimeout(): string {
  return `⏰ Tiempo de espera agotado (30 minutos sin actividad).\n\nEl servidor ACP se ha detenido automáticamente.`;
}

export function buildTelegramNotifications(result: OrchestratorResult): string[] {
  const notifications: string[] = [];
  
  notifications.push(formatInitializationNotification(result));
  
  if (result.state === 'error_recovery' || result.state === 'pivot_model') {
    for (const error of result.errors) {
      const fileMatch = error.match(/([^\/]+\.[a-z]+)/);
      const file = fileMatch ? fileMatch[1] : 'desconocido';
      notifications.push(formatErrorPivotNotification(result, file, 'modelo especialista'));
    }
  }
  
  if (result.success && result.errors.length === 0) {
    notifications.push(formatSuccessNotification(result));
  } else if (result.success && result.errors.length > 0) {
    notifications.push(formatRecoverySuccessNotification(result, 'archivo', '3'));
  } else {
    notifications.push(formatFailureNotification(result, result.modelUsed));
  }
  
  return notifications;
}
