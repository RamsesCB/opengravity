import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export interface OpenCodeResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
}

export interface PlanResult {
  plan: string;
  recommendedModel: string;
  projectName: string;
  steps: string[];
}

const PLAN_PROMPT = `Eres el Planificador Maestro de OpenGravity.

## TU TAREA
Recibirás una tarea del usuario. Tu trabajo es:
1. Crear un PLAN detallado para ejecutarla
2. RECOMENDAR el mejor modelo de OpenCode para ejecutarla
3. Crear el NOMBRE del proyecto

## MODELOS DE OPENCODE (usa solo estos)
- MiniMax-M2.5: Para arquitectura, lógica compleja, documentos
- MiniMax-M2.7: Mejor para código general, más reciente
- Kimi-K2.5: Para análisis y review profundo
- GLM-5: Rápido para tareas simples

## ESTRUCTURA DE PLAN
\`\`\`
PROYECTO: [nombre-en-kebab-case]
MODELO_RECOMENDADO: [uno de los modelos de arriba]
PASOS:
1. [descripción del paso 1]
2. [descripción del paso 2]
3. [etc]

PLAN_DETALLADO:
[tarea 1]
---
[tarea 2]
---
[tarea 3]
\`\`\`

## REGLAS
- Máximo 5 pasos
- Cada paso debe ser ejecutable por OpenCode
- El modelo debe ser el más apropiado para la tarea
- Usa kebab-case para el nombre del proyecto

## ARCHIVOS DE REFERENCIA
- Plan: /home/slerx/Datos/Proyectos/Plan_structure.md
- Error: /home/slerx/Datos/Proyectos/Error_structure.md

TAREA: %TASK%

Responde SOLO con el formato de estructura definido arriba, sin explicaciones adicionales.`;

export async function generatePlanWithMiniMax(task: string): Promise<PlanResult> {
  logger.info(`[MiniMax] Generating plan for: ${task.substring(0, 50)}...`);

  return new Promise((resolve) => {
    const proc = spawn('opencode', ['run', '--model', 'minimax/MiniMax-M2.5', PLAN_PROMPT.replace('%TASK%', task)], {
      cwd: '/home/slerx/Datos/Proyectos',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: '1',
        OPENCODE_DISABLE_AUTOUPDATE: 'true'
      }
    });

    let output = '';
    let timeoutId: NodeJS.Timeout;

    proc.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      logger.warn(`[MiniMax] ${data.toString().trim()}`);
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      logger.info(`[MiniMax] Plan generated, exit code: ${code}`);

      try {
        const result = parsePlanOutput(output);
        resolve(result);
      } catch (e) {
        resolve({
          plan: task,
          recommendedModel: 'MiniMax-M2.5',
          projectName: `proyecto-${Date.now()}`,
          steps: [task]
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      logger.error(`[MiniMax] Error:`, err);
      resolve({
        plan: task,
        recommendedModel: 'MiniMax-M2.5',
        projectName: `proyecto-${Date.now()}`,
        steps: [task]
      });
    });

    timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        plan: task,
        recommendedModel: 'MiniMax-M2.5',
        projectName: `proyecto-${Date.now()}`,
        steps: [task]
      });
    }, 120000);
  });
}

function parsePlanOutput(output: string): PlanResult {
  const lines = output.split('\n');
  
  let projectName = `proyecto-${Date.now()}`;
  let recommendedModel = 'MiniMax-M2.5';
  const steps: string[] = [];
  let planDetail = '';
  let inPlan = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('PROYECTO:')) {
      projectName = trimmed.substring(9).trim().toLowerCase().replace(/\s+/g, '-');
    } else if (trimmed.startsWith('MODELO_RECOMENDADO:')) {
      recommendedModel = trimmed.substring(19).trim();
    } else if (trimmed.startsWith('PASOS:') || trimmed.match(/^\d+\./)) {
      if (trimmed.match(/^\d+\.\s*(.+)/)) {
        steps.push(trimmed.match(/^\d+\.\s*(.+)/)![1]);
      }
    } else if (trimmed === 'PLAN_DETALLADO:') {
      inPlan = true;
    } else if (inPlan && trimmed && !trimmed.startsWith('#')) {
      planDetail += trimmed + '\n';
    }
  }

  if (steps.length === 0) {
    steps.push('Ejecutar la tarea directamente');
  }

  return {
    plan: planDetail || output.substring(0, 500),
    recommendedModel,
    projectName,
    steps
  };
}

export async function runOpenCodeTask(
  task: string,
  projectPath: string,
  model?: string,
  timeoutMs: number = 180000
): Promise<OpenCodeResult> {
  logger.info(`[OpenCode] Executing: ${task.substring(0, 50)}...`);

  return new Promise((resolve) => {
    const args = model 
      ? ['run', '--model', model, task]
      : ['run', task];

    const proc = spawn('opencode', args, {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: '1',
        OPENCODE_DISABLE_AUTOUPDATE: 'true'
      }
    });

    let output = '';
    let errorOutput = '';
    let timeoutId: NodeJS.Timeout;

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      logger.info(`[OpenCode] ${text.trim().substring(0, 100)}`);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      logger.warn(`[OpenCode Error] ${data.toString().trim().substring(0, 100)}`);
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        success: code === 0,
        output,
        error: errorOutput || undefined,
        exitCode: code || 0
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        output: '',
        error: err.message
      });
    });

    timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        success: false,
        output,
        error: `Timeout after ${timeoutMs}ms`
      });
    }, timeoutMs);
  });
}

export async function checkOpenCodeAvailable(): Promise<boolean> {
  try {
    const result = await runOpenCodeTask('test', '/tmp', undefined, 10000);
    return result.success;
  } catch {
    return false;
  }
}
