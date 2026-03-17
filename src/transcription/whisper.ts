import Groq from 'groq-sdk';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile } from 'fs/promises';
import fs from 'fs';

const groq = new Groq({
    apiKey: config.GROQ_API_KEY,
});

const MAX_AUDIO_SIZE_MB = 20;

/**
 * Transcribes audio using Groq Whisper API. 
 * This is MUCH faster and uses 0 RAM compared to local whisper.
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
        logger.info('Starting transcription via Groq API...');
        
        // Save buffer to temporary file because Groq SDK needs a file stream
        const tempFile = join(tmpdir(), `audio_${Date.now()}.ogg`);
        await writeFile(tempFile, audioBuffer);
        
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(tempFile),
            model: 'whisper-large-v3',
            response_format: 'json',
            language: 'es', // Assume Spanish by default
        });
        
        // Clean up
        await unlink(tempFile).catch(() => {});
        
        return transcription.text || 'No se pudo transcribir el audio';
    } catch (error) {
        logger.error('Error transcribing audio via Groq:', error);
        return 'Error al transcribir el audio con la API de Groq.';
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

// Dummy for backward compatibility
export async function unloadWhisper(): Promise<void> {}
