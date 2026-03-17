import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from './utils/logger.js';

const initializeFirebase = async (): Promise<void> => {
    if (getApps().length > 0) return;

    try {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        
        if (serviceAccountJson) {
            logger.info("Initializing Firebase with service account JSON from environment.");
            initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
        } else {
            initializeApp();
        }
    } catch (error) {
        console.error("Failed to initialize Firebase Admin", error);
    }
};

initializeFirebase();
export const db = getFirestore();
