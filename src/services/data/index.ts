/**
 * StockFacture Pro - Data Layer Entrypoint
 * 
 * Cleanly separates the User Interface & Application Store from the physical persistence engine.
 * Connects Local Storage (IndexedDB/localStorage) and Firestore synchronization.
 */

import { IDataRepository } from './types';
import { LocalDataRepository } from './LocalDataRepository';

export * from './types';
export * from './firebaseSchema';
export * from './LocalDataRepository';
export * from './FirestoreSyncService';

// Singleton instance used across the app
export const dataRepository: IDataRepository = new LocalDataRepository();
