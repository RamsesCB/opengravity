import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export interface OpenCodeResult {
  exitCode: number;
  output: string;
  error?: string;
}

export interface OpenCodeOptions {
  continue?: boolean;
  timeout?: number;
  model?: string;
  baseContext?: string;
}

export async function runOpenCode(
  taskDescription: string,
  projectPath: string,
  options?: OpenCodeOptions
): Promise<OpenCodeResult> {
  const timeout = options?.timeout || config.OPENCODE_TIMEOUT;
  const continueFlag = options?.continue ? ['--continue'] : [];
  const modelFlag = options?.model ? ['-m', options.model] : [];
  const baseContext = options?.baseContext || '';

  let fullTask = '';
  if (baseContext) {
    fullTask = `${baseContext}\n\n---\n\nTAREA:\n${taskDescription}`;
  } else {
    fullTask = taskDescription;
  }

  logger.info(`Running opencode in ${projectPath} with model ${options?.model}: ${taskDescription.substring(0, 100)}...`);

  const args = [
    'run',
    ...modelFlag,
    fullTask,
    ...continueFlag
  ];

  const openCodeCmd = config.OPENCODE_COMMAND || 'opencode';

  return new Promise((resolve) => {
    const proc = spawn(openCodeCmd, args, {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      env: { ...process.env }
    });

    let output = '';
    let errorOutput = '';
    let timeoutId: NodeJS.Timeout;

    proc.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code: number | null) => {
      clearTimeout(timeoutId);
      logger.info(`OpenCode exited with code ${code}`);
      resolve({
        exitCode: code || 0,
        output,
        error: errorOutput || undefined
      });
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timeoutId);
      logger.error('OpenCode process error:', err);
      resolve({
        exitCode: 1,
        output: '',
        error: err.message
      });
    });

    timeoutId = setTimeout(() => {
      proc.kill();
      resolve({
        exitCode: 124,
        output,
        error: 'Process timed out'
      });
    }, timeout);
  });
}

export async function ensureProjectWorkspace(projectName: string): Promise<string> {
  const projectPath = path.join(config.LOCAL_PROJECTS_PATH, projectName);
  await fs.mkdir(projectPath, { recursive: true });
  return projectPath;
}

export async function runAntigravity(projectPath: string): Promise<OpenCodeResult> {
  return runOpenCode('Initialize antigravity environment', projectPath);
}

export async function checkOpenCodeAvailable(): Promise<boolean> {
  try {
    const result = await runOpenCode('version check', '/tmp', { timeout: 5000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
