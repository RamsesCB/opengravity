import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from './config.js';
import { logger } from './utils/logger.js';

import { readFile } from 'fs/promises';
import { join } from 'path';

// Load service account (only needed in local testing if you don't run in Firebase emulators)
const initializeFirebase = async (): Promise<void> => {
    if (getApps().length === 0) {
        try {
            const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
            
            if (serviceAccountJson) {
                // For Render/Cloud where we paste the JSON content directly as an Env Var
                logger.info("Initializing Firebase with service account JSON from environment.");
                initializeApp({
                    credential: cert(JSON.parse(serviceAccountJson))
                });
            } else if (config.GOOGLE_APPLICATION_CREDENTIALS) {
                // For local or Firebase where we have a physical file path
                initializeApp();
            } else {
                // Fallback for default environments
                initializeApp();
            }
        } catch (error) {
            console.error("Failed to initialize Firebase Admin", error);
        }
    }
};



initializeFirebase();
export const db = getFirestore();
