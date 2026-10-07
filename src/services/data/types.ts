/**
 * StockFacture Pro - Data Layer Architecture & Firebase Synchronization Contracts
 * 
 * Defines standard repositories and sync metadata for:
 * - Products (Produits)
 * - Stock Movements (Mouvements de stock)
 * - Clients
 * - Invoices (Factures)
 * - Quotes (Devis)
 * - Payments (Paiements)
 * - Settings (Paramètres)
 * - Categories
 */

import {
  Product,
  StockMovement,
  Client,
  Invoice,
  Quote,
  PaymentRecord,
  CompanySettings,
  Category,
  AppState,
} from '../../types';

/**
 * Base metadata added to documents for two-way multi-device synchronization
 */
export interface SyncMetadata {
  updatedAt: string;        // ISO 8601 timestamp for conflict resolution (Last-Write-Wins)
  createdAt: string;        // ISO 8601 timestamp
  _synced?: boolean;        // True if successfully acknowledged by cloud
  _deleted?: boolean;       // Soft delete tombstone (crucial so offline devices don't revive deleted items)
  _version?: number;        // Monotonic version counter for optimistic locking
  _deviceId?: string;       // Origin device ID (e.g. "mobile-1", "pc-office")
}

export type SyncState = 'offline' | 'idle' | 'syncing' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt?: string;
  pendingChangesCount: number;
  errorMessage?: string;
  isOnline: boolean;
}

// 1. PRODUCTS REPOSITORY
export interface IProductRepository {
  getAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
  saveMany(products: Product[]): Promise<void>;
  delete(id: string): Promise<void>;
}

// 2. STOCK MOVEMENTS REPOSITORY
export interface IStockMovementRepository {
  getAll(): Promise<StockMovement[]>;
  add(movement: StockMovement): Promise<void>;
  addMany(movements: StockMovement[]): Promise<void>;
}

// 3. CLIENTS REPOSITORY
export interface IClientRepository {
  getAll(): Promise<Client[]>;
  getById(id: string): Promise<Client | null>;
  save(client: Client): Promise<void>;
  delete(id: string): Promise<void>;
}

// 4. INVOICES REPOSITORY
export interface IInvoiceRepository {
  getAll(): Promise<Invoice[]>;
  getById(id: string): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
  saveMany(invoices: Invoice[]): Promise<void>;
  delete(id: string): Promise<void>;
}

// 5. QUOTES REPOSITORY
export interface IQuoteRepository {
  getAll(): Promise<Quote[]>;
  getById(id: string): Promise<Quote | null>;
  save(quote: Quote): Promise<void>;
  delete(id: string): Promise<void>;
}

// 6. PAYMENTS REPOSITORY
export interface IPaymentRepository {
  getAll(): Promise<PaymentRecord[]>;
  add(payment: PaymentRecord): Promise<void>;
  addMany(payments: PaymentRecord[]): Promise<void>;
}

// 7. SETTINGS REPOSITORY
export interface ISettingsRepository {
  get(): Promise<CompanySettings>;
  save(settings: CompanySettings): Promise<void>;
}

// 8. CATEGORIES REPOSITORY
export interface ICategoryRepository {
  getAll(): Promise<Category[]>;
  save(category: Category): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Composite Data Repository interface
 * Acts as the single point of entry between the UI / Store and the storage engines (local & cloud)
 */
export interface IDataRepository {
  // Collection sub-repositories
  products: IProductRepository;
  movements: IStockMovementRepository;
  clients: IClientRepository;
  invoices: IInvoiceRepository;
  quotes: IQuoteRepository;
  payments: IPaymentRepository;
  settings: ISettingsRepository;
  categories: ICategoryRepository;

  // Snapshot operations (Full state backup / initial load / export / clear)
  loadFullState(): Promise<AppState | null>;
  saveFullState(state: AppState): Promise<boolean>;
  clearAll?(): Promise<void>;
  clearAccountCache?(userId?: string | null): Promise<void>;
  setUserScope(userId: string | null): void;
  exportData?(state: AppState): void;

  // Sync lifecycle (Prepared for Firebase step)
  getSyncStatus(): SyncStatus;
  subscribeToSyncStatus?(callback: (status: SyncStatus) => void): () => void;
  triggerSync?(): Promise<{ success: boolean; error?: string }>;
}
