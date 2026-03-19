import { logger } from '../utils/logger.js';
import { runWithMiniMax, runOpenCodeTask } from './minimax_client.js';
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
  private initialTask: string;
  private logs: string[] = [];
  private errors: string[] = [];
  private callbacks?: ExecutorCallbacks;

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
      this.log('MiniMax orchestrator: Planning task...');

      this.state = 'executing';
      this.log('MiniMax orchestrator: Executing with OpenCode...');

      const result = await runWithMiniMax(
        this.initialTask,
        this.projectPath,
        300000
      );

      if (result.success) {
        this.state = 'completed';
        this.log('Task completed successfully');
        return {
          success: true,
          state: this.state,
          summary: 'Task executed successfully by OpenCode with MiniMax orchestration',
          output: result.output,
          errors: this.errors,
          logs: this.logs
        };
      } else {
        this.state = 'failed';
        this.errors.push(result.error || 'Unknown error');
        this.log(`Task failed: ${result.error}`);
        return {
          success: false,
          state: this.state,
          summary: result.error || 'Task execution failed',
          output: result.output,
          errors: this.errors,
          logs: this.logs
        };
      }
    } catch (error: any) {
      this.state = 'failed';
      this.errors.push(error.message);
      this.log(`Executor error: ${error.message}`);
      return {
        success: false,
        state: this.state,
        summary: error.message,
        output: '',
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
