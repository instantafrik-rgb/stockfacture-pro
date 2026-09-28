/**
 * StockFacture Pro - Offline Storage Service (IndexedDB with LocalStorage fallback)
 */

import { AppState } from '../types';

const DB_NAME = 'StockFactureProDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const STATE_KEY = 'current_state';
const LOCAL_STORAGE_KEY = 'stockfacture_pro_data';

class StorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    this.initIndexedDB();
  }

  private initIndexedDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      this.dbPromise = Promise.resolve(null);
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          console.warn('IndexedDB unavailable, falling back to LocalStorage');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB init error:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Save the full application state
   */
  async saveState(state: AppState): Promise<boolean> {
    try {
      const db = await this.initIndexedDB();
      if (db) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(state, STATE_KEY);
          request.onsuccess = () => resolve();
          request.onerror = (e) => reject(e);
        });
      }

      // Mirror to localStorage as immediate synchronous fallback
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn('LocalStorage mirror warning:', e);
      }

      return true;
    } catch (err) {
      console.error('Failed to save state in IndexedDB:', err);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (lsErr) {
        console.error('LocalStorage save error:', lsErr);
        return false;
      }
    }
  }

  /**
   * Load the state from storage
   */
  async loadState(): Promise<AppState | null> {
    try {
      const db = await this.initIndexedDB();
      if (db) {
        const stateFromIDB = await new Promise<AppState | null>((resolve) => {
          try {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(STATE_KEY);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });

        if (stateFromIDB) {
          return stateFromIDB;
        }
      }

      // Check localStorage
      const lsData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (lsData) {
        return JSON.parse(lsData);
      }
      return null;
    } catch (err) {
      console.error('Error loading state:', err);
      try {
        const lsData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (lsData) return JSON.parse(lsData);
      } catch {}
      return null;
    }
  }

  /**
   * Export database as formatted JSON file
   */
  exportData(state: AppState): void {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const d = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stockfacture_backup_${d}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all local storage data
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.initIndexedDB();
      if (db) {
        await new Promise<void>((resolve) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          store.clear().onsuccess = () => resolve();
        });
      }
    } catch (e) {
      console.warn('IndexedDB clear error', e);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}

export const storageService = new StorageService();
