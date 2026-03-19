import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import net from 'node:net';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export interface Question {
  text: string;
  options?: string[];
  timestamp: number;
}

export interface ACPProgress {
  step: number;
  totalSteps: number;
  message: string;
}

export interface ACPResult {
  success: boolean;
  output: string;
  error?: string;
}

export type ACPServerEvent = 
  | { type: 'ready'; port: number }
  | { type: 'progress'; data: ACPProgress }
  | { type: 'question'; data: Question }
  | { type: 'answer_sent'; success: boolean }
  | { type: 'complete'; result: ACPResult }
  | { type: 'error'; message: string }
  | { type: 'output'; data: string };

export class ACPServer extends EventEmitter {
  private process: ChildProcess | null = null;
  private activeTaskProcess: ChildProcess | null = null;
  private port: number = 4096;
  private projectPath: string;
  private model: string;
  private running: boolean = false;
  private answerQueue: string[] = [];
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly TIMEOUT_MS: number = 30 * 60 * 1000;
  private readonly MAX_TASK_CHARS: number = 600;

  constructor(projectPath: string, model: string, port: number = 4096) {
    super();
    this.projectPath = projectPath;
    this.model = model;
    this.port = port;
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('ACP Server already running');
      return;
    }

    logger.info(`Starting ACP server on port ${this.port} for ${this.projectPath}`);

