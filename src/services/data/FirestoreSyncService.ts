/**
 * StockFacture Pro - Firestore Real-Time & Offline Sync Service
 * 
 * Synchronizes user data across multiple devices (PC, Phone, Tablet) in real time:
 * - Products (Produits)
 * - Stock Movements (Mouvements de stock)
 * - Clients
 * - Invoices (Factures)
 * - Quotes (Devis)
 * - Payments (Paiements)
 * - Settings (Paramètres)
 * - Categories
 * 
 * Architecture:
 * - Bidirectional real-time synchronization via Firestore onSnapshot
 * - Firestore is the single source of truth for authenticated users
 * - Local storage (IndexedDB/localStorage) acts as an offline cache
 * - Atomic batch commits for multi-entity actions (e.g. Sales)
 * - Automatic recursive sanitization: strips undefined values to prevent FirebaseError
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  AppState,
  Product,
  StockMovement,
  Client,
  Invoice,
  Quote,
  PaymentRecord,
  CompanySettings,
  Category,
} from '../../types';
import { SyncStatus } from './types';

/**
 * Central utility to recursively sanitize objects before writing to Firestore.
 * Removes all properties whose value is strictly `undefined`, preventing:
 * "FirebaseError: Unsupported field value: undefined"
 * 
 * Preserves:
 * - null, false, 0, "" (empty strings)
 * - valid arrays and nested objects
 * - Date and Firestore Timestamp instances
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Primitive types
  if (typeof data !== 'object') {
    return data;
  }

  // Date objects or Firestore Timestamps
  if (data instanceof Date || (typeof (data as any)?.toDate === 'function')) {
    return data;
  }

  // Arrays: sanitize each element and filter out undefined
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }

  // Plain objects: omit undefined properties
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

export class FirestoreSyncService {
  private activeSubscriptions: Unsubscribe[] = [];
  private currentUserId: string | null = null;
  private onRemoteUpdateCallback: ((updater: (prevState: AppState) => AppState) => void) | null = null;
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();

  // Fine-grained error and health tracking per collection
  private collectionErrors: Map<string, { code?: string; message: string; timestamp: string }> = new Map();
  private healthyCollections: Set<string> = new Set();

  private status: SyncStatus = {
    state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle',
    pendingChangesCount: 0,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSyncedAt: undefined,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleConnectivity(true));
      window.addEventListener('offline', () => this.handleConnectivity(false));
    }
  }

  private handleConnectivity(isOnline: boolean) {
    this.status = {
      ...this.status,
      isOnline,
      state: !isOnline ? 'offline' : (this.currentUserId ? 'idle' : 'offline'),
    };
    this.notifyStatus();
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public subscribeStatus(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus() {
    this.statusListeners.forEach((l) => l(this.status));
  }

  /**
   * Register callback to update React AppContext state when remote changes arrive from cloud
   */
  public registerRemoteUpdateListener(callback: (updater: (prevState: AppState) => AppState) => void) {
    this.onRemoteUpdateCallback = callback;
  }

  /**
   * Start real-time sync for an authenticated user
   */
  public startSync(userId: string) {
    if (this.currentUserId === userId && this.activeSubscriptions.length > 0) {
      return;
    }

    this.stopSync();
    this.currentUserId = userId;
    this.collectionErrors.clear();
    this.healthyCollections.clear();

    this.status = {
      ...this.status,
      state: 'syncing',
    };
    this.notifyStatus();

    try {
      this.subscribeToCollections(userId);
    } catch (e: any) {
      console.warn('[FirestoreSync] Error starting sync listeners:', e);
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: e?.message || 'Erreur lors du démarrage de la synchronisation',
      };
      this.notifyStatus();
    }
  }

  /**
   * Stop all active real-time listeners (e.g. on logout)
   */
  public stopSync() {
    this.activeSubscriptions.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    this.activeSubscriptions = [];
    this.currentUserId = null;
    this.collectionErrors.clear();
    this.healthyCollections.clear();

    this.status = {
      ...this.status,
      state: 'idle',
      errorMessage: undefined,
    };
    this.notifyStatus();
  }

  /**
   * Check if remote Firestore has existing data for the user
   */
  public async hasCloudData(userId: string): Promise<boolean> {
    try {
      const settingsRef = doc(db, 'users', userId, 'settings', 'company');
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) return true;

      const productsRef = collection(db, 'users', userId, 'products');
      const productsSnap = await getDocs(productsRef);
      if (!productsSnap.empty) return true;

      const invoicesRef = collection(db, 'users', userId, 'invoices');
      const invoicesSnap = await getDocs(invoicesRef);
      if (!invoicesSnap.empty) return true;

      return false;
    } catch (err) {
      console.warn('[FirestoreSync] Error checking cloud data:', err);
      return false;
    }
  }

  /**
   * Migrate full local state to Firestore on first login
   * All objects are systematically sanitized to eliminate any `undefined` values.
   */
  public async migrateLocalToCloud(userId: string, localState: AppState): Promise<boolean> {
    try {
      this.status = { ...this.status, state: 'syncing' };
      this.notifyStatus();

      // 1. Settings
      if (localState.settings) {
        const sanitizedSettings = sanitizeForFirestore({
          ...localState.settings,
          updatedAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'users', userId, 'settings', 'company'), sanitizedSettings);
      }

      // 2. Batched upload
      let batch = writeBatch(db);
      let count = 0;

      const commitAndResetBatchIfNeeded = async () => {
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      };

      // Products
      for (const p of localState.products) {
        const ref = doc(db, 'users', userId, 'products', p.id);
        const sanitizedProduct = sanitizeForFirestore({
          ...p,
          updatedAt: p.updatedAt || new Date().toISOString(),
          createdAt: p.createdAt || new Date().toISOString(),
        });
        batch.set(ref, sanitizedProduct);
        count++;
        await commitAndResetBatchIfNeeded();
      }

      // Clients
      for (const c of localState.clients) {
        const ref = doc(db, 'users', userId, 'clients', c.id);
        const sanitizedClient = sanitizeForFirestore({
          ...c,
          updatedAt: c.updatedAt || new Date().toISOString(),
          createdAt: c.createdAt || new Date().toISOString(),
        });
        batch.set(ref, sanitizedClient);
        count++;
        await commitAndResetBatchIfNeeded();
      }

      // Invoices
      for (const inv of localState.invoices) {
        const ref = doc(db, 'users', userId, 'invoices', inv.id);
        const sanitizedInvoice = sanitizeForFirestore({
          ...inv,
          updatedAt: inv.updatedAt || new Date().toISOString(),
          createdAt: inv.createdAt || new Date().toISOString(),
        });
        batch.set(ref, sanitizedInvoice);
        count++;
        await commitAndResetBatchIfNeeded();
      }

      // Quotes
      for (const q of localState.quotes) {
        const ref = doc(db, 'users', userId, 'quotes', q.id);
        const sanitizedQuote = sanitizeForFirestore({
          ...q,
          updatedAt: q.updatedAt || new Date().toISOString(),
          createdAt: q.createdAt || new Date().toISOString(),
        });
        batch.set(ref, sanitizedQuote);
        count++;
        await commitAndResetBatchIfNeeded();
      }

      // Payments
      for (const pay of localState.payments) {
        const ref = doc(db, 'users', userId, 'payments', pay.id);
        const sanitizedPayment = sanitizeForFirestore({
          ...pay,
          createdAt: pay.createdAt || new Date().toISOString(),
        });
        batch.set(ref, sanitizedPayment);
        count++;
        await commitAndResetBatchIfNeeded();
      }

      // Stock Movements
      for (const m of localState.movements) {
        const ref = doc(db, 'users', userId, 'movements', m.id);
        const sanitizedMovement = sanitizeForFirestore({
          ...m,
          createdAt: m.createdAt || new Date().toISOString(),
        });
        batch.set(ref, sanitizedMovement);
        count++;
        await commitAndResetBatchIfNeeded();
      }

      // Categories
      for (const cat of localState.categories) {
        const ref = doc(db, 'users', userId, 'categories', cat.id);
        batch.set(ref, sanitizeForFirestore(cat));
        count++;
        await commitAndResetBatchIfNeeded();
      }

      if (count > 0) {
        await batch.commit();
      }

      this.status = {
        ...this.status,
        state: 'idle',
        lastSyncedAt: new Date().toISOString(),
        errorMessage: undefined,
      };
      this.notifyStatus();
      return true;
    } catch (err: any) {
      console.error('[FirestoreSync] Migration to cloud error:', err);
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: err?.message || 'Erreur lors de la migration cloud',
      };
      this.notifyStatus();
      return false;
    }
  }

  // --- Real-Time Listeners for Bidirectional Synchronisation ---
  private subscribeToCollections(userId: string) {
    // 1. Settings listener
    const settingsRef = doc(db, 'users', userId, 'settings', 'company');
    const unsubSettings = onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists() && this.onRemoteUpdateCallback) {
          const cloudSettings = snap.data() as CompanySettings;
          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            settings: { ...prev.settings, ...cloudSettings },
          }));
        }
        this.markCollectionHealthy('settings');
      },
      (err) => this.handleSnapshotError('settings', err)
    );
    this.activeSubscriptions.push(unsubSettings);

    // 2. Products listener
    const productsRef = collection(db, 'users', userId, 'products');
    const unsubProducts = onSnapshot(
      productsRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remoteProducts: Product[] = [];
          snap.forEach((d) => {
            const data = d.data() as Product & { _deleted?: boolean };
            if (!data._deleted) {
              remoteProducts.push({ ...data, id: d.id });
            }
          });

          // Sort by creation date descending
          remoteProducts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            products: remoteProducts,
          }));
        }
        this.markCollectionHealthy('products');
      },
      (err) => this.handleSnapshotError('products', err)
    );
    this.activeSubscriptions.push(unsubProducts);

    // 3. Invoices listener
    const invoicesRef = collection(db, 'users', userId, 'invoices');
    const unsubInvoices = onSnapshot(
      invoicesRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remoteInvoices: Invoice[] = [];
          snap.forEach((d) => {
            const data = d.data() as Invoice & { _deleted?: boolean };
            if (!data._deleted) {
              remoteInvoices.push({ ...data, id: d.id });
            }
          });

          remoteInvoices.sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            invoices: remoteInvoices,
          }));
        }
        this.markCollectionHealthy('invoices');
      },
      (err) => this.handleSnapshotError('invoices', err)
    );
    this.activeSubscriptions.push(unsubInvoices);

    // 4. Clients listener
    const clientsRef = collection(db, 'users', userId, 'clients');
    const unsubClients = onSnapshot(
      clientsRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remoteClients: Client[] = [];
          snap.forEach((d) => {
            const data = d.data() as Client & { _deleted?: boolean };
            if (!data._deleted) {
              remoteClients.push({ ...data, id: d.id });
            }
          });

          remoteClients.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            clients: remoteClients,
          }));
        }
        this.markCollectionHealthy('clients');
      },
      (err) => this.handleSnapshotError('clients', err)
    );
    this.activeSubscriptions.push(unsubClients);

    // 5. Quotes listener
    const quotesRef = collection(db, 'users', userId, 'quotes');
    const unsubQuotes = onSnapshot(
      quotesRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remoteQuotes: Quote[] = [];
          snap.forEach((d) => {
            const data = d.data() as Quote & { _deleted?: boolean };
            if (!data._deleted) {
              remoteQuotes.push({ ...data, id: d.id });
            }
          });

          remoteQuotes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            quotes: remoteQuotes,
          }));
        }
        this.markCollectionHealthy('quotes');
      },
      (err) => this.handleSnapshotError('quotes', err)
    );
    this.activeSubscriptions.push(unsubQuotes);

    // 6. Payments listener
    const paymentsRef = collection(db, 'users', userId, 'payments');
    const unsubPayments = onSnapshot(
      paymentsRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remotePayments: PaymentRecord[] = [];
          snap.forEach((d) => {
            remotePayments.push({ ...(d.data() as PaymentRecord), id: d.id });
          });

          remotePayments.sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            payments: remotePayments,
          }));
        }
        this.markCollectionHealthy('payments');
      },
      (err) => this.handleSnapshotError('payments', err)
    );
    this.activeSubscriptions.push(unsubPayments);

    // 7. Stock Movements listener
    const movementsRef = collection(db, 'users', userId, 'movements');
    const unsubMovements = onSnapshot(
      movementsRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remoteMovements: StockMovement[] = [];
          snap.forEach((d) => {
            remoteMovements.push({ ...(d.data() as StockMovement), id: d.id });
          });

          remoteMovements.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            movements: remoteMovements,
          }));
        }
        this.markCollectionHealthy('movements');
      },
      (err) => this.handleSnapshotError('movements', err)
    );
    this.activeSubscriptions.push(unsubMovements);

    // 8. Categories listener
    const categoriesRef = collection(db, 'users', userId, 'categories');
    const unsubCategories = onSnapshot(
      categoriesRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remoteCategories: Category[] = [];
          snap.forEach((d) => {
            remoteCategories.push({ ...(d.data() as Category), id: d.id });
          });

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            categories: remoteCategories,
          }));
        }
        this.markCollectionHealthy('categories');
      },
      (err) => this.handleSnapshotError('categories', err)
    );
    this.activeSubscriptions.push(unsubCategories);
  }

  private markCollectionHealthy(collectionName: string) {
    this.collectionErrors.delete(collectionName);
    this.healthyCollections.add(collectionName);

    if (this.collectionErrors.size === 0) {
      this.status = {
        ...this.status,
        state: 'idle',
        lastSyncedAt: new Date().toISOString(),
        errorMessage: undefined,
      };
    } else {
      this.status = {
        ...this.status,
        state: 'idle',
        lastSyncedAt: new Date().toISOString(),
      };
    }
    this.notifyStatus();
  }

  private handleSnapshotError(collectionName: string, err: any) {
    const code = err?.code || 'unknown';
    const message = err?.message || 'Erreur inconnue';

    console.warn(`[FirestoreSync] Snapshot error on collection "${collectionName}":`, {
      collection: collectionName,
      code,
      message,
      operation: 'onSnapshot',
    });

    this.collectionErrors.set(collectionName, {
      code,
      message,
      timestamp: new Date().toISOString(),
    });
    this.healthyCollections.delete(collectionName);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      this.status = {
        ...this.status,
        state: 'offline',
        errorMessage: 'Mode hors connexion',
      };
    } else if (code === 'permission-denied') {
      // Permission denied is critical (rules reject user access)
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: `Permissions insuffisantes sur ${collectionName}`,
      };
    } else if (this.healthyCollections.size === 0) {
      // All listeners have failed
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: `Erreur synchronisation ${collectionName}: ${message}`,
      };
    } else {
      // Some listeners are still healthy, keep sync operational
      this.status = {
        ...this.status,
        state: 'idle',
        errorMessage: undefined,
      };
    }

    this.notifyStatus();
  }

  /**
   * Atomic synchronization of all changes made in AppContext to Firestore.
   * Every object is systematically sanitized to remove undefined values.
   */
  public async syncStateChanges(prev: AppState, next: AppState): Promise<void> {
    const user = auth.currentUser;
    if (!user) return; // Unauthenticated local mode

    try {
      this.status = { ...this.status, state: 'syncing' };
      this.notifyStatus();

      let batch = writeBatch(db);
      let opCount = 0;

      const commitAndResetIfNeeded = async () => {
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      };

      // 1. Settings
      if (JSON.stringify(prev.settings) !== JSON.stringify(next.settings)) {
        const ref = doc(db, 'users', user.uid, 'settings', 'company');
        const sanitizedSettings = sanitizeForFirestore({
          ...next.settings,
          updatedAt: new Date().toISOString(),
        });
        batch.set(ref, sanitizedSettings, { merge: true });
        opCount++;
        await commitAndResetIfNeeded();
      }

      // 2. Products (Added / Updated)
      const prevProductMap = new Map(prev.products.map((p) => [p.id, p]));
      const nextProductMap = new Map(next.products.map((p) => [p.id, p]));

      for (const [id, nextP] of nextProductMap) {
        const prevP = prevProductMap.get(id);
        if (
          !prevP ||
          prevP.updatedAt !== nextP.updatedAt ||
          prevP.stockQuantity !== nextP.stockQuantity ||
          prevP.name !== nextP.name ||
          prevP.sellingPrice !== nextP.sellingPrice ||
          JSON.stringify(prevP) !== JSON.stringify(nextP)
        ) {
          const ref = doc(db, 'users', user.uid, 'products', id);
          const sanitizedProduct = sanitizeForFirestore({
            ...nextP,
            updatedAt: nextP.updatedAt || new Date().toISOString(),
          });
          batch.set(ref, sanitizedProduct);
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // Products (Deleted)
      for (const [id] of prevProductMap) {
        if (!nextProductMap.has(id)) {
          const ref = doc(db, 'users', user.uid, 'products', id);
          batch.delete(ref);
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // 3. Stock Movements (Added)
      const prevMovementIds = new Set(prev.movements.map((m) => m.id));
      for (const m of next.movements) {
        if (!prevMovementIds.has(m.id)) {
          const ref = doc(db, 'users', user.uid, 'movements', m.id);
          batch.set(ref, sanitizeForFirestore(m));
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // 4. Clients (Added / Updated)
      const prevClientMap = new Map(prev.clients.map((c) => [c.id, c]));
      const nextClientMap = new Map(next.clients.map((c) => [c.id, c]));

      for (const [id, nextC] of nextClientMap) {
        const prevC = prevClientMap.get(id);
        if (!prevC || JSON.stringify(prevC) !== JSON.stringify(nextC)) {
          const ref = doc(db, 'users', user.uid, 'clients', id);
          const sanitizedClient = sanitizeForFirestore({
            ...nextC,
            updatedAt: nextC.updatedAt || new Date().toISOString(),
          });
          batch.set(ref, sanitizedClient);
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // Clients (Deleted)
      for (const [id] of prevClientMap) {
        if (!nextClientMap.has(id)) {
          const ref = doc(db, 'users', user.uid, 'clients', id);
          batch.delete(ref);
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // 5. Invoices (Added / Updated)
      const prevInvoiceMap = new Map(prev.invoices.map((i) => [i.id, i]));
      const nextInvoiceMap = new Map(next.invoices.map((i) => [i.id, i]));

      for (const [id, nextI] of nextInvoiceMap) {
        const prevI = prevInvoiceMap.get(id);
        if (!prevI || JSON.stringify(prevI) !== JSON.stringify(nextI)) {
          const ref = doc(db, 'users', user.uid, 'invoices', id);
          const sanitizedInvoice = sanitizeForFirestore({
            ...nextI,
            updatedAt: nextI.updatedAt || new Date().toISOString(),
          });
          batch.set(ref, sanitizedInvoice);
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // Invoices (Deleted)
      for (const [id] of prevInvoiceMap) {
        if (!nextInvoiceMap.has(id)) {
          const ref = doc(db, 'users', user.uid, 'invoices', id);
          batch.delete(ref);
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // 6. Quotes (Added / Updated)
      const prevQuoteMap = new Map(prev.quotes.map((q) => [q.id, q]));
      const nextQuoteMap = new Map(next.quotes.map((q) => [q.id, q]));

      for (const [id, nextQ] of nextQuoteMap) {
        const prevQ = prevQuoteMap.get(id);
        if (!prevQ || JSON.stringify(prevQ) !== JSON.stringify(nextQ)) {
          const ref = doc(db, 'users', user.uid, 'quotes', id);
          const sanitizedQuote = sanitizeForFirestore({
            ...nextQ,
            updatedAt: nextQ.updatedAt || new Date().toISOString(),
          });
          batch.set(ref, sanitizedQuote);
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // Quotes (Deleted)
      for (const [id] of prevQuoteMap) {
        if (!nextQuoteMap.has(id)) {
          const ref = doc(db, 'users', user.uid, 'quotes', id);
          batch.delete(ref);
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // 7. Payments (Added)
      const prevPaymentIds = new Set(prev.payments.map((p) => p.id));
      for (const p of next.payments) {
        if (!prevPaymentIds.has(p.id)) {
          const ref = doc(db, 'users', user.uid, 'payments', p.id);
          batch.set(ref, sanitizeForFirestore(p));
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      // 8. Categories (Added / Updated / Deleted)
      const prevCatMap = new Map(prev.categories.map((c) => [c.id, c]));
      const nextCatMap = new Map(next.categories.map((c) => [c.id, c]));

      for (const [id, nextCat] of nextCatMap) {
        const prevCat = prevCatMap.get(id);
        if (!prevCat || JSON.stringify(prevCat) !== JSON.stringify(nextCat)) {
          const ref = doc(db, 'users', user.uid, 'categories', id);
          batch.set(ref, sanitizeForFirestore(nextCat));
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      for (const [id] of prevCatMap) {
        if (!nextCatMap.has(id)) {
          const ref = doc(db, 'users', user.uid, 'categories', id);
          batch.delete(ref);
          opCount++;
          await commitAndResetIfNeeded();
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }

      this.status = {
        ...this.status,
        state: 'idle',
        lastSyncedAt: new Date().toISOString(),
        errorMessage: undefined,
      };
      this.notifyStatus();
    } catch (err: any) {
      const code = err?.code || 'unknown';
      const message = err?.message || 'Erreur lors de la synchronisation';
      console.warn('[FirestoreSync] syncStateChanges error:', {
        operation: 'writeBatch.commit',
        code,
        message,
        error: err,
      });

      this.status = {
        ...this.status,
        state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
        errorMessage: code === 'permission-denied'
          ? 'Permissions insuffisantes pour enregistrer dans Firestore'
          : message,
      };
      this.notifyStatus();
    }
  }

  // --- Granular direct entity sync helpers ---
  public async syncProduct(product: Product): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'products', product.id);
      await setDoc(ref, sanitizeForFirestore({
        ...product,
        updatedAt: product.updatedAt || new Date().toISOString(),
      }));
      this.markCollectionHealthy('products');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncProduct queued or failed:', {
        operation: 'syncProduct',
        productId: product.id,
        error: e,
      });
    }
  }

  public async deleteProduct(productId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'products', productId);
      await deleteDoc(ref);
      this.markCollectionHealthy('products');
    } catch (e: any) {
      console.warn('[FirestoreSync] deleteProduct failed:', {
        operation: 'deleteProduct',
        productId,
        error: e,
      });
    }
  }

  public async syncStockMovement(movement: StockMovement): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'movements', movement.id);
      await setDoc(ref, sanitizeForFirestore(movement));
      this.markCollectionHealthy('movements');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncStockMovement failed:', {
        operation: 'syncStockMovement',
        movementId: movement.id,
        error: e,
      });
    }
  }

  public async syncClient(client: Client): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'clients', client.id);
      await setDoc(ref, sanitizeForFirestore({
        ...client,
        updatedAt: client.updatedAt || new Date().toISOString(),
      }));
      this.markCollectionHealthy('clients');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncClient failed:', {
        operation: 'syncClient',
        clientId: client.id,
        error: e,
      });
    }
  }

  public async deleteClient(clientId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'clients', clientId);
      await deleteDoc(ref);
      this.markCollectionHealthy('clients');
    } catch (e: any) {
      console.warn('[FirestoreSync] deleteClient failed:', {
        operation: 'deleteClient',
        clientId,
        error: e,
      });
    }
  }

  public async syncInvoice(invoice: Invoice): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'invoices', invoice.id);
      await setDoc(ref, sanitizeForFirestore({
        ...invoice,
        updatedAt: invoice.updatedAt || new Date().toISOString(),
      }));
      this.markCollectionHealthy('invoices');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncInvoice failed:', {
        operation: 'syncInvoice',
        invoiceId: invoice.id,
        error: e,
      });
    }
  }

  public async deleteInvoice(invoiceId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'invoices', invoiceId);
      await deleteDoc(ref);
      this.markCollectionHealthy('invoices');
    } catch (e: any) {
      console.warn('[FirestoreSync] deleteInvoice failed:', {
        operation: 'deleteInvoice',
        invoiceId,
        error: e,
      });
    }
  }

  public async syncQuote(quote: Quote): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'quotes', quote.id);
      await setDoc(ref, sanitizeForFirestore({
        ...quote,
        updatedAt: quote.updatedAt || new Date().toISOString(),
      }));
      this.markCollectionHealthy('quotes');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncQuote failed:', {
        operation: 'syncQuote',
        quoteId: quote.id,
        error: e,
      });
    }
  }

  public async deleteQuote(quoteId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'quotes', quoteId);
      await deleteDoc(ref);
      this.markCollectionHealthy('quotes');
    } catch (e: any) {
      console.warn('[FirestoreSync] deleteQuote failed:', {
        operation: 'deleteQuote',
        quoteId,
        error: e,
      });
    }
  }

  public async syncPayment(payment: PaymentRecord): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'payments', payment.id);
      await setDoc(ref, sanitizeForFirestore(payment));
      this.markCollectionHealthy('payments');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncPayment failed:', {
        operation: 'syncPayment',
        paymentId: payment.id,
        error: e,
      });
    }
  }

  public async syncSettings(settings: CompanySettings): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'settings', 'company');
      await setDoc(ref, sanitizeForFirestore({
        ...settings,
        updatedAt: new Date().toISOString(),
      }), { merge: true });
      this.markCollectionHealthy('settings');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncSettings failed:', {
        operation: 'syncSettings',
        error: e,
      });
    }
  }

  public async syncCategory(category: Category): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'categories', category.id);
      await setDoc(ref, sanitizeForFirestore(category));
      this.markCollectionHealthy('categories');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncCategory failed:', {
        operation: 'syncCategory',
        categoryId: category.id,
        error: e,
      });
    }
  }

  public async deleteCategory(categoryId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'categories', categoryId);
      await deleteDoc(ref);
      this.markCollectionHealthy('categories');
    } catch (e: any) {
      console.warn('[FirestoreSync] deleteCategory failed:', {
        operation: 'deleteCategory',
        categoryId,
        error: e,
      });
    }
  }
}

export const firestoreSyncService = new FirestoreSyncService();
