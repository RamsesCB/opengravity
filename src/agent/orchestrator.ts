import { logger } from '../utils/logger.js';
import { routeTask, RouterDecision } from './router.js';
import { Executor, ExecutionState, ExecutionResult, StateChangeCallback } from './executor.js';
import { getModelById, LOCAL_MODELS } from './local_models.js';
import { ACPServer, getACPServer, setACPServer, stopACPServer, Question } from './opencode_acp_server.js';
import { config } from '../config.js';

export interface OrchestratorOptions {
  userId: string;
  projectName?: string;
  onStateChange?: StateChangeCallback;
  onLog?: (message: string) => void;
  onQuestion?: (question: Question) => void;
  onProgress?: (step: number, total: number, message: string) => void;
  ctx?: any;
}

export interface OrchestratorResult {
  success: boolean;
  summary: string;
  state: ExecutionState;
  logs: string[];
  errors: string[];
  modelUsed: string;
  projectName: string;
  pendingQuestion?: Question;
}

export class Orchestrator {
  private userId: string;
  private projectName: string;
  private decision?: RouterDecision;
  private executor?: Executor;
  private stateCallback?: StateChangeCallback;
  private logCallback?: (message: string) => void;
  private questionCallback?: (question: Question) => void;
  private progressCallback?: (step: number, total: number, message: string) => void;
  private ctx?: any;
  private currentState: ExecutionState = 'initialized';
  private acpServer?: ACPServer;
  private pendingQuestion: Question | null = null;

  constructor(options: OrchestratorOptions) {
    this.userId = options.userId;
    this.projectName = options.projectName || `proyecto-${Date.now()}`;
    this.stateCallback = options.onStateChange;
    this.logCallback = options.onLog;
    this.questionCallback = options.onQuestion;
    this.progressCallback = options.onProgress;
    this.ctx = options.ctx;
  }

  private log(message: string) {
    logger.info(`[Orchestrator] ${message}`);
    this.logCallback?.(message);
  }

  private handleStateChange(state: ExecutionState, data?: any) {
    this.currentState = state;
    this.log(`State: ${state} ${data ? JSON.stringify(data) : ''}`);
    this.stateCallback?.(state, data);
  }

  async startACPServer(): Promise<void> {
    const existingServer = getACPServer();
    if (existingServer && existingServer.isRunning()) {
      this.acpServer = existingServer;
      this.log('Using existing ACP server');
      return;
    }

    if (!this.decision) {
      throw new Error('No model decision yet');
    }

    const model = getModelById(this.decision.modelId);
    if (!model) {
      throw new Error(`Unknown model: ${this.decision.modelId}`);
    }

    this.log(`Starting ACP server with OpenCode default model for task type: ${model.type}`);

    this.acpServer = new ACPServer(
      `${config.LOCAL_PROJECTS_PATH}/${this.projectName}`,
      undefined
    );

    await this.acpServer.start();
    setACPServer(this.acpServer);

    this.acpServer.on('progress', (data) => {
      this.progressCallback?.(data.step, data.totalSteps, data.message);
    });

    this.acpServer.on('question', (data) => {
      this.pendingQuestion = data.data;
      this.questionCallback?.(data.data);
    });
  }

  async stopACPServer(): Promise<void> {
    await stopACPServer();
    this.acpServer = undefined;
  }

  sendAnswer(answer: string): void {
    if (this.acpServer && this.pendingQuestion) {
      this.acpServer.sendAnswer(answer);
      this.pendingQuestion = null;
    }
  }

  hasPendingQuestion(): boolean {
    return this.pendingQuestion !== null;
  }

  getPendingQuestion(): Question | null {
    return this.pendingQuestion;
  }

  async execute(userMessage: string): Promise<OrchestratorResult> {
    this.log(`Starting orchestrator for message: ${userMessage.substring(0, 100)}...`);

    try {
      this.log('Phase A: Routing task...');
      this.decision = await routeTask(userMessage, []);
      
      if (!this.decision) {
        throw new Error('Router failed to provide a decision');
      }

      this.projectName = this.decision.projectName;
      this.log(`Router selected model: ${this.decision.modelId} (${this.decision.modelType})`);
      this.log(`Project: ${this.projectName}`);
      this.log(`Skills: ${this.decision.skills.join(', ')}`);

      const model = getModelById(this.decision.modelId);
      if (!model) {
        throw new Error(`Unknown model: ${this.decision.modelId}`);
      }

      this.log('Phase B: Initializing workspace...');
      this.executor = new Executor(
        this.projectName,
        this.decision.modelType,
        userMessage,
        this.handleStateChange.bind(this)
      );
      await this.executor.initialize();

      this.log('Phase C: Starting ACP server...');
      await this.startACPServer();

      if (!this.acpServer) {
        throw new Error('ACP server not initialized');
      }

      this.log('Phase D: Executing with executor...');
      const result = await this.executor.runWithACP(this.acpServer);

      return {
        success: result.success,
        summary: result.summary,
        state: result.state,
        logs: result.logs,
        errors: result.errors,
        modelUsed: this.decision.modelId,
        projectName: this.projectName,
        pendingQuestion: this.pendingQuestion || undefined
      };
    } catch (error: any) {
      logger.error('Orchestrator execution failed:', error);
      return {
        success: false,
        summary: error.message,
        state: this.currentState,
        logs: [],
        errors: [error.message],
        modelUsed: this.decision?.modelId || 'unknown',
        projectName: this.projectName
      };
    }
  }

  getState(): ExecutionState {
    return this.currentState;
  }

  getProjectName(): string {
    return this.projectName;
  }

  getCurrentModel(): string {
    return this.decision?.modelId || 'none';
  }
}

export async function executeWithOrchestrator(
  userMessage: string,
  options: OrchestratorOptions
): Promise<OrchestratorResult> {
  const orchestrator = new Orchestrator(options);
  return await orchestrator.execute(userMessage);
}

export async function stopACPServerAndCleanup(): Promise<void> {
  await stopACPServer();
  logger.info('ACP server stopped via orchestrator');
}
