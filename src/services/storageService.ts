/**
 * StockFacture Pro - Offline Storage Service (IndexedDB with LocalStorage fallback)
 */

import { AppState } from '../types';

const DB_NAME = 'StockFactureProDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const DEFAULT_STATE_KEY = 'state_guest';
const DEFAULT_LOCAL_STORAGE_KEY = 'stockfacture_data_guest';

class StorageService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private currentUserId: string | null = null;

  constructor() {
    this.initIndexedDB();
  }

  /**
   * Set user scope for isolation between Google accounts
   */
  setUserScope(userId: string | null): void {
    this.currentUserId = userId || null;
  }

  getUserScope(): string | null {
    return this.currentUserId;
  }

  private getStateKey(): string {
    return this.currentUserId ? `state_${this.currentUserId}` : DEFAULT_STATE_KEY;
  }

  private getLocalStorageKey(): string {
    return this.currentUserId ? `stockfacture_data_${this.currentUserId}` : DEFAULT_LOCAL_STORAGE_KEY;
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
    const stateKey = this.getStateKey();
    const lsKey = this.getLocalStorageKey();
    try {
      const db = await this.initIndexedDB();
      if (db) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put(state, stateKey);
          request.onsuccess = () => resolve();
          request.onerror = (e) => reject(e);
        });
      }

      // Mirror to localStorage as immediate synchronous fallback
      try {
        localStorage.setItem(lsKey, JSON.stringify(state));
      } catch (e) {
        console.warn('LocalStorage mirror warning:', e);
      }

      return true;
    } catch (err) {
      console.error('Failed to save state in IndexedDB:', err);
      try {
        localStorage.setItem(lsKey, JSON.stringify(state));
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
    const stateKey = this.getStateKey();
    const lsKey = this.getLocalStorageKey();
    try {
      const db = await this.initIndexedDB();
      if (db) {
        const stateFromIDB = await new Promise<AppState | null>((resolve) => {
          try {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(stateKey);
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
      const lsData = localStorage.getItem(lsKey);
      if (lsData) {
        return JSON.parse(lsData);
      }

      return null;
    } catch (err) {
      console.error('Error loading state:', err);
      try {
        const lsData = localStorage.getItem(lsKey);
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
   * Clear local storage cache for a specific account or the current account.
   * Does NOT touch Firestore cloud data.
   */
  async clearAccountCache(targetUserId?: string | null): Promise<void> {
    const uid = targetUserId !== undefined ? targetUserId : this.currentUserId;
    const stateKey = uid ? `state_${uid}` : DEFAULT_STATE_KEY;
    const lsKey = uid ? `stockfacture_data_${uid}` : DEFAULT_LOCAL_STORAGE_KEY;

    try {
      const db = await this.initIndexedDB();
      if (db) {
        await new Promise<void>((resolve) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          store.delete(stateKey).onsuccess = () => resolve();
        });
      }
    } catch (e) {
      console.warn('IndexedDB clearAccountCache error', e);
    }
    try {
      localStorage.removeItem(lsKey);
    } catch {}
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
    try {
      localStorage.removeItem(DEFAULT_LOCAL_STORAGE_KEY);
      if (this.currentUserId) {
        localStorage.removeItem(this.getLocalStorageKey());
      }
    } catch {}
  }
}

export const storageService = new StorageService();
