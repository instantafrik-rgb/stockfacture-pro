/**
 * StockFacture Pro - Firestore Real-Time & Offline Sync Service
 * 
 * Synchronizes user data across multiple devices (PC, Phone, Tablet):
 * - Products (Produits)
 * - Stock Movements (Mouvements de stock)
 * - Clients
 * - Invoices (Factures)
 * - Quotes (Devis)
 * - Payments (Paiements)
 * - Settings (Paramètres)
 * - Categories
 * 
 * Features:
 * - Real-time two-way synchronization via Firestore onSnapshot
 * - Offline queue & resilient sync when internet returns
 * - Anti-duplication by document ID
 * - Timestamp-based conflict resolution (Last-Write-Wins)
 * - First-time login migration safety
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

export class FirestoreSyncService {
  private activeSubscriptions: Unsubscribe[] = [];
  private currentUserId: string | null = null;
  private onRemoteUpdateCallback: ((updater: (prevState: AppState) => AppState) => void) | null = null;
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();

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
   * Start syncing for an authenticated user
   */
  public startSync(userId: string) {
    if (this.currentUserId === userId && this.activeSubscriptions.length > 0) {
      return;
    }

    this.stopSync();
    this.currentUserId = userId;
    this.status = {
      ...this.status,
      state: 'syncing',
    };
    this.notifyStatus();

    try {
      this.subscribeToCollections(userId);
      this.status = {
        ...this.status,
        state: 'idle',
        lastSyncedAt: new Date().toISOString(),
      };
      this.notifyStatus();
    } catch (e: any) {
      console.warn('Error starting Firestore sync:', e);
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: e?.message || 'Erreur de synchronisation',
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
    this.status = {
      ...this.status,
      state: 'idle',
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
      return !productsSnap.empty;
    } catch (err) {
      console.warn('Error checking cloud data:', err);
      return false;
    }
  }

  /**
   * Migrate full local state to Firestore on first login
   */
  public async migrateLocalToCloud(userId: string, localState: AppState): Promise<boolean> {
    try {
      this.status = { ...this.status, state: 'syncing' };
      this.notifyStatus();

      // 1. Settings
      if (localState.settings) {
        await setDoc(doc(db, 'users', userId, 'settings', 'company'), {
          ...localState.settings,
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. Batched upload for products, clients, invoices, quotes, payments, movements, categories
      const batch = writeBatch(db);
      let count = 0;

      // Products
      localState.products.forEach((p) => {
        const ref = doc(db, 'users', userId, 'products', p.id);
        batch.set(ref, {
          ...p,
          updatedAt: p.updatedAt || new Date().toISOString(),
          createdAt: p.createdAt || new Date().toISOString(),
        });
        count++;
      });

      // Clients
      localState.clients.forEach((c) => {
        const ref = doc(db, 'users', userId, 'clients', c.id);
        batch.set(ref, {
          ...c,
          updatedAt: c.updatedAt || new Date().toISOString(),
          createdAt: c.createdAt || new Date().toISOString(),
        });
        count++;
      });

      // Invoices
      localState.invoices.forEach((inv) => {
        const ref = doc(db, 'users', userId, 'invoices', inv.id);
        batch.set(ref, {
          ...inv,
          updatedAt: inv.updatedAt || new Date().toISOString(),
          createdAt: inv.createdAt || new Date().toISOString(),
        });
        count++;
      });

      // Quotes
      localState.quotes.forEach((q) => {
        const ref = doc(db, 'users', userId, 'quotes', q.id);
        batch.set(ref, {
          ...q,
          updatedAt: q.updatedAt || new Date().toISOString(),
          createdAt: q.createdAt || new Date().toISOString(),
        });
        count++;
      });

      // Payments
      localState.payments.forEach((pay) => {
        const ref = doc(db, 'users', userId, 'payments', pay.id);
        batch.set(ref, {
          ...pay,
          createdAt: pay.createdAt || new Date().toISOString(),
        });
        count++;
      });

      // Stock Movements
      localState.movements.forEach((m) => {
        const ref = doc(db, 'users', userId, 'movements', m.id);
        batch.set(ref, {
          ...m,
          createdAt: m.createdAt || new Date().toISOString(),
        });
        count++;
      });

      // Categories
      localState.categories.forEach((cat) => {
        const ref = doc(db, 'users', userId, 'categories', cat.id);
        batch.set(ref, cat);
        count++;
      });

      if (count > 0) {
        await batch.commit();
      }

      this.status = {
        ...this.status,
        state: 'idle',
        lastSyncedAt: new Date().toISOString(),
      };
      this.notifyStatus();
      return true;
    } catch (err: any) {
      console.error('Migration to cloud error:', err);
      this.status = {
        ...this.status,
        state: 'error',
        errorMessage: err?.message || 'Erreur lors de la migration cloud',
      };
      this.notifyStatus();
      return false;
    }
  }

  // --- Real-time Listeners for Two-Way Synchronisation ---
  private subscribeToCollections(userId: string) {
    // 1. Settings listener
    const settingsRef = doc(db, 'users', userId, 'settings', 'company');
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists() && this.onRemoteUpdateCallback) {
        const cloudSettings = snap.data() as CompanySettings;
        this.onRemoteUpdateCallback((prev) => ({
          ...prev,
          settings: { ...prev.settings, ...cloudSettings },
        }));
      }
    }, (err) => console.warn('Settings snapshot error:', err));
    this.activeSubscriptions.push(unsubSettings);

    // 2. Products listener
    const productsRef = collection(db, 'users', userId, 'products');
    const unsubProducts = onSnapshot(productsRef, (snap) => {
      if (!snap.empty && this.onRemoteUpdateCallback) {
        const remoteProducts: Product[] = [];
        snap.forEach((d) => {
          const data = d.data() as Product & { _deleted?: boolean };
          if (!data._deleted) {
            remoteProducts.push({ ...data, id: d.id });
          }
        });

        this.onRemoteUpdateCallback((prev) => {
          // Merge remote products by ID and updatedAt
          const map = new Map<string, Product>();
          prev.products.forEach((p) => map.set(p.id, p));
          remoteProducts.forEach((rp) => {
            const local = map.get(rp.id);
            if (!local || (rp.updatedAt && (!local.updatedAt || rp.updatedAt >= local.updatedAt))) {
              map.set(rp.id, rp);
            }
          });
          return {
            ...prev,
            products: Array.from(map.values()),
          };
        });
      }
    }, (err) => console.warn('Products snapshot error:', err));
    this.activeSubscriptions.push(unsubProducts);

    // 3. Invoices listener
    const invoicesRef = collection(db, 'users', userId, 'invoices');
    const unsubInvoices = onSnapshot(invoicesRef, (snap) => {
      if (!snap.empty && this.onRemoteUpdateCallback) {
        const remoteInvoices: Invoice[] = [];
        snap.forEach((d) => {
          const data = d.data() as Invoice & { _deleted?: boolean };
          if (!data._deleted) {
            remoteInvoices.push({ ...data, id: d.id });
          }
        });

        this.onRemoteUpdateCallback((prev) => {
          const map = new Map<string, Invoice>();
          prev.invoices.forEach((inv) => map.set(inv.id, inv));
          remoteInvoices.forEach((rinv) => {
            const local = map.get(rinv.id);
            if (!local || (rinv.updatedAt && (!local.updatedAt || rinv.updatedAt >= local.updatedAt))) {
              map.set(rinv.id, rinv);
            }
          });
          return {
            ...prev,
            invoices: Array.from(map.values()),
          };
        });
      }
    }, (err) => console.warn('Invoices snapshot error:', err));
    this.activeSubscriptions.push(unsubInvoices);

    // 4. Clients listener
    const clientsRef = collection(db, 'users', userId, 'clients');
    const unsubClients = onSnapshot(clientsRef, (snap) => {
      if (!snap.empty && this.onRemoteUpdateCallback) {
        const remoteClients: Client[] = [];
        snap.forEach((d) => {
          const data = d.data() as Client & { _deleted?: boolean };
          if (!data._deleted) {
            remoteClients.push({ ...data, id: d.id });
          }
        });

        this.onRemoteUpdateCallback((prev) => {
          const map = new Map<string, Client>();
          prev.clients.forEach((c) => map.set(c.id, c));
          remoteClients.forEach((rc) => {
            const local = map.get(rc.id);
            if (!local || (rc.updatedAt && (!local.updatedAt || rc.updatedAt >= local.updatedAt))) {
              map.set(rc.id, rc);
            }
          });
          return {
            ...prev,
            clients: Array.from(map.values()),
          };
        });
      }
    }, (err) => console.warn('Clients snapshot error:', err));
    this.activeSubscriptions.push(unsubClients);

    // 5. Quotes listener
    const quotesRef = collection(db, 'users', userId, 'quotes');
    const unsubQuotes = onSnapshot(quotesRef, (snap) => {
      if (!snap.empty && this.onRemoteUpdateCallback) {
        const remoteQuotes: Quote[] = [];
        snap.forEach((d) => {
          const data = d.data() as Quote & { _deleted?: boolean };
          if (!data._deleted) {
            remoteQuotes.push({ ...data, id: d.id });
          }
        });

        this.onRemoteUpdateCallback((prev) => {
          const map = new Map<string, Quote>();
          prev.quotes.forEach((q) => map.set(q.id, q));
          remoteQuotes.forEach((rq) => {
            const local = map.get(rq.id);
            if (!local || (rq.updatedAt && (!local.updatedAt || rq.updatedAt >= local.updatedAt))) {
              map.set(rq.id, rq);
            }
          });
          return {
            ...prev,
            quotes: Array.from(map.values()),
          };
        });
      }
    }, (err) => console.warn('Quotes snapshot error:', err));
    this.activeSubscriptions.push(unsubQuotes);

    // 6. Payments listener
    const paymentsRef = collection(db, 'users', userId, 'payments');
    const unsubPayments = onSnapshot(paymentsRef, (snap) => {
      if (!snap.empty && this.onRemoteUpdateCallback) {
        const remotePayments: PaymentRecord[] = [];
        snap.forEach((d) => {
          remotePayments.push({ ...(d.data() as PaymentRecord), id: d.id });
        });

        this.onRemoteUpdateCallback((prev) => {
          const map = new Map<string, PaymentRecord>();
          prev.payments.forEach((p) => map.set(p.id, p));
          remotePayments.forEach((rp) => map.set(rp.id, rp));
          return {
            ...prev,
            payments: Array.from(map.values()),
          };
        });
      }
    }, (err) => console.warn('Payments snapshot error:', err));
    this.activeSubscriptions.push(unsubPayments);

    // 7. Stock Movements listener
    const movementsRef = collection(db, 'users', userId, 'movements');
    const unsubMovements = onSnapshot(movementsRef, (snap) => {
      if (!snap.empty && this.onRemoteUpdateCallback) {
        const remoteMovements: StockMovement[] = [];
        snap.forEach((d) => {
          remoteMovements.push({ ...(d.data() as StockMovement), id: d.id });
        });

        this.onRemoteUpdateCallback((prev) => {
          const map = new Map<string, StockMovement>();
          prev.movements.forEach((m) => map.set(m.id, m));
          remoteMovements.forEach((rm) => map.set(rm.id, rm));
          return {
            ...prev,
            movements: Array.from(map.values()),
          };
        });
      }
    }, (err) => console.warn('Movements snapshot error:', err));
    this.activeSubscriptions.push(unsubMovements);

    // 8. Categories listener
    const categoriesRef = collection(db, 'users', userId, 'categories');
    const unsubCategories = onSnapshot(categoriesRef, (snap) => {
      if (!snap.empty && this.onRemoteUpdateCallback) {
        const remoteCategories: Category[] = [];
        snap.forEach((d) => {
          remoteCategories.push({ ...(d.data() as Category), id: d.id });
        });

        this.onRemoteUpdateCallback((prev) => {
          const map = new Map<string, Category>();
          prev.categories.forEach((c) => map.set(c.id, c));
          remoteCategories.forEach((rc) => map.set(rc.id, rc));
          return {
            ...prev,
            categories: Array.from(map.values()),
          };
        });
      }
    }, (err) => console.warn('Categories snapshot error:', err));
    this.activeSubscriptions.push(unsubCategories);
  }

  // --- Real-time Entity Sync methods called on write ---
  public async syncProduct(product: Product): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'products', product.id);
      await setDoc(ref, {
        ...product,
        updatedAt: product.updatedAt || new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Sync product queued offline:', e);
    }
  }

  public async deleteProduct(productId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      // Soft-delete with tombstone so other offline devices know it was removed
      const ref = doc(db, 'users', user.uid, 'products', productId);
      await setDoc(ref, { _deleted: true, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('Sync deleteProduct queued offline:', e);
    }
  }

  public async syncStockMovement(movement: StockMovement): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'movements', movement.id);
      await setDoc(ref, movement, { merge: true });
    } catch (e) {
      console.warn('Sync movement queued offline:', e);
    }
  }

  public async syncClient(client: Client): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'clients', client.id);
      await setDoc(ref, {
        ...client,
        updatedAt: client.updatedAt || new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Sync client queued offline:', e);
    }
  }

  public async deleteClient(clientId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'clients', clientId);
      await setDoc(ref, { _deleted: true, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('Sync deleteClient queued offline:', e);
    }
  }

  public async syncInvoice(invoice: Invoice): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'invoices', invoice.id);
      await setDoc(ref, {
        ...invoice,
        updatedAt: invoice.updatedAt || new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Sync invoice queued offline:', e);
    }
  }

  public async deleteInvoice(invoiceId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'invoices', invoiceId);
      await setDoc(ref, { _deleted: true, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('Sync deleteInvoice queued offline:', e);
    }
  }

  public async syncQuote(quote: Quote): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'quotes', quote.id);
      await setDoc(ref, {
        ...quote,
        updatedAt: quote.updatedAt || new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Sync quote queued offline:', e);
    }
  }

  public async deleteQuote(quoteId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'quotes', quoteId);
      await setDoc(ref, { _deleted: true, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('Sync deleteQuote queued offline:', e);
    }
  }

  public async syncPayment(payment: PaymentRecord): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'payments', payment.id);
      await setDoc(ref, payment, { merge: true });
    } catch (e) {
      console.warn('Sync payment queued offline:', e);
    }
  }

  public async syncSettings(settings: CompanySettings): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'settings', 'company');
      await setDoc(ref, {
        ...settings,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Sync settings queued offline:', e);
    }
  }

  public async syncCategory(category: Category): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'categories', category.id);
      await setDoc(ref, category, { merge: true });
    } catch (e) {
      console.warn('Sync category queued offline:', e);
    }
  }

  public async deleteCategory(categoryId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'categories', categoryId);
      await deleteDoc(ref);
    } catch (e) {
      console.warn('Sync deleteCategory queued offline:', e);
    }
  }
}

export const firestoreSyncService = new FirestoreSyncService();
