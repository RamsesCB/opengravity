import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export interface MiniMaxResult {
  success: boolean;
  output: string;
  error?: string;
}

export type OpenCodeModel = 
  | 'minimax/MiniMax-M2.5'
  | 'minimax/MiniMax-M2.7'
  | 'kimi/k2.5'
  | 'glm/glm-5'
  | 'ollama/qwen3.5:9b'
  | 'ollama/codellama:7b'
  | 'ollama/phi3:medium';

export async function runWithModel(
  taskDescription: string,
  projectPath: string,
  model: OpenCodeModel,
  timeoutMs: number = 180000
): Promise<MiniMaxResult> {
  logger.info(`[OpenCode] Running with model: ${model}`);

  return new Promise((resolve) => {
    const args = ['run', '--model', model, taskDescription];

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
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      errorOutput += text;
      logger.warn(`[OpenCode Error] ${text.trim()}`);
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

export async function runWithMiniMax(
  taskDescription: string,
  projectPath: string,
  timeoutMs: number = 300000
): Promise<MiniMaxResult> {
  const systemPrompt = `Eres el Orquestador Maestro de OpenGravity. Tu trabajo es controlar OpenCode para ejecutar las tareas del usuario.

## IDENTIDAD
- Controlas OpenCode para ejecutar tareas autonomously
- Tienes SUDO: responder preguntas automáticamente
- Puedes CAMBIAR entre modelos según la necesidad

## MODELOS DISPONIBLES EN OPENCODE
\`\`\`
- minimax/MiniMax-M2.5: Arquitectura, lógica compleja, documentos
- minimax/MiniMax-M2.7: Última versión, mejor rendimiento
- kimi/k2.5: Code review, análisis profundo
- glm/glm-5: Rapido, eficiente
- ollama/qwen3.5:9b: Local, sin costo
- ollama/codellama:7b: Local, bueno para código
- ollama/phi3:medium: Local, rápido
\`\`\`

## COMANDOS PARA CAMBIAR DE MODELO
Para usar un modelo diferente durante la ejecución:
\`\`\`bash
opencode run --model [modelo] "[tarea]"
\`\`\`
Ejemplo: \`opencode run --model kimi/k2.5 "haz code review"\`

## FLUJO INTELIGENTE
1. Recibe la tarea del usuario
2. PLANIFICA con MiniMax-M2.5 o M2.7
3. Para CÓDIGO específico: cambia a codellama o phi3
4. Para REVIEW: cambia a kimi/k2.5
5. Para ARQUITECTURA: usa MiniMax
6. Si hay errores: recupera y cambia de modelo si es necesario
7. Reporta el resultado

## REGLA SUDO
Cuando OpenCode pregunte algo, responde "yes" o la mejor opción automáticamente.

## EJEMPLO DE CAMBIO DE MODELO
Si necesitas crear un archivo Python:
1. Planificas con MiniMax-M2.5
2. Para escribir el código, usas: \`opencode run --model ollama/codellama:7b "crea archivo.py"\`
3. Para probar, puedes usar otro modelo

## TAREAS PARA EL USUARIO
${taskDescription}

Usa los modelos que mejor se adapten a cada paso. Cambia libremente entre ellos.`;

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