    return new Promise((resolve, reject) => {
      const openCodeCommand = config.OPENCODE_COMMAND || 'opencode';
      this.process = spawn(openCodeCommand, ['acp', '--port', String(this.port)], {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: { ...process.env }
      });

      let startupOutput = '';
      let startupErrorOutput = '';
      let startTimeout: NodeJS.Timeout;
      let readinessPoll: NodeJS.Timeout;
      let settled = false;

      const clearStartupTimers = () => {
        clearTimeout(startTimeout);
        clearInterval(readinessPoll);
      };

      const markReady = () => {
        if (settled) return;
        settled = true;
        this.running = true;
        this.emit('ready', { port: this.port });
        this.resetTimeout();
        clearStartupTimers();
        resolve();
      };

      const failStart = (message: string) => {
        if (settled) return;
        settled = true;
        clearStartupTimers();
        this.running = false;
        this.process?.kill();
        reject(new Error(message));
      };

      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        startupOutput += text;
        logger.info(`[ACP] ${text.trim()}`);
        this.emit('output', { data: text });

        if (text.includes('listening') || text.includes('started') || text.includes('ready')) {
          markReady();
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        startupErrorOutput += text;
        logger.info(`[ACP STDERR] ${text.trim()}`);
        this.emit('output', { data: text });
        
        if (text.includes('listening') || text.includes('started') || text.includes('ready')) {
          markReady();
        }
      });

      this.process.on('close', (code) => {
        logger.info(`ACP server exited with code ${code}`);

        if (!settled) {
          const combined = `${startupOutput}\n${startupErrorOutput}`.trim();
          failStart(
            `ACP server exited before ready (code ${code ?? 'null'}). Output: "${combined}"`
          );
          return;
        }

        this.running = false;
        this.emit('complete', { success: code === 0, output: startupOutput, error: code ? `Exit code: ${code}` : undefined });
      });

      this.process.on('error', (err) => {
        logger.error('ACP server error:', err);
        failStart(`ACP server error: ${err.message}`);
      });

      readinessPoll = setInterval(async () => {
        if (settled || !this.process) {
          return;
        }

        const isReady = await this.isPortOpen();
        if (isReady) {
          logger.info(`ACP server detected as ready via port check (${this.port})`);
          markReady();
        }
      }, 500);

      startTimeout = setTimeout(() => {
        if (!settled) {
          const combined = `${startupOutput}\n${startupErrorOutput}`;
          if (
            combined.toLowerCase().includes('listening') ||
            combined.toLowerCase().includes('started') ||
            combined.toLowerCase().includes('ready') ||
            combined.length > 10
          ) {
            logger.warn('ACP server started but maybe missed the exact keyword, force-readying...');
            markReady();
          } else {
            const errMessage = `ACP server failed to start (timeout). Output: "${combined.trim()}"`;
            logger.error(errMessage);
            failStart(errMessage);
          }
        }
      }, 20000);
    });
  }

  private async isPortOpen(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();

      const finish = (open: boolean) => {
        socket.destroy();
        resolve(open);
      };

      socket.setTimeout(400);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));

      socket.connect(this.port, '127.0.0.1');
    });
  }

  async runTask(task: string): Promise<ACPResult> {
    return new Promise((resolve) => {
      this.resetTimeout();
      const compactTask = this.compactTask(task);
      
      const openCodeCommand = config.OPENCODE_COMMAND || 'opencode';
      const args = ['run', '-m', this.model, compactTask];
      logger.info(`[ACP] Running task (${compactTask.length} chars): ${compactTask.substring(0, 100)}...`);

      const proc = spawn(openCodeCommand, args, {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: { ...process.env }
      });
      this.activeTaskProcess = proc;
      const taskTimeoutMs = config.OPENCODE_TIMEOUT || 300000;

      let output = '';
      let errorOutput = '';
      let exitCode: number | null = null;
      let timedOut = false;
      let settled = false;
      let taskTimeoutId: NodeJS.Timeout;

      const complete = (result: ACPResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(taskTimeoutId);
        this.activeTaskProcess = null;
        this.emit('complete', { result });
        resolve(result);
      };

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        logger.info(`[ACP Task] ${text.trim()}`);
        
        this.parseOutput(text);
        this.emit('output', { data: text });

        if (text.includes('?')) {
          this.emit('question', {
            text,
            options: this.extractOptions(text),
            timestamp: Date.now()
          });
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        errorOutput += text;
        logger.info(`[ACP Task STDERR] ${text.trim()}`);
        this.emit('output', { data: text });
        
        if (text.includes('?')) {
          this.emit('question', { 
            text: text, 
            options: this.extractOptions(text),
            timestamp: Date.now()
          });
        }
      });

      proc.on('close', (code) => {
        exitCode = code;
        this.resetTimeout();

        if (timedOut) {
          complete({
            success: false,
            output: `${output}${errorOutput ? `\n${errorOutput}` : ''}`,
            error: `Task timed out after ${taskTimeoutMs}ms`
          });
          return;
        }

        const combinedOutput = `${output}${errorOutput ? `\n${errorOutput}` : ''}`;
        const hasErrorText = /\berror\b/i.test(errorOutput) || /\binvalid api key\b/i.test(combinedOutput);

        if (code === 0 && !hasErrorText) {
          this.applySuggestedFileWrite(combinedOutput)
            .then((applied) => {
              if (applied) {
                logger.info('[ACP] Applied model-suggested file write command successfully');
              }
            })
            .catch((err) => {
              logger.warn('[ACP] Failed applying model-suggested command:', err.message);
            });
        }

        complete({
          success: code === 0 && !hasErrorText,
          output: combinedOutput,
          error: code ? `Exit code: ${code}` : hasErrorText ? 'OpenCode reported an error in output' : undefined
        });
      });

      proc.on('error', (err) => {
        complete({ success: false, output: `${output}${errorOutput ? `\n${errorOutput}` : ''}`, error: err.message });
      });

      taskTimeoutId = setTimeout(() => {
        if (!settled) {
          timedOut = true;
          logger.error(`[ACP] Task timed out after ${taskTimeoutMs}ms`);
          proc.kill();
        }
      }, taskTimeoutMs);
    });
  }

  private compactTask(task: string): string {
    const cleaned = task
      .replace(/FIRST ACTION REQUIRED:[\s\S]*/gi, '')
      .replace(/##\s*Memory from Previous Sessions[\s\S]*/gi, '')
      .replace(/The previous request exceeded[\s\S]*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length <= this.MAX_TASK_CHARS) {
      return cleaned;
    }

    return cleaned.substring(0, this.MAX_TASK_CHARS).trim();
  }

  private async applySuggestedFileWrite(output: string): Promise<boolean> {
    const lines = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('>') && !line.startsWith('```'));

    const candidates = [...lines].reverse();

    for (const candidate of candidates) {
      const match = candidate.match(/^echo\s+([\s\S]+)\s+>\s+([\w./-]+)$/);
      if (!match) continue;

      const rawText = match[1].trim();
      const targetRel = match[2].trim();

      if (targetRel.includes('..')) continue;

      const content = this.unquote(rawText);
      const targetPath = path.resolve(this.projectPath, targetRel);

      if (!targetPath.startsWith(path.resolve(this.projectPath))) {
        continue;
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content + '\n', 'utf-8');
      return true;
    }

    return false;
  }

  private unquote(value: string): string {
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }

  private parseOutput(text: string): void {
    const stepMatch = text.match(/step\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
    if (stepMatch) {
      this.emit('progress', {
        step: parseInt(stepMatch[1]),
        totalSteps: parseInt(stepMatch[2]),
        message: text
      });
    }
  }

  private extractOptions(text: string): string[] {
    const options: string[] = [];
    const optionMatches = text.match(/\[?[0-9]+\]?\s*[.:)]\s*(.+)/g);
    if (optionMatches) {
      optionMatches.forEach(match => {
        const cleaned = match.replace(/^\[?[0-9]+\]?\s*[.:)]\s*/, '').trim();
        if (cleaned) options.push(cleaned);
      });
    }
    return options;
  }

  sendAnswer(answer: string): void {
    this.resetTimeout();
    logger.info(`[ACP] Sending answer: ${answer}`);
    
    const target = this.activeTaskProcess?.stdin ?? this.process?.stdin;
    if (target && !target.destroyed && target.writable) {
      target.write(answer + '\n');
      this.emit('answer_sent', { success: true });
      return;
    }

    this.emit('answer_sent', { success: false });
  }

  private resetTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => {
      logger.info('ACP server timeout reached, stopping...');
      this.stop();
    }, this.TIMEOUT_MS);
  }

  stop(): void {
    logger.info('Stopping ACP server...');
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    if (this.activeTaskProcess) {
      this.activeTaskProcess.kill();
      this.activeTaskProcess = null;
    }
    
    this.running = false;
    logger.info('ACP server stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.port;
  }
}

let globalACPServer: ACPServer | null = null;

export function getACPServer(): ACPServer | null {
  return globalACPServer;
}

export function setACPServer(server: ACPServer | null): void {
  if (globalACPServer && globalACPServer.isRunning()) {
    globalACPServer.stop();
  }
  globalACPServer = server;
}

export async function stopACPServer(): Promise<void> {
  if (globalACPServer) {
    globalACPServer.stop();
    globalACPServer = null;
    logger.info('Global ACP server stopped');
  }
}
