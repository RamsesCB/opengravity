import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export interface OpenCodeResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
}

export interface OpenCodeOptions {
  continue?: boolean;
  timeout?: number;
  model?: string;
  baseContext?: string;
  workdir?: string;
}

export async function runOpenCode(
  taskDescription: string,
  projectPath: string,
  options?: OpenCodeOptions
): Promise<OpenCodeResult> {
  const timeout = options?.timeout || config.OPENCODE_TIMEOUT;
  const workdir = options?.workdir || projectPath;
  
  let fullTask = taskDescription;

  const args: string[] = ['run'];
  
  if (options?.continue) {
    args.push('--continue');
  }
  
  args.push(fullTask);

  logger.info(`[OpenCode] Running task in ${workdir}: ${taskDescription.substring(0, 100)}...`);

  const openCodeCmd = config.OPENCODE_COMMAND || 'opencode';

  return new Promise((resolve) => {
    const proc = spawn(openCodeCmd, args, {
      cwd: workdir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: '1',
        OPENCODE_DISABLE_AUTOUPDATE: 'true',
      }
    });

    let output = '';
    let errorOutput = '';
    let timeoutId: NodeJS.Timeout;

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      logger.info(`[OpenCode] ${text.trim()}`);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      errorOutput += text;
      logger.warn(`[OpenCode Error] ${text.trim()}`);
    });

    proc.on('close', (code: number | null) => {
      clearTimeout(timeoutId);
      logger.info(`[OpenCode] Process exited with code ${code}`);
      resolve({
        success: code === 0,
        output,
        error: errorOutput || undefined,
        exitCode: code || 0
      });
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timeoutId);
      logger.error('[OpenCode] Process error:', err);
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
        error: `Process timed out after ${timeout}ms`
      });
    }, timeout);
  });
}

export async function ensureProjectWorkspace(projectName: string): Promise<string> {
  const projectPath = path.join(config.LOCAL_PROJECTS_PATH, projectName);
  await fs.mkdir(projectPath, { recursive: true });
  return projectPath;
}

export async function checkOpenCodeAvailable(): Promise<boolean> {
  try {
    const result = await runOpenCode('test', '/tmp', { timeout: 10000 });
    return result.success;
  } catch {
    return false;
  }
}
