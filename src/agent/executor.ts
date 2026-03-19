import { logger } from '../utils/logger.js';
import { getModelByType, ModelType, LocalModel } from './local_models.js';
import { runOpenCode } from './opencode_client.js';
import { ACPServer, Question } from './opencode_acp_server.js';
import { config } from '../config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export type ExecutionState = 
  | 'initialized'
  | 'planning'
  | 'executing'
  | 'validating'
  | 'error_recovery'
  | 'pivot_model'
  | 'completed'
  | 'failed';

export interface AtomicTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface ExecutionPlan {
  tasks: AtomicTask[];
  currentTaskIndex: number;
}

export interface ExecutionResult {
  success: boolean;
  state: ExecutionState;
  summary: string;
  errors: string[];
  pivotModel?: string;
  logs: string[];
}

export type StateChangeCallback = (state: ExecutionState, data?: any) => void;

const ERROR_STRUCTURE_PATH = config.ERROR_STRUCTURE_PATH;
const PLAN_STRUCTURE_PATH = config.PLAN_STRUCTURE_PATH;

export class Executor {
  private state: ExecutionState = 'initialized';
  private plan: ExecutionPlan;
  private projectPath: string;
  private model: LocalModel;
  private logs: string[] = [];
  private errors: string[] = [];
  private stateCallback?: StateChangeCallback;
  private maxRetries = 3;
  private currentRetryCount = 0;
  private planStructure: string = '';
  private initialTask: string;
  private isInitialized: boolean = false;

  constructor(
    projectName: string,
    modelType: ModelType,
    initialTask: string,
    stateCallback?: StateChangeCallback
  ) {
    this.projectPath = path.join(config.LOCAL_PROJECTS_PATH, projectName);
    this.model = getModelByType(modelType)!;
    this.initialTask = initialTask;
    this.plan = {
      tasks: [{ id: '1', description: initialTask, status: 'pending' }],
      currentTaskIndex: 0
    };
    this.stateCallback = stateCallback;
  }

  private setState(newState: ExecutionState, data?: any) {
    this.state = newState;
    this.logs.push(`[${newState}] ${new Date().toISOString()}`);
    this.stateCallback?.(newState, data);
    logger.info(`Executor state: ${newState}`);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.setState('initialized');
    
    try {
      await fs.mkdir(this.projectPath, { recursive: true });
      this.logs.push(`Created workspace: ${this.projectPath}`);
      
      this.planStructure = await this.loadPlanStructure();
      this.logs.push(`Loaded plan structure (${this.planStructure.length} chars)`);
      this.isInitialized = true;
    } catch (error: any) {
      logger.error('Failed to initialize executor:', error);
      throw error;
    }
  }

  private async loadPlanStructure(): Promise<string> {
    try {
      return await fs.readFile(PLAN_STRUCTURE_PATH, 'utf-8');
    } catch {
      return DEFAULT_PLAN_STRUCTURE;
    }
  }

  private async loadErrorStructure(): Promise<string> {
    try {
      return await fs.readFile(ERROR_STRUCTURE_PATH, 'utf-8');
    } catch {
      return DEFAULT_ERROR_STRUCTURE;
    }
  }

  async run(): Promise<ExecutionResult> {
    await this.initialize();
    this.setState('planning');

    try {
      const tasks = await this.generatePlan();
      this.plan.tasks = tasks;
      
      this.setState('executing');
      
      for (let i = 0; i < this.plan.tasks.length; i++) {
        this.plan.currentTaskIndex = i;
        const task = this.plan.tasks[i];
        task.status = 'running';
        
        const success = await this.executeTask(task);
        
        if (!success) {
          const recovered = await this.handleError(task);
          if (!recovered) {
            return this.buildResult(false, 'failed', 'Error recovery failed');
          }
        }
        
        task.status = 'completed';
      }

      this.setState('completed');
      return this.buildResult(true, 'completed', 'All tasks completed successfully');
    } catch (error: any) {
      logger.error('Executor run failed:', error);
      this.setState('failed');
      return this.buildResult(false, 'failed', error.message);
    }
  }

