/**
 * StockFacture Pro - Local Data Repository with Cloud Sync Integration
 * 
 * Implements IDataRepository using local persistent storage (IndexedDB + localStorage fallback)
 * and dispatches updates to FirestoreSyncService for seamless multi-device synchronization.
 */

import {
  IDataRepository,
  IProductRepository,
  IStockMovementRepository,
  IClientRepository,
  IInvoiceRepository,
  IQuoteRepository,
  IPaymentRepository,
  ISettingsRepository,
  ICategoryRepository,
  SyncStatus,
} from './types';
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
import { storageService } from '../storageService';
import { firestoreSyncService } from './FirestoreSyncService';

export class LocalDataRepository implements IDataRepository {
  // 1. PRODUCTS REPOSITORY
  readonly products: IProductRepository = {
    getAll: async (): Promise<Product[]> => {
      const state = await this.loadFullState();
      return state?.products || [];
    },
    getById: async (id: string): Promise<Product | null> => {
      const products = await this.products.getAll();
      return products.find((p) => p.id === id) || null;
    },
    save: async (product: Product): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const index = state.products.findIndex((p) => p.id === product.id);
      let updatedProducts = [...state.products];
      if (index >= 0) {
        updatedProducts[index] = product;
      } else {
        updatedProducts = [product, ...updatedProducts];
      }
      await this.saveFullState({ ...state, products: updatedProducts });
      firestoreSyncService.syncProduct(product).catch(() => {});
    },
    saveMany: async (newProducts: Product[]): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      await this.saveFullState({ ...state, products: newProducts });
      newProducts.forEach((p) => firestoreSyncService.syncProduct(p).catch(() => {}));
    },
    delete: async (id: string): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const updated = state.products.filter((p) => p.id !== id);
      await this.saveFullState({ ...state, products: updated });
      firestoreSyncService.deleteProduct(id).catch(() => {});
    },
  };

  // 2. STOCK MOVEMENTS REPOSITORY
  readonly movements: IStockMovementRepository = {
    getAll: async (): Promise<StockMovement[]> => {
      const state = await this.loadFullState();
      return state?.movements || [];
    },
    add: async (movement: StockMovement): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      await this.saveFullState({
        ...state,
        movements: [movement, ...state.movements],
      });
      firestoreSyncService.syncStockMovement(movement).catch(() => {});
    },
    addMany: async (movements: StockMovement[]): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      await this.saveFullState({
        ...state,
        movements: [...movements, ...state.movements],
      });
      movements.forEach((m) => firestoreSyncService.syncStockMovement(m).catch(() => {}));
    },
  };

  // 3. CLIENTS REPOSITORY
  readonly clients: IClientRepository = {
    getAll: async (): Promise<Client[]> => {
      const state = await this.loadFullState();
      return state?.clients || [];
    },
    getById: async (id: string): Promise<Client | null> => {
      const clients = await this.clients.getAll();
      return clients.find((c) => c.id === id) || null;
    },
    save: async (client: Client): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const index = state.clients.findIndex((c) => c.id === client.id);
      let updatedClients = [...state.clients];
      if (index >= 0) {
        updatedClients[index] = client;
      } else {
        updatedClients = [client, ...updatedClients];
      }
      await this.saveFullState({ ...state, clients: updatedClients });
      firestoreSyncService.syncClient(client).catch(() => {});
    },
    delete: async (id: string): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const updated = state.clients.filter((c) => c.id !== id);
      await this.saveFullState({ ...state, clients: updated });
      firestoreSyncService.deleteClient(id).catch(() => {});
    },
  };

  // 4. INVOICES REPOSITORY
  readonly invoices: IInvoiceRepository = {
    getAll: async (): Promise<Invoice[]> => {
      const state = await this.loadFullState();
      return state?.invoices || [];
    },
    getById: async (id: string): Promise<Invoice | null> => {
      const invoices = await this.invoices.getAll();
      return invoices.find((i) => i.id === id) || null;
    },
    save: async (invoice: Invoice): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const index = state.invoices.findIndex((i) => i.id === invoice.id);
      let updatedInvoices = [...state.invoices];
      if (index >= 0) {
        updatedInvoices[index] = invoice;
      } else {
        updatedInvoices = [invoice, ...updatedInvoices];
      }
      await this.saveFullState({ ...state, invoices: updatedInvoices });
      firestoreSyncService.syncInvoice(invoice).catch(() => {});
    },
    saveMany: async (invoices: Invoice[]): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      await this.saveFullState({ ...state, invoices });
      invoices.forEach((inv) => firestoreSyncService.syncInvoice(inv).catch(() => {}));
    },
    delete: async (id: string): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const updated = state.invoices.filter((i) => i.id !== id);
      await this.saveFullState({ ...state, invoices: updated });
      firestoreSyncService.deleteInvoice(id).catch(() => {});
    },
  };

  // 5. QUOTES REPOSITORY
  readonly quotes: IQuoteRepository = {
    getAll: async (): Promise<Quote[]> => {
      const state = await this.loadFullState();
      return state?.quotes || [];
    },
    getById: async (id: string): Promise<Quote | null> => {
      const quotes = await this.quotes.getAll();
      return quotes.find((q) => q.id === id) || null;
    },
    save: async (quote: Quote): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const index = state.quotes.findIndex((q) => q.id === quote.id);
      let updatedQuotes = [...state.quotes];
      if (index >= 0) {
        updatedQuotes[index] = quote;
      } else {
        updatedQuotes = [quote, ...updatedQuotes];
      }
      await this.saveFullState({ ...state, quotes: updatedQuotes });
      firestoreSyncService.syncQuote(quote).catch(() => {});
    },
    delete: async (id: string): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const updated = state.quotes.filter((q) => q.id !== id);
      await this.saveFullState({ ...state, quotes: updated });
      firestoreSyncService.deleteQuote(id).catch(() => {});
    },
  };

  // 6. PAYMENTS REPOSITORY
  readonly payments: IPaymentRepository = {
    getAll: async (): Promise<PaymentRecord[]> => {
      const state = await this.loadFullState();
      return state?.payments || [];
    },
    add: async (payment: PaymentRecord): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      await this.saveFullState({
        ...state,
        payments: [payment, ...state.payments],
      });
      firestoreSyncService.syncPayment(payment).catch(() => {});
    },
    addMany: async (payments: PaymentRecord[]): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      await this.saveFullState({
        ...state,
        payments: [...payments, ...state.payments],
      });
      payments.forEach((p) => firestoreSyncService.syncPayment(p).catch(() => {}));
    },
  };

  // 7. SETTINGS REPOSITORY
  readonly settings: ISettingsRepository = {
    get: async (): Promise<CompanySettings> => {
      const state = await this.loadFullState();
      if (state?.settings) return state.settings;
      throw new Error('Settings not initialized');
    },
    save: async (newSettings: CompanySettings): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      await this.saveFullState({ ...state, settings: newSettings });
      firestoreSyncService.syncSettings(newSettings).catch(() => {});
    },
  };

  // 8. CATEGORIES REPOSITORY
  readonly categories: ICategoryRepository = {
    getAll: async (): Promise<Category[]> => {
      const state = await this.loadFullState();
      return state?.categories || [];
    },
    save: async (category: Category): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const index = state.categories.findIndex((c) => c.id === category.id);
      let updatedCategories = [...state.categories];
      if (index >= 0) {
        updatedCategories[index] = category;
      } else {
        updatedCategories = [...updatedCategories, category];
      }
      await this.saveFullState({ ...state, categories: updatedCategories });
      firestoreSyncService.syncCategory(category).catch(() => {});
    },
    delete: async (id: string): Promise<void> => {
      const state = await this.loadFullState();
      if (!state) return;
      const updated = state.categories.filter((c) => c.id !== id);
      await this.saveFullState({ ...state, categories: updated });
      firestoreSyncService.deleteCategory(id).catch(() => {});
    },
  };

  // Full state snapshot load & save (relying on storageService)
  async loadFullState(): Promise<AppState | null> {
    return await storageService.loadState();
  }

  async saveFullState(state: AppState): Promise<boolean> {
    const success = await storageService.saveState(state);
    return success;
  }

  setUserScope(userId: string | null): void {
    storageService.setUserScope(userId);
  }

  async clearAccountCache(userId?: string | null): Promise<void> {
    await storageService.clearAccountCache(userId);
  }

  async clearAll(): Promise<void> {
    await storageService.clearAll();
  }

  exportData(state: AppState): void {
    storageService.exportData(state);
  }

  getSyncStatus(): SyncStatus {
    return firestoreSyncService.getStatus();
  }

  subscribeToSyncStatus(callback: (status: SyncStatus) => void): () => void {
    return firestoreSyncService.subscribeStatus(callback);
  }

  async triggerSync(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }
}
