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

export const OPENCODE_FREE_MODELS = [
  'opencode/big-pickle',
  'opencode/gpt-5-nano',
  'opencode/mimo-v2-omni-free',
  'opencode/mimo-v2-pro-free',
  'opencode/minimax-m2.5-free',
  'opencode/nemotron-3-super-free'
] as const;

export type OpenCodeFreeModel = typeof OPENCODE_FREE_MODELS[number];

const MODEL_SELECTION_PROMPT = `Eres el Selector de Modelo de OpenCode.

## TUS MODELOS GRATIS DISPONIBLES
\`\`\`
opencode/minimax-m2.5-free    → Arquitectura, lógica compleja, documentos
opencode/big-pickle          → Code review, análisis profundo
opencode/mimo-v2-omni-free   → Tareas simples, rápido
opencode/mimo-v2-pro-free    → Programación, código
opencode/nemotron-3-super-free → Agente, tool calling, APIs
opencode/gpt-5-nano          → Muy rápido, tareas básicas
\`\`\`

## TAREA
Selecciona el mejor modelo para esta tarea: %TASK%

Responde SOLO con el nombre del modelo (ej: opencode/minimax-m2.5-free)`;

const PLAN_PROMPT = `Eres el Planificador Maestro de OpenGravity.

## MODELOS GRATIS DE OPENCODE
- opencode/minimax-m2.5-free: Arquitectura, lógica compleja, documentos
- opencode/big-pickle: Code review, análisis profundo
- opencode/mimo-v2-omni-free: Tareas simples, rápido
- opencode/mimo-v2-pro-free: Programación, código
- opencode/nemotron-3-super-free: Agente, tool calling
- opencode/gpt-5-nano: Muy rápido, básico

## ESTRUCTURA DE PLAN
Responde EXACTAMENTE así:
PROYECTO: [nombre-en-kebab-case]
MODELO: [uno-de-los-modelos-de-arriba]
PASOS:
1. [paso 1]
2. [paso 2]
3. [etc]

## REGLAS
- Máximo 5 pasos
- Cada paso debe ser ejecutable por OpenCode
- Usa el modelo más apropiado para la tarea

TAREA: %TASK%`;

export async function selectBestModel(task: string): Promise<string> {
  logger.info(`[MiniMax] Selecting best model for: ${task.substring(0, 50)}...`);

  return new Promise((resolve) => {
    const proc = spawn('opencode', ['run', '--model', 'minimax/MiniMax-M2.5', MODEL_SELECTION_PROMPT.replace('%TASK%', task)], {
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

    proc.on('close', () => {
      clearTimeout(timeoutId);
      const model = parseModelSelection(output);
      logger.info(`[MiniMax] Selected model: ${model}`);
      resolve(model);
    });

    proc.on('error', () => {
      clearTimeout(timeoutId);
      resolve('opencode/minimax-m2.5-free');
    });

    timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve('opencode/minimax-m2.5-free');
    }, 60000);
  });
}

function parseModelSelection(output: string): string {
  for (const model of OPENCODE_FREE_MODELS) {
    if (output.includes(model)) {
      return model;
    }
  }
  
  const line = output.split('\n').find(l => 
    l.includes('opencode/') || l.includes('mimo') || 
    l.includes('pickle') || l.includes('nemotron')
  );
  
  if (line) {
    const match = line.match(/opencode\/[a-z0-9-]+/i);
    if (match) {
      return match[0].toLowerCase();
    }
  }
  
  return 'opencode/minimax-m2.5-free';
}

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
          recommendedModel: 'opencode/minimax-m2.5-free',
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
        recommendedModel: 'opencode/minimax-m2.5-free',
        projectName: `proyecto-${Date.now()}`,
        steps: [task]
      });
    });

    timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        plan: task,
        recommendedModel: 'opencode/minimax-m2.5-free',
        projectName: `proyecto-${Date.now()}`,
        steps: [task]
      });
    }, 120000);
  });
}

function parsePlanOutput(output: string): PlanResult {
  const lines = output.split('\n');
  
  let projectName = `proyecto-${Date.now()}`;
  let recommendedModel = 'opencode/minimax-m2.5-free';
  const steps: string[] = [];
  let planDetail = '';
  let inPlan = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('PROYECTO:')) {
      projectName = trimmed.substring(9).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (!projectName) projectName = `proyecto-${Date.now()}`;
    } else if (trimmed.startsWith('MODELO:')) {
      const model = trimmed.substring(7).trim();
      if (model.includes('opencode/') || model.includes('mimo') || model.includes('pickle') || model.includes('nemotron')) {
        recommendedModel = model.toLowerCase();
      }
    } else if (trimmed.match(/^\d+\.\s*(.+)/)) {
      const step = trimmed.match(/^\d+\.\s*(.+)/)![1];
      if (step && !step.includes('MODELO') && !step.includes('PROYECTO')) {
        steps.push(step);
      }
    } else if (trimmed === 'PLAN_DETALLADO:' || trimmed === '---') {
      inPlan = true;
    } else if (inPlan && trimmed && !trimmed.startsWith('#') && !trimmed.includes('MODELO')) {
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
  const modelToUse = model || 'opencode/minimax-m2.5-free';
  logger.info(`[OpenCode] Executing with ${modelToUse}: ${task.substring(0, 50)}...`);

  return new Promise((resolve) => {
    const args = ['run', '--model', modelToUse, task];

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
    });

    proc.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
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
