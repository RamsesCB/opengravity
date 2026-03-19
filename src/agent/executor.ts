import { logger } from '../utils/logger.js';
import { runOpenCode, OpenCodeResult } from './opencode_client.js';
import { config } from '../config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export type ExecutionState = 
  | 'initialized'
  | 'planning'
  | 'executing'
  | 'completed'
  | 'failed';

export interface PlanStep {
  id: number;
  description: string;
  prompt: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  output?: string;
}

export interface ExecutionResult {
  success: boolean;
  state: ExecutionState;
  summary: string;
  steps: PlanStep[];
  errors: string[];
  logs: string[];
}

export interface ExecutorCallbacks {
  onProgress?: (message: string) => Promise<void>;
  onStepComplete?: (step: PlanStep) => Promise<void>;
}

const DEFAULT_TIMEOUT = 180000;

export class Executor {
  private state: ExecutionState = 'initialized';
  private projectPath: string;
  private initialTask: string;
  private steps: PlanStep[] = [];
  private logs: string[] = [];
  private errors: string[] = [];
  private callbacks?: ExecutorCallbacks;

  constructor(
    projectPath: string,
    initialTask: string,
    callbacks?: ExecutorCallbacks
  ) {
    this.projectPath = projectPath;
    this.initialTask = initialTask;
    this.callbacks = callbacks;
  }

  private log(message: string) {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
    logger.info(`[Executor] ${message}`);
    this.callbacks?.onProgress?.(message);
  }

  private async ensureWorkspace(): Promise<void> {
    try {
      await fs.mkdir(this.projectPath, { recursive: true });
      this.log(`Workspace ready: ${this.projectPath}`);
    } catch (error: any) {
      this.log(`Failed to create workspace: ${error.message}`);
      throw error;
    }
  }

  async run(): Promise<ExecutionResult> {
    try {
      await this.ensureWorkspace();
      this.state = 'planning';
      this.log('Phase 1: Generating execution plan...');

      await this.generatePlan();
      
      this.state = 'executing';
      this.log(`Phase 2: Executing ${this.steps.length} step(s)...`);

      await this.executeSteps();

      this.state = 'completed';
      const summary = this.steps
        .map(s => `${s.status === 'done' ? '✅' : '❌'} ${s.description}`)
        .join('\n');

      return {
        success: this.steps.every(s => s.status === 'done'),
        state: this.state,
        summary,
        steps: this.steps,
        errors: this.errors,
        logs: this.logs
      };
    } catch (error: any) {
      this.state = 'failed';
      this.errors.push(error.message);
      return {
        success: false,
        state: this.state,
        summary: error.message,
        steps: this.steps,
        errors: this.errors,
        logs: this.logs
      };
    }
  }

  private async generatePlan(): Promise<void> {
    const planningPrompt = `Eres un planificador de tareas de programación.
Tu trabajo es SOLO crear un plan JSON, NO ejecutar nada.

TAREA: ${this.initialTask}

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin explicaciones) con este formato exacto:
{
  "steps": [
    {
      "id": 1,
      "description": "descripción corta del paso",
      "prompt": "instrucción completa y detallada para este paso"
    }
  ]
}

Reglas:
- Máximo 3 pasos para tareas simples
- El "prompt" de cada paso debe ser una instrucción completa para crear/modificar archivos
- No incluyas pasos de "verificación" o "revisión"
- Para tareas simples (crear un archivo), usa 1 solo paso`;

    this.log('Asking OpenCode to generate plan...');

    const result = await runOpenCode(planningPrompt, this.projectPath, {
      timeout: 120000,
      model: config.OPENCODE_DEFAULT_MODEL
    });

    if (!result.success && result.exitCode === 124) {
      this.log('Plan generation timed out, using direct execution');
      this.steps = [{
        id: 1,
        description: 'Execute task directly',
        prompt: this.initialTask,
        status: 'pending'
      }];
      return;
    }

    try {
      const jsonMatch = result.output.match(/\{[\s\S]*"steps"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in plan response');
      }

      const planData = JSON.parse(jsonMatch[0]);
      this.steps = planData.steps.map((s: any, i: number) => ({
        id: s.id || i + 1,
        description: s.description,
        prompt: s.prompt,
        status: 'pending' as const
      }));

      this.log(`Plan generated: ${this.steps.length} step(s)`);
    } catch (e: any) {
      this.log(`Failed to parse plan, using direct execution: ${e.message}`);
      this.steps = [{
        id: 1,
        description: 'Execute task directly',
        prompt: this.initialTask,
        status: 'pending'
      }];
    }
  }

  private async executeSteps(): Promise<void> {
    for (const step of this.steps) {
      step.status = 'running';
      this.log(`Executing step ${step.id}/${this.steps.length}: ${step.description}`);

      const result = await runOpenCode(step.prompt, this.projectPath, {
        timeout: DEFAULT_TIMEOUT,
        model: config.OPENCODE_DEFAULT_MODEL
      });

      step.output = result.output;

      if (result.success) {
        step.status = 'done';
        this.callbacks?.onStepComplete?.(step);
        this.log(`Step ${step.id} completed successfully`);
      } else if (result.exitCode === 124) {
        step.status = 'failed';
        this.errors.push(`Step ${step.id} timed out`);
        this.log(`Step ${step.id} timed out after ${DEFAULT_TIMEOUT}ms`);
      } else {
        step.status = 'failed';
        this.errors.push(`Step ${step.id}: ${result.error || 'Unknown error'}`);
        this.log(`Step ${step.id} failed: ${result.error}`);
      }
    }
  }

  getState(): ExecutionState {
    return this.state;
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}
