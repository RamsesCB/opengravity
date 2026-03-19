import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export interface MiniMaxResult {
  success: boolean;
  output: string;
  error?: string;
}

export async function runWithMiniMax(
  taskDescription: string,
  projectPath: string,
  timeoutMs: number = 300000
): Promise<MiniMaxResult> {
  const systemPrompt = `Eres el Orquestador Maestro de OpenGravity. Tu trabajo es controlar OpenCode para ejecutar las tareas del usuario.

## IDENTIDAD
- Controlas OpenCode para ejecutar tareas autonomously
- Tienes SUDO: responder preguntas automáticamente

## ARCHIVOS DE ESTRUCTURA
- Plan: /home/slerx/Datos/Proyectos/Plan_structure.md
- Error: /home/slerx/Datos/Proyectos/Error_structure.md

## FLUJO
1. Recibe la tarea del usuario
2. Crea el plan usando Plan_structure.md  
3. Usa OpenCode para ejecutar: cd [PROYECTO] && opencode run "[TAREA]"
4. Si hay errores, recupera usando Error_structure.md
5. Reporta el resultado

## REGLA SUDO
Cuando OpenCode pregunte algo, responde "yes" automáticamente.

TAREA DEL USUARIO: ${taskDescription}

Responde con:
1. El plan que crearás
2. Los comandos que ejecutarás
3. El resultado final

Usa OpenCode para ejecutar.`;

  logger.info(`[MiniMax] Sending task to OpenCode with MiniMax model`);

  return new Promise((resolve) => {
    const args = [
      'run',
      '--model', 'minimax/MiniMax-M2.5',
      systemPrompt
    ];

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
      logger.info(`[MiniMax] ${text.trim()}`);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      errorOutput += text;
      logger.warn(`[MiniMax Error] ${text.trim()}`);
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      logger.info(`[MiniMax] Process exited with code ${code}`);
      resolve({
        success: code === 0,
        output,
        error: errorOutput || undefined
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      logger.error(`[MiniMax] Process error:`, err);
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

export async function runOpenCodeTask(
  prompt: string,
  projectPath: string,
  timeoutMs: number = 180000
): Promise<MiniMaxResult> {
  logger.info(`[OpenCode] Running: ${prompt.substring(0, 100)}...`);

  return new Promise((resolve) => {
    const proc = spawn('opencode', ['run', prompt], {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: '1'
      }
    });

    let output = '';
    let errorOutput = '';
    let timeoutId: NodeJS.Timeout;

    proc.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        success: code === 0,
        output,
        error: errorOutput || undefined
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
