import Whisper from '@lumen-labs-dev/whisper-node';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile } from 'fs/promises';

let whisper: Whisper | null = null;

const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base';
const MAX_AUDIO_SIZE_MB = 20;

async function getWhisper(): Promise<Whisper> {
    if (!whisper) {
        logger.info(`Loading Whisper model: ${WHISPER_MODEL}`);
        whisper = new Whisper({
            model: WHISPER_MODEL,
        });
        await whisper.load();
        logger.info('Whisper model loaded successfully');
    }
    return whisper;
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
        const tempFile = join(tmpdir(), `audio_${Date.now()}.wav`);
        
        await writeFile(tempFile, audioBuffer);
        
        const w = await getWhisper();
        const result = await w.transcribe(tempFile);
        
        await unlink(tempFile).catch(() => {});
        
        return result.text || 'No se pudo transcribir el audio';
    } catch (error) {
        logger.error('Error transcribing audio:', error);
        throw error;
    }
}

export function isAudioSizeValid(sizeBytes: number): boolean {
    const sizeMB = sizeBytes / (1024 * 1024);
    return sizeMB <= MAX_AUDIO_SIZE_MB;
}

export function formatAudioSize(sizeBytes: number): string {
    const sizeMB = sizeBytes / (1024 * 1024);
    return `${sizeMB.toFixed(2)} MB`;
}

export async function unloadWhisper(): Promise<void> {
    if (whisper) {
        whisper = null;
        logger.info('Whisper model unloaded');
    }
}