  async runWithACP(acpServer: ACPServer): Promise<ExecutionResult> {
    await this.initialize();
    this.setState('planning');

    try {
      const tasks = await this.generatePlan();
      this.plan.tasks = tasks;
      
      this.setState('executing');
      
      this.logs.push('Using ACP server for task execution');

      const task = this.plan.tasks[0];
      task.status = 'running';

      const result = await acpServer.runTask(task.description);

      if (result.success) {
        task.status = 'completed';
        this.setState('completed');
        return this.buildResult(true, 'completed', result.output || 'Task completed successfully');
      } else {
        this.errors.push(`Task failed: ${result.error}`);
        this.setState('failed');
        return this.buildResult(false, 'failed', result.error || 'Task execution failed');
      }
    } catch (error: any) {
      logger.error('Executor runWithACP failed:', error);
      this.setState('failed');
      return this.buildResult(false, 'failed', error.message);
    }
  }

  onQuestion(callback: (question: Question) => void): void {
    this.questionCallback = callback;
  }

  private questionCallback?: (question: Question) => void;

  private async generatePlan(): Promise<AtomicTask[]> {
    this.logs.push('Generating execution plan...');

    const compactTask = this.initialTask
      .replace(/\s+/g, ' ')
      .trim();

    const tasks: AtomicTask[] = [
      {
        id: '1',
        description: compactTask,
        status: 'pending'
      }
    ];
    
    return tasks;
  }

  private async executeTask(task: AtomicTask): Promise<boolean> {
    this.setState('validating', { taskId: task.id });
    this.logs.push(`Executing task: ${task.description.substring(0, 100)}...`);
    this.logs.push(`Using model: ${this.model.opencodeModel}`);

    try {
      const result = await runOpenCode(task.description, this.projectPath, {
        model: this.model.opencodeModel
      });
      
      if (result.exitCode === 0) {
        this.logs.push(`Task ${task.id} completed successfully`);
        return true;
      } else {
        this.errors.push(`Task ${task.id} failed with exit code ${result.exitCode}`);
        task.error = result.output;
        return false;
      }
    } catch (error: any) {
      task.error = error.message;
      this.errors.push(`Task ${task.id} execution error: ${error.message}`);
      return false;
    }
  }

  private async handleError(task: AtomicTask): Promise<boolean> {
    this.setState('error_recovery', { taskId: task.id });
    
    const errorStructure = await this.loadErrorStructure();
    this.logs.push(`Loaded error structure for recovery: ${task.error}`);
    
    const debugFile = path.join(this.projectPath, 'debug_repro.txt');
    await fs.writeFile(debugFile, task.error || 'No error details');
    this.logs.push(`Created debug file: ${debugFile}`);
    
    if (this.currentRetryCount >= this.maxRetries) {
      const pivotResult = await this.pivotToSpecialist(task);
      return pivotResult;
    }
    
    this.currentRetryCount++;
    this.logs.push(`Retry attempt ${this.currentRetryCount}/${this.maxRetries}`);
    
    return await this.executeTask(task);
  }

  private async pivotToSpecialist(task: AtomicTask): Promise<boolean> {
    this.setState('pivot_model', { taskId: task.id, originalModel: this.model.id });
    
    let specialistType: ModelType;
    
    switch (this.model.type) {
      case 'architect':
        specialistType = 'architect';
        break;
      case 'agent':
      case 'fast_logic':
        specialistType = 'fast_logic';
        break;
      case 'auditor':
        specialistType = 'auditor';
        break;
      default:
        specialistType = 'auditor';
    }
    
    const specialist = getModelByType(specialistType);
    this.logs.push(`Pivoting to specialist model: ${specialist?.id}`);
    
    const originalModel = this.model;
    this.model = specialist!;
    
    const success = await this.executeTask(task);
    
    this.model = originalModel;
    return success;
  }

  private buildResult(success: boolean, state: ExecutionState, summary: string): ExecutionResult {
    return {
      success,
      state,
      summary,
      errors: this.errors,
      logs: this.logs
    };
  }

  getState(): ExecutionState {
    return this.state;
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}

const DEFAULT_PLAN_STRUCTURE = `# Estructura del Plan de Ejecución

## Fases
1. Análisis de Requisitos
2. Implementación
3. Validación Técnica

## Tareas Atómicas
- Dividir el trabajo en tareas pequeñas
- Validar después de cada paso
- Manejar errores inmediatamente
`;

const DEFAULT_ERROR_STRUCTURE = `# Estructura de Recuperación de Errores

## Pasos
1. Detectar el error (exit code != 0)
2. Cargar el archivo de error
3. Identificar el origen (traceback/log)
4. Aisolar en archivo debug_repro
5. Intentar recuperación automática
6. Si falla, pivotar a modelo especialista
`;
