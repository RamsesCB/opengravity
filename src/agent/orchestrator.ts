import { logger } from '../utils/logger.js';
import { Executor, ExecutionResult } from './executor.js';
import { config } from '../config.js';
import * as path from 'path';

export interface OrchestratorOptions {
  userId: string;
  projectName?: string;
  onProgress?: (message: string) => Promise<void>;
}

export interface OrchestratorResult {
  success: boolean;
  summary: string;
  state: string;
  output: string;
  planModel?: string;
  projectName: string;
  errors: string[];
}

export class Orchestrator {
  private userId: string;
  private projectName: string;
  private executor?: Executor;

  constructor(options: OrchestratorOptions) {
    this.userId = options.userId;
    this.projectName = options.projectName || `proyecto-${Date.now()}`;
  }

  private getProjectPath(): string {
    return path.join(config.LOCAL_PROJECTS_PATH, this.projectName);
  }

  async execute(taskDescription: string): Promise<OrchestratorResult> {
    logger.info(`[Orchestrator] Starting task: ${taskDescription.substring(0, 100)}...`);

    try {
      this.executor = new Executor(
        this.getProjectPath(),
        this.projectName,
        taskDescription,
        {
          onProgress: async (message) => logger.info(`[Orchestrator] ${message}`)
        }
      );

      const result: ExecutionResult = await this.executor.run();

      return {
        success: result.success,
        summary: result.summary,
        state: result.state,
        output: result.output,
        planModel: result.plan?.recommendedModel,
        projectName: this.projectName,
        errors: result.errors
      };
    } catch (error: any) {
      logger.error('[Orchestrator] Execution failed:', error);
      return {
        success: false,
        summary: error.message,
        state: 'failed',
        output: '',
        projectName: this.projectName,
        errors: [error.message]
      };
    }
  }

  getProjectName(): string {
    return this.projectName;
  }
}

export async function executeWithOrchestrator(
  taskDescription: string,
  options: OrchestratorOptions
): Promise<OrchestratorResult> {
  const orchestrator = new Orchestrator(options);
  return await orchestrator.execute(taskDescription);
}
