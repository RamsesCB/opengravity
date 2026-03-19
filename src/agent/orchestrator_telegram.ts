import type { OrchestratorResult } from './orchestrator.js';

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

export function buildTelegramNotifications(result: OrchestratorResult): string[] {
  const notifications: string[] = [];
  
  if (result.success) {
    notifications.push(`✅ *Tarea completada exitosamente*`);
  } else {
    notifications.push(`⚠️ *Tarea completada con errores*`);
    if (result.errors.length > 0) {
      notifications.push(`❌ Errores:\n${result.errors.map(e => `- ${e}`).join('\n')}`);
    }
  }
  
  return notifications;
}
