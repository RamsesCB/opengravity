import { logger } from '../utils/logger.js';
import { generatePlanWithMiniMax, runOpenCodeTask, PlanResult } from './minimax_client.js';
import { config } from '../config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export type ExecutionState = 
  | 'initialized'
  | 'planning'
  | 'executing'
  | 'completed'
  | 'failed';

export interface ExecutionResult {
  success: boolean;
  state: ExecutionState;
  summary: string;
  output: string;
  plan: PlanResult | null;
  errors: string[];
  logs: string[];
}

export interface ExecutorCallbacks {
  onProgress?: (message: string) => Promise<void>;
}

export class Executor {
  private state: ExecutionState = 'initialized';
  private projectPath: string;
  private projectName: string;
  private logs: string[] = [];
  private errors: string[] = [];
  private callbacks?: ExecutorCallbacks;
  private initialTask: string;

  constructor(
    projectPath: string,
    projectName: string,
    initialTask: string,
    callbacks?: ExecutorCallbacks
  ) {
    this.projectPath = projectPath;
    this.projectName = projectName;
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
      this.log('Phase 1: Generating plan with MiniMax...');

      const planResult = await generatePlanWithMiniMax(this.initialTask);
      this.log(`Plan generated: ${planResult.projectName}`);
      this.log(`Recommended model: ${planResult.recommendedModel}`);
      this.log(`Steps: ${planResult.steps.length}`);

      this.state = 'executing';
      this.log('Phase 2: Executing with OpenCode...');

      let allOutput = '';
      let success = true;

      for (let i = 0; i < planResult.steps.length; i++) {
        const step = planResult.steps[i];
        this.log(`Executing step ${i + 1}/${planResult.steps.length}: ${step.substring(0, 50)}...`);

        const result = await runOpenCodeTask(
          step,
          this.projectPath,
          planResult.recommendedModel,
          180000
        );

        allOutput += `\n=== STEP ${i + 1} ===\n${result.output}`;

        if (!result.success) {
          success = false;
          this.errors.push(`Step ${i + 1} failed: ${result.error}`);
          this.log(`Step ${i + 1} failed`);
        } else {
          this.log(`Step ${i + 1} completed`);
        }
      }

      this.state = success ? 'completed' : 'failed';
      
      return {
        success,
        state: this.state,
        summary: success 
          ? `Task completed successfully with ${planResult.recommendedModel}` 
          : `Task completed with ${this.errors.length} error(s)`,
        output: allOutput,
        plan: planResult,
        errors: this.errors,
        logs: this.logs
      };
    } catch (error: any) {
      this.state = 'failed';
      this.errors.push(error.message);
      this.log(`Executor error: ${error.message}`);
      return {
        success: false,
        state: this.state,
        summary: error.message,
        output: '',
        plan: null,
        errors: this.errors,
        logs: this.logs
      };
    }
  }

  getState(): ExecutionState {
    return this.state;
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}
