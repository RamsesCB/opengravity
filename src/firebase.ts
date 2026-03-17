import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from './config.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Load service account (only needed in local testing if you don't run in Firebase emulators)
const initializeFirebase = async (): Promise<void> => {
    if (getApps().length === 0) {
        try {
            if (config.GOOGLE_APPLICATION_CREDENTIALS) {
                // Read from local service account if path is present or use default env
                initializeApp();
            } else {
                initializeApp(); // Assumes default environment (Cloud)
            }
        } catch (error) {
            console.error("Failed to initialize Firebase Admin", error);
        }
    }
};


initializeFirebase();
export const db = getFirestore();
