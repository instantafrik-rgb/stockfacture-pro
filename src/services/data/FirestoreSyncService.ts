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
 * - Closures (Clôtures de caisse)
 * 
 * Architecture:
 * - Bidirectional real-time synchronization via Firestore onSnapshot
 * - Firestore is the single source of truth for authenticated users
 * - Local storage (IndexedDB/localStorage) acts as an offline cache
 * - Anti-data-loss protection: never overwrites existing local data if cloud collection is empty
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
  runTransaction,
  increment,
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
  CashRegisterClosure,
  RestockRequest,
  SaleReturn,
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

/**
 * Check if a record was created recently (within given window in ms).
 * Used to avoid erasing newly created local records before they reach the cloud.
 */
function isRecentlyCreated(createdAt?: string, windowMs = 180000): boolean {
  if (!createdAt) return false;
  try {
    const createdTime = new Date(createdAt).getTime();
    if (isNaN(createdTime)) return false;
    return Date.now() - createdTime < windowMs;
  } catch {
    return false;
  }
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

      const clientsRef = collection(db, 'users', userId, 'clients');
      const clientsSnap = await getDocs(clientsRef);
      if (!clientsSnap.empty) return true;

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

      // Closures
      if (localState.closures) {
        for (const cl of localState.closures) {
          const ref = doc(db, 'users', userId, 'closures', cl.id);
          batch.set(ref, sanitizeForFirestore(cl));
          count++;
          await commitAndResetBatchIfNeeded();
        }
      }

      // Restock Requests (Clients à relancer)
      if (localState.restockRequests) {
        for (const rr of localState.restockRequests) {
          const ref = doc(db, 'users', userId, 'restockRequests', rr.id);
          batch.set(ref, sanitizeForFirestore(rr));
          count++;
          await commitAndResetBatchIfNeeded();
        }
      }

      // Sale Returns (Retours, avoirs, échanges)
      if (localState.returns) {
        for (const ret of localState.returns) {
          const ref = doc(db, 'users', userId, 'returns', ret.id);
          batch.set(ref, sanitizeForFirestore(ret));
          count++;
          await commitAndResetBatchIfNeeded();
        }
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
            hasCompletedOnboarding: true,
            settings: {
              ...prev.settings,
              ...cloudSettings,
              hasCompletedOnboarding: true,
            },
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

          remoteProducts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

          this.onRemoteUpdateCallback((prev) => {
            if (remoteProducts.length === 0 && prev.products && prev.products.length > 0) {
              this.syncLocalProductsIfCloudEmpty(userId, prev.products);
              return prev;
            }

            const remoteIds = new Set(remoteProducts.map((p) => p.id));
            const pendingLocal = prev.products.filter(
              (p) => !remoteIds.has(p.id) && isRecentlyCreated(p.createdAt)
            );

            if (pendingLocal.length > 0) {
              this.syncLocalProductsIfCloudEmpty(userId, pendingLocal);
              const merged = [...remoteProducts, ...pendingLocal];
              merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
              return { ...prev, products: merged };
            }

            return {
              ...prev,
              products: remoteProducts,
            };
          });
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

          this.onRemoteUpdateCallback((prev) => {
            if (remoteInvoices.length === 0 && prev.invoices && prev.invoices.length > 0) {
              this.syncLocalInvoicesIfCloudEmpty(userId, prev.invoices);
              return prev;
            }

            const remoteIds = new Set(remoteInvoices.map((i) => i.id));
            const pendingLocal = prev.invoices.filter(
              (i) => !remoteIds.has(i.id) && isRecentlyCreated(i.createdAt)
            );

            if (pendingLocal.length > 0) {
              this.syncLocalInvoicesIfCloudEmpty(userId, pendingLocal);
              const merged = [...remoteInvoices, ...pendingLocal];
              merged.sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
              return { ...prev, invoices: merged };
            }

            return {
              ...prev,
              invoices: remoteInvoices,
            };
          });
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

          this.onRemoteUpdateCallback((prev) => {
            // Anti-data-loss protection:
            // If remote collection has 0 clients but local device has clients, preserve and upload!
            if (remoteClients.length === 0 && prev.clients && prev.clients.length > 0) {
              this.syncLocalClientsIfCloudEmpty(userId, prev.clients);
              return prev;
            }

            const remoteIds = new Set(remoteClients.map((c) => c.id));
            const pendingLocal = prev.clients.filter(
              (c) => !remoteIds.has(c.id) && isRecentlyCreated(c.createdAt)
            );

            if (pendingLocal.length > 0) {
              this.syncLocalClientsIfCloudEmpty(userId, pendingLocal);
              const merged = [...remoteClients, ...pendingLocal];
              merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
              return { ...prev, clients: merged };
            }

            return {
              ...prev,
              clients: remoteClients,
            };
          });
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

          this.onRemoteUpdateCallback((prev) => {
            if (remoteQuotes.length === 0 && prev.quotes && prev.quotes.length > 0) {
              this.syncLocalQuotesIfCloudEmpty(userId, prev.quotes);
              return prev;
            }

            const remoteIds = new Set(remoteQuotes.map((q) => q.id));
            const pendingLocal = prev.quotes.filter(
              (q) => !remoteIds.has(q.id) && isRecentlyCreated(q.createdAt)
            );

            if (pendingLocal.length > 0) {
              this.syncLocalQuotesIfCloudEmpty(userId, pendingLocal);
              const merged = [...remoteQuotes, ...pendingLocal];
              merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
              return { ...prev, quotes: merged };
            }

            return {
              ...prev,
              quotes: remoteQuotes,
            };
          });
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

          this.onRemoteUpdateCallback((prev) => {
            if (remotePayments.length === 0 && prev.payments && prev.payments.length > 0) {
              this.syncLocalPaymentsIfCloudEmpty(userId, prev.payments);
              return prev;
            }

            const remoteIds = new Set(remotePayments.map((p) => p.id));
            const pendingLocal = prev.payments.filter(
              (p) => !remoteIds.has(p.id) && isRecentlyCreated(p.createdAt)
            );

            if (pendingLocal.length > 0) {
              this.syncLocalPaymentsIfCloudEmpty(userId, pendingLocal);
              const merged = [...remotePayments, ...pendingLocal];
              merged.sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));
              return { ...prev, payments: merged };
            }

            return {
              ...prev,
              payments: remotePayments,
            };
          });
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

          this.onRemoteUpdateCallback((prev) => {
            if (remoteMovements.length === 0 && prev.movements && prev.movements.length > 0) {
              this.syncLocalMovementsIfCloudEmpty(userId, prev.movements);
              return prev;
            }

            const remoteIds = new Set(remoteMovements.map((m) => m.id));
            const pendingLocal = prev.movements.filter(
              (m) => !remoteIds.has(m.id) && isRecentlyCreated(m.createdAt)
            );

            if (pendingLocal.length > 0) {
              this.syncLocalMovementsIfCloudEmpty(userId, pendingLocal);
              const merged = [...remoteMovements, ...pendingLocal];
              merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
              return { ...prev, movements: merged };
            }

            return {
              ...prev,
              movements: remoteMovements,
            };
          });
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

          this.onRemoteUpdateCallback((prev) => {
            if (remoteCategories.length === 0 && prev.categories && prev.categories.length > 0) {
              this.syncLocalCategoriesIfCloudEmpty(userId, prev.categories);
              return prev;
            }

            return {
              ...prev,
              categories: remoteCategories,
            };
          });
        }
        this.markCollectionHealthy('categories');
      },
      (err) => this.handleSnapshotError('categories', err)
    );
    this.activeSubscriptions.push(unsubCategories);

    // 9. Closures (Clôtures de caisse) listener
    const closuresRef = collection(db, 'users', userId, 'closures');
    const unsubClosures = onSnapshot(
      closuresRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remoteClosures: CashRegisterClosure[] = [];
          snap.forEach((d) => {
            remoteClosures.push({ ...(d.data() as CashRegisterClosure), id: d.id });
          });

          remoteClosures.sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || ''));

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            closures: remoteClosures,
          }));
        }
        this.markCollectionHealthy('closures');
      },
      (err) => this.handleSnapshotError('closures', err)
    );
    this.activeSubscriptions.push(unsubClosures);

    // 10. Restock Requests (Clients à relancer) listener
    const restockRef = collection(db, 'users', userId, 'restockRequests');
    const unsubRestock = onSnapshot(
      restockRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remoteRequests: RestockRequest[] = [];
          snap.forEach((d) => {
            remoteRequests.push({ ...(d.data() as RestockRequest), id: d.id });
          });

          remoteRequests.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            restockRequests: remoteRequests,
          }));
        }
        this.markCollectionHealthy('restockRequests');
      },
      (err) => this.handleSnapshotError('restockRequests', err)
    );
    this.activeSubscriptions.push(unsubRestock);

    // 11. Sale Returns (Retours, avoirs, échanges) listener
    const returnsRef = collection(db, 'users', userId, 'returns');
    const unsubReturns = onSnapshot(
      returnsRef,
      (snap) => {
        if (this.onRemoteUpdateCallback) {
          const remoteReturns: SaleReturn[] = [];
          snap.forEach((d) => {
            remoteReturns.push({ ...(d.data() as SaleReturn), id: d.id });
          });

          remoteReturns.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

          this.onRemoteUpdateCallback((prev) => ({
            ...prev,
            returns: remoteReturns,
          }));
        }
        this.markCollectionHealthy('returns');
      },
      (err) => this.handleSnapshotError('returns', err)
    );
    this.activeSubscriptions.push(unsubReturns);
  }

  // --- Auto-upload helpers for unmigrated local collections ---
  private async syncLocalClientsIfCloudEmpty(userId: string, clients: Client[]) {
    if (!clients || clients.length === 0) return;
    try {
      let batch = writeBatch(db);
      let count = 0;
      for (const client of clients) {
        const ref = doc(db, 'users', userId, 'clients', client.id);
        batch.set(ref, sanitizeForFirestore({
          ...client,
          updatedAt: client.updatedAt || new Date().toISOString(),
          createdAt: client.createdAt || new Date().toISOString(),
        }));
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
      console.log(`[FirestoreSync] Preserved and synced ${clients.length} clients to Firestore.`);
    } catch (e) {
      console.warn('[FirestoreSync] Failed to sync local clients:', e);
    }
  }

  private async syncLocalProductsIfCloudEmpty(userId: string, products: Product[]) {
    if (!products || products.length === 0) return;
    try {
      let batch = writeBatch(db);
      let count = 0;
      for (const product of products) {
        const ref = doc(db, 'users', userId, 'products', product.id);
        batch.set(ref, sanitizeForFirestore({
          ...product,
          updatedAt: product.updatedAt || new Date().toISOString(),
          createdAt: product.createdAt || new Date().toISOString(),
        }));
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    } catch (e) {
      console.warn('[FirestoreSync] Failed to sync local products:', e);
    }
  }

  private async syncLocalInvoicesIfCloudEmpty(userId: string, invoices: Invoice[]) {
    if (!invoices || invoices.length === 0) return;
    try {
      let batch = writeBatch(db);
      let count = 0;
      for (const inv of invoices) {
        const ref = doc(db, 'users', userId, 'invoices', inv.id);
        batch.set(ref, sanitizeForFirestore({
          ...inv,
          updatedAt: inv.updatedAt || new Date().toISOString(),
          createdAt: inv.createdAt || new Date().toISOString(),
        }));
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    } catch (e) {
      console.warn('[FirestoreSync] Failed to sync local invoices:', e);
    }
  }

  private async syncLocalQuotesIfCloudEmpty(userId: string, quotes: Quote[]) {
    if (!quotes || quotes.length === 0) return;
    try {
      let batch = writeBatch(db);
      let count = 0;
      for (const q of quotes) {
        const ref = doc(db, 'users', userId, 'quotes', q.id);
        batch.set(ref, sanitizeForFirestore({
          ...q,
          updatedAt: q.updatedAt || new Date().toISOString(),
          createdAt: q.createdAt || new Date().toISOString(),
        }));
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    } catch (e) {
      console.warn('[FirestoreSync] Failed to sync local quotes:', e);
    }
  }

  private async syncLocalPaymentsIfCloudEmpty(userId: string, payments: PaymentRecord[]) {
    if (!payments || payments.length === 0) return;
    try {
      let batch = writeBatch(db);
      let count = 0;
      for (const p of payments) {
        const ref = doc(db, 'users', userId, 'payments', p.id);
        batch.set(ref, sanitizeForFirestore(p));
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    } catch (e) {
      console.warn('[FirestoreSync] Failed to sync local payments:', e);
    }
  }

  private async syncLocalMovementsIfCloudEmpty(userId: string, movements: StockMovement[]) {
    if (!movements || movements.length === 0) return;
    try {
      let batch = writeBatch(db);
      let count = 0;
      for (const m of movements) {
        const ref = doc(db, 'users', userId, 'movements', m.id);
        batch.set(ref, sanitizeForFirestore(m));
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) await batch.commit();
    } catch (e) {
      console.warn('[FirestoreSync] Failed to sync local movements:', e);
    }
  }

  private async syncLocalCategoriesIfCloudEmpty(userId: string, categories: Category[]) {
    if (!categories || categories.length === 0) return;
    try {
      let batch = writeBatch(db);
      for (const cat of categories) {
        const ref = doc(db, 'users', userId, 'categories', cat.id);
        batch.set(ref, sanitizeForFirestore(cat));
      }
      await batch.commit();
    } catch (e) {
      console.warn('[FirestoreSync] Failed to sync local categories:', e);
    }
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
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: `Permissions insuffisantes sur ${collectionName}`,
      };
    } else if (this.healthyCollections.size === 0) {
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: `Erreur synchronisation ${collectionName}: ${message}`,
      };
    } else {
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

      // 9. Closures (Added)
      if (next.closures) {
        const prevClosuresIds = new Set((prev.closures || []).map((cl) => cl.id));
        for (const cl of next.closures) {
          if (!prevClosuresIds.has(cl.id)) {
            const ref = doc(db, 'users', user.uid, 'closures', cl.id);
            batch.set(ref, sanitizeForFirestore(cl));
            opCount++;
            await commitAndResetIfNeeded();
          }
        }
      }

      // 10. Returns (Added / Updated / Deleted)
      if (next.returns) {
        const prevReturnsMap = new Map((prev.returns || []).map((r) => [r.id, r]));
        const nextReturnsMap = new Map(next.returns.map((r) => [r.id, r]));

        for (const [id, nextRet] of nextReturnsMap) {
          const prevRet = prevReturnsMap.get(id);
          if (!prevRet || JSON.stringify(prevRet) !== JSON.stringify(nextRet)) {
            const ref = doc(db, 'users', user.uid, 'returns', id);
            batch.set(ref, sanitizeForFirestore(nextRet));
            opCount++;
            await commitAndResetIfNeeded();
          }
        }

        for (const [id] of prevReturnsMap) {
          if (!nextReturnsMap.has(id)) {
            const ref = doc(db, 'users', user.uid, 'returns', id);
            batch.delete(ref);
            opCount++;
            await commitAndResetIfNeeded();
          }
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
      console.warn('[FirestoreSync] syncProduct failed:', { productId: product.id, error: e });
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
      console.warn('[FirestoreSync] deleteProduct failed:', { productId, error: e });
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
      console.warn('[FirestoreSync] syncStockMovement failed:', { movementId: movement.id, error: e });
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
      console.warn('[FirestoreSync] syncClient failed:', { clientId: client.id, error: e });
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
      console.warn('[FirestoreSync] deleteClient failed:', { clientId, error: e });
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
      console.warn('[FirestoreSync] syncInvoice failed:', { invoiceId: invoice.id, error: e });
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
      console.warn('[FirestoreSync] deleteInvoice failed:', { invoiceId, error: e });
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
      console.warn('[FirestoreSync] syncQuote failed:', { quoteId: quote.id, error: e });
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
      console.warn('[FirestoreSync] deleteQuote failed:', { quoteId, error: e });
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
      console.warn('[FirestoreSync] syncPayment failed:', { paymentId: payment.id, error: e });
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
      console.warn('[FirestoreSync] syncSettings failed:', { error: e });
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
      console.warn('[FirestoreSync] syncCategory failed:', { categoryId: category.id, error: e });
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
      console.warn('[FirestoreSync] deleteCategory failed:', { categoryId, error: e });
    }
  }

  public async syncClosure(closure: CashRegisterClosure): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'closures', closure.id);
      await setDoc(ref, sanitizeForFirestore(closure));
      this.markCollectionHealthy('closures');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncClosure failed:', { closureId: closure.id, error: e });
    }
  }

  public async syncRestockRequest(request: RestockRequest): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'restockRequests', request.id);
      await setDoc(ref, sanitizeForFirestore(request));
      this.markCollectionHealthy('restockRequests');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncRestockRequest failed:', { requestId: request.id, error: e });
    }
  }

  public async deleteRestockRequest(requestId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'restockRequests', requestId);
      await deleteDoc(ref);
      this.markCollectionHealthy('restockRequests');
    } catch (e: any) {
      console.warn('[FirestoreSync] deleteRestockRequest failed:', { requestId, error: e });
    }
  }

  public async syncReturn(saleReturn: SaleReturn): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'returns', saleReturn.id);
      await setDoc(ref, sanitizeForFirestore(saleReturn));
      this.markCollectionHealthy('returns');
    } catch (e: any) {
      console.warn('[FirestoreSync] syncReturn failed:', { returnId: saleReturn.id, error: e });
    }
  }

  public async deleteReturn(returnId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'returns', returnId);
      await deleteDoc(ref);
      this.markCollectionHealthy('returns');
    } catch (e: any) {
      console.warn('[FirestoreSync] deleteReturn failed:', { returnId, error: e });
    }
  }

  /**
   * Complete resynchronization of a newly restored state to Firestore Cloud.
   * Ensures all collections are fully written to the authenticated user's cloud database.
   */
  public async syncFullRestoredState(restoredState: AppState): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return true; // Local-only mode
    return await this.migrateLocalToCloud(user.uid, restoredState);
  }

  /**
   * Atomic Firestore transaction for a sale:
   * 1. Reads latest cloud product documents.
   * 2. Checks sufficiency if allowNegativeStock is false.
   * 3. Atomically decrements product stock without lost updates.
   * 4. Writes the invoice, payment, and movements all in the same atomic transaction.
   */
  public async commitSaleStockTransaction(params: {
    userId: string;
    invoice: Invoice;
    payment?: PaymentRecord;
    items: Array<{ productId?: string; designation: string; quantity: number; isFreeLine?: boolean }>;
    movements: StockMovement[];
    allowNegativeStock: boolean;
    nextInvoiceNumber?: number;
  }): Promise<{ success: boolean; error?: string; updatedStocks?: Record<string, number> }> {
    try {
      const { userId, invoice, payment, items, movements, allowNegativeStock, nextInvoiceNumber } = params;
      const updatedStocks: Record<string, number> = {};

      await runTransaction(db, async (transaction) => {
        // Step 1: Read all catalog products involved in the sale
        const productReads: Array<{ ref: any; currentStock: number; id: string; designation: string; qty: number }> = [];

        for (const item of items) {
          if (!item.isFreeLine && item.productId) {
            const pRef = doc(db, 'users', userId, 'products', item.productId);
            const pSnap = await transaction.get(pRef);
            if (pSnap.exists()) {
              const currentStock = Number(pSnap.data().stockQuantity) || 0;
              productReads.push({
                ref: pRef,
                currentStock,
                id: item.productId,
                designation: item.designation,
                qty: item.quantity,
              });
            }
          }
        }

        // Step 2: Validate stock sufficiency if negative stock is disallowed
        if (!allowNegativeStock) {
          for (const pr of productReads) {
            if (pr.currentStock < pr.qty) {
              throw new Error(
                `Stock insuffisant sur le Cloud pour "${pr.designation}". Disponible: ${pr.currentStock}, Demandé: ${pr.qty}.`
              );
            }
          }
        }

        // Step 3: Perform atomic writes for all products
        const nowIso = new Date().toISOString();
        for (const pr of productReads) {
          const newStock = pr.currentStock - pr.qty;
          transaction.update(pr.ref, {
            stockQuantity: newStock,
            updatedAt: nowIso,
          });
          updatedStocks[pr.id] = newStock;
        }

        // Step 4: Save the invoice
        const invRef = doc(db, 'users', userId, 'invoices', invoice.id);
        transaction.set(invRef, sanitizeForFirestore({
          ...invoice,
          updatedAt: nowIso,
        }));

        // Step 5: Save payment if provided
        if (payment) {
          const payRef = doc(db, 'users', userId, 'payments', payment.id);
          transaction.set(payRef, sanitizeForFirestore(payment));
        }

        // Step 6: Save each stock movement
        for (const mov of movements) {
          const movRef = doc(db, 'users', userId, 'movements', mov.id);
          transaction.set(movRef, sanitizeForFirestore(mov));
        }

        // Step 7: Update next invoice number in settings
        if (nextInvoiceNumber !== undefined) {
          const settingsRef = doc(db, 'users', userId, 'settings', 'company');
          transaction.set(settingsRef, { nextInvoiceNumber }, { merge: true });
        }
      });

      this.markCollectionHealthy('products');
      this.markCollectionHealthy('invoices');
      this.markCollectionHealthy('movements');
      if (payment) this.markCollectionHealthy('payments');

      return { success: true, updatedStocks };
    } catch (err: any) {
      console.warn('[FirestoreSync] commitSaleStockTransaction error:', err);
      return { success: false, error: err?.message || 'Erreur lors de la validation atomique du stock' };
    }
  }

  /**
   * Atomic Firestore transaction for manual stock movements and adjustments
   */
  public async commitStockMovementTransaction(params: {
    userId: string;
    movement: StockMovement;
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    allowNegativeStock: boolean;
  }): Promise<{ success: boolean; error?: string; newStock?: number }> {
    try {
      const { userId, movement, type, quantity, allowNegativeStock } = params;
      let calculatedNewStock = movement.newStock;

      await runTransaction(db, async (transaction) => {
        const pRef = doc(db, 'users', userId, 'products', movement.productId);
        const pSnap = await transaction.get(pRef);
        if (!pSnap.exists()) {
          throw new Error('Produit introuvable dans la base de données');
        }

        const currentStock = Number(pSnap.data().stockQuantity) || 0;
        let targetStock = currentStock;

        if (type === 'in') {
          targetStock = currentStock + Math.max(0, quantity);
        } else if (type === 'out') {
          const moveQty = Math.max(0, quantity);
          if (!allowNegativeStock && currentStock < moveQty) {
            throw new Error(`Stock insuffisant (${currentStock} disponible). Le stock négatif est désactivé.`);
          }
          targetStock = currentStock - moveQty;
        } else if (type === 'adjustment') {
          targetStock = quantity;
        }

        calculatedNewStock = targetStock;
        const nowIso = new Date().toISOString();

        transaction.update(pRef, {
          stockQuantity: targetStock,
          updatedAt: nowIso,
        });

        const movRef = doc(db, 'users', userId, 'movements', movement.id);
        transaction.set(movRef, sanitizeForFirestore({
          ...movement,
          previousStock: currentStock,
          newStock: targetStock,
        }));
      });

      this.markCollectionHealthy('products');
      this.markCollectionHealthy('movements');

      return { success: true, newStock: calculatedNewStock };
    } catch (err: any) {
      console.warn('[FirestoreSync] commitStockMovementTransaction error:', err);
      return { success: false, error: err?.message || 'Erreur lors de l’ajustement de stock' };
    }
  }

  /**
   * Atomic Firestore transaction for invoice cancellation and stock recovery
   */
  public async commitCancelInvoiceTransaction(params: {
    userId: string;
    invoiceId: string;
    itemsToRestore: Array<{ productId: string; quantity: number }>;
    movements: StockMovement[];
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { userId, invoiceId, itemsToRestore, movements } = params;
      const nowIso = new Date().toISOString();

      await runTransaction(db, async (transaction) => {
        // Read products
        const pReads: Array<{ ref: any; currentStock: number; qty: number }> = [];
        for (const item of itemsToRestore) {
          const pRef = doc(db, 'users', userId, 'products', item.productId);
          const pSnap = await transaction.get(pRef);
          if (pSnap.exists()) {
            pReads.push({
              ref: pRef,
              currentStock: Number(pSnap.data().stockQuantity) || 0,
              qty: item.quantity,
            });
          }
        }

        // Restore stock
        for (const pr of pReads) {
          transaction.update(pr.ref, {
            stockQuantity: pr.currentStock + pr.qty,
            updatedAt: nowIso,
          });
        }

        // Update invoice status
        const invRef = doc(db, 'users', userId, 'invoices', invoiceId);
        transaction.update(invRef, {
          status: 'cancelled',
          updatedAt: nowIso,
        });

        // Add return movements
        for (const m of movements) {
          const mRef = doc(db, 'users', userId, 'movements', m.id);
          transaction.set(mRef, sanitizeForFirestore(m));
        }
      });

      this.markCollectionHealthy('products');
      this.markCollectionHealthy('invoices');
      this.markCollectionHealthy('movements');

      return { success: true };
    } catch (err: any) {
      console.warn('[FirestoreSync] commitCancelInvoiceTransaction error:', err);
      return { success: false, error: err?.message || 'Erreur lors de l’annulation de la facture' };
    }
  }
}

export const firestoreSyncService = new FirestoreSyncService();
