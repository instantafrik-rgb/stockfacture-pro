/**
 * StockFacture Pro - Central Application Context & State Management
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AppState,
  CompanySettings,
  Product,
  Category,
  Client,
  Invoice,
  InvoiceItem,
  PaymentRecord,
  StockMovement,
  Quote,
  CartItem,
  PaymentMethod,
  StockMovementReason,
  RestockRequest,
  RestockRequestStatus,
  ReturnActionType,
  ReturnItem,
  ExchangeProduct,
  SaleReturn,
} from '../types';
import { dataRepository, firestoreSyncService } from '../services/data';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { defaultSettings, getDemoState, initialEmptyState } from '../data/demoData';
import { isUserOnboarded, markUserOnboardedLocally } from '../utils/onboardingUtils';
import { isDemoSettings, cleanCompanySettings, hasCustomUserSettings } from '../utils/settingsUtils';
import { purgeDemoFromState } from '../utils/demoFilter';
import {
  calculateLineTotal,
  calculateSubtotal,
  calculateDiscountTotal,
  calculateTax,
  calculateInvoiceTotal,
  determineInvoiceStatus,
  roundCurrency,
  computeInvoiceSummary,
} from '../utils/calculations';
import { generateDocumentNumber, getTodayDateString, createPaymentDateString } from '../utils/formatters';

export type ActiveView =
  | 'dashboard'
  | 'sales'
  | 'products'
  | 'stock'
  | 'clients'
  | 'invoices'
  | 'receivables'
  | 'quotes'
  | 'reports'
  | 'settings'
  | 'manual_invoice';

interface AppContextType {
  state: AppState;
  isLoading: boolean;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  navigate: (view: ActiveView, itemId?: string | null) => void;
  goBack: () => void;

  // Company Settings
  updateSettings: (newSettings: Partial<CompanySettings>) => Promise<void>;

  // Products
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<boolean>;

  // Categories
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;

  // Stock
  recordStockMovement: (params: {
    productId: string;
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason: StockMovementReason;
    note?: string;
    referenceId?: string;
    userName?: string;
    date?: string;
  }) => Promise<{ success: boolean; error?: string }>;

  // Clients
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Client>;
  updateClient: (id: string, client: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<boolean>;

  // Sales & Invoices
  createSale: (params: {
    items: CartItem[];
    client?: {
      id?: string;
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      taxId?: string;
      saveToDb?: boolean;
    };
    paymentMethod: PaymentMethod;
    amountPaid: number;
    notes?: string;
    dueDate?: string;
    isDraft?: boolean;
    customInvoiceNumber?: string;
    date?: string;
  }) => Promise<{ success: boolean; invoice?: Invoice; error?: string }>;

  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
  cancelInvoice: (id: string) => Promise<{ success: boolean; error?: string }>;
  validateDraftInvoice: (params: {
    invoiceId: string;
    paymentMethod: PaymentMethod;
    amountPaid: number;
  }) => Promise<{ success: boolean; invoice?: Invoice; error?: string }>;
  addPaymentToInvoice: (params: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    note?: string;
    date?: string;
  }) => Promise<{ success: boolean; payment?: PaymentRecord; error?: string }>;

  // Global Debt Settlement (FIFO)
  payClientReceivablesGlobally: (params: {
    clientId?: string;
    clientName: string;
    amount: number;
    method: PaymentMethod;
    date?: string;
    note?: string;
  }) => Promise<{
    success: boolean;
    totalApplied: number;
    affectedInvoices: { invoice: Invoice; amountApplied: number }[];
    paymentRecords: PaymentRecord[];
    error?: string;
  }>;

  // Clients à relancer (Restock Requests)
  addRestockRequest: (
    params: Omit<RestockRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ) => Promise<RestockRequest>;
  updateRestockRequestStatus: (
    id: string,
    status: RestockRequestStatus,
    note?: string
  ) => Promise<void>;
  deleteRestockRequest: (id: string) => Promise<void>;

  // Quotes
  createQuote: (params: {
    client: {
      id?: string;
      name: string;
      phone?: string;
      address?: string;
    };
    items: CartItem[];
    expiryDate: string;
    notes?: string;
  }) => Promise<{ success: boolean; quote?: Quote; error?: string }>;
  updateQuote: (id: string, quote: Partial<Quote>) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;
  convertQuoteToInvoice: (quoteId: string) => Promise<{ success: boolean; invoice?: Invoice; error?: string }>;

  // Retours / Avoirs / Échanges
  processSaleReturn: (params: {
    invoiceId: string;
    items: {
      invoiceItemId: string;
      productId?: string;
      designation: string;
      quantity: number;
      unitPrice: number;
      total: number;
      restock: boolean;
      condition?: 'resellable' | 'defective';
    }[];
    actionType: ReturnActionType;
    refundMethod?: PaymentMethod;
    exchangeProduct?: {
      productId: string;
      designation: string;
      quantity: number;
      unitPrice: number;
      total: number;
    };
    reason: string;
    date?: string;
    userName?: string;
    notes?: string;
  }) => Promise<{ success: boolean; saleReturn?: SaleReturn; error?: string }>;

  // PIN & Security
  unlockWithPin: (pin: string) => boolean;
  setAppPin: (pin: string) => Promise<void>;
  removeAppPin: () => Promise<void>;
  lockApp: () => void;

  // Demo & Reset
  loadDemoData: () => Promise<void>;
  clearDemoData: () => Promise<void>;
  resetAllData: () => Promise<void>;
  resetStateOnLogout: () => Promise<void>;
  reloadStateForUser: (userId: string | null) => Promise<void>;
  completeOnboarding: (customSettings?: { name: string; currency: string }) => Promise<void>;
  importBackup: (backupState: AppState) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialEmptyState);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [navHistory, setNavHistory] = useState<Array<{ view: ActiveView; itemId: string | null }>>([
    { view: 'dashboard', itemId: null },
  ]);

  // Load state on mount
  useEffect(() => {
    async function init() {
      try {
        const loaded = await dataRepository.loadFullState();
        if (loaded) {
          // Strictly ensure light theme is the default experience
          if (!loaded.settings?.theme || loaded.settings.theme === 'dark') {
            loaded.settings = { ...loaded.settings, theme: 'light' };
          }
          // Clean settings from any demo residue
          const cleanedSettings = cleanCompanySettings(loaded.settings);

          // If PIN is enabled, lock upon startup
          const shouldLock = Boolean(cleanedSettings.pinEnabled && cleanedSettings.pinCode);
          const currentUserUid = auth.currentUser?.uid;
          const hasOnboardingDone =
            isUserOnboarded(currentUserUid, loaded) ||
            Boolean(loaded.hasCompletedOnboarding) ||
            Boolean(cleanedSettings.hasCompletedOnboarding);

          if (hasOnboardingDone) {
            markUserOnboardedLocally(currentUserUid);
          }

          const initializedState: AppState = {
            ...loaded,
            restockRequests: Array.isArray(loaded.restockRequests) ? loaded.restockRequests : [],
            returns: Array.isArray(loaded.returns) ? loaded.returns : [],
            isLocked: shouldLock,
            hasCompletedOnboarding: hasOnboardingDone,
            settings: {
              ...cleanedSettings,
              hasCompletedOnboarding: hasOnboardingDone,
            },
          };

          stateRef.current = initializedState;
          setState(initializedState);
        } else {
          // Pristine initial state — NEVER auto-inject demo data
          stateRef.current = initialEmptyState;
          setState(initialEmptyState);
        }
      } catch (e) {
        console.error('Initialization error:', e);
        stateRef.current = initialEmptyState;
        setState(initialEmptyState);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Listen for real-time remote updates from Firestore and update local state & offline cache
  useEffect(() => {
    firestoreSyncService.registerRemoteUpdateListener((updater) => {
      setState((prev) => {
        const next = updater(prev);
        const currentUserUid = auth.currentUser?.uid;
        // Ensure hasCompletedOnboarding is never accidentally flipped back to false if the user has completed it or has business data
        const isCompleted =
          prev.hasCompletedOnboarding === true ||
          next.hasCompletedOnboarding === true ||
          next.settings?.hasCompletedOnboarding === true ||
          isUserOnboarded(currentUserUid, next) ||
          isUserOnboarded(currentUserUid, prev);

        if (isCompleted) {
          markUserOnboardedLocally(currentUserUid);
        }

        const cleanSettings = cleanCompanySettings(next.settings, prev.settings);
        const resolvedNext: AppState = {
          ...next,
          hasCompletedOnboarding: isCompleted,
          settings: {
            ...cleanSettings,
            hasCompletedOnboarding: isCompleted ? true : cleanSettings.hasCompletedOnboarding,
          },
        };

        stateRef.current = resolvedNext;
        // Persist to local cache so offline mode is immediately ready
        dataRepository.saveFullState(resolvedNext);
        return resolvedNext;
      });
    });
  }, []);

  // Sync state to local storage and Firestore Cloud
  const persistState = useCallback(async (newState: AppState) => {
    const prevState = stateRef.current;
    stateRef.current = newState;
    setState(newState);
    await dataRepository.saveFullState(newState);

    // Asynchronously synchronize state delta to Firestore Cloud
    firestoreSyncService.syncStateChanges(prevState, newState).catch((err) => {
      console.warn('Firestore cloud sync error:', err);
    });
  }, []);

  // Navigation helpers
  const navigate = useCallback((view: ActiveView, itemId: string | null = null) => {
    setSelectedItemId(itemId);
    setActiveView(view);
    setNavHistory((prev) => [...prev, { view, itemId }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goBack = useCallback(() => {
    if (selectedItemId) {
      setSelectedItemId(null);
      return;
    }
    setNavHistory((prev) => {
      if (prev.length <= 1) {
        setActiveView('dashboard');
        setSelectedItemId(null);
        return [{ view: 'dashboard', itemId: null }];
      }
      const newStack = [...prev];
      newStack.pop(); // Remove current
      const last = newStack[newStack.length - 1];
      setActiveView(last.view);
      setSelectedItemId(last.itemId);
      return newStack;
    });
  }, [selectedItemId]);

  // Apply dark mode class to root HTML only when explicitly selected
  useEffect(() => {
    const applyTheme = () => {
      const mode = state.settings.theme;
      let isDark = false;
      if (mode === 'dark') {
        isDark = true;
      } else if (mode === 'system') {
        isDark = Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      } else {
        isDark = false; // default is light
      }

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    if (state.settings.theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [state.settings.theme]);

  // Settings
  const updateSettings = useCallback(
    async (newSettings: Partial<CompanySettings>) => {
      const nowIso = new Date().toISOString();
      const updatedSettings = cleanCompanySettings({
        ...state.settings,
        ...newSettings,
        updatedAt: nowIso,
      });
      const updated: AppState = {
        ...state,
        settings: updatedSettings,
      };
      stateRef.current = updated;
      setState(updated);
      await dataRepository.saveFullState(updated);
      await firestoreSyncService.syncSettings(updatedSettings).catch((err) => {
        console.warn('Failed to sync updated settings to Firestore:', err);
      });
    },
    [state]
  );

  // Products CRUD
  const addProduct = useCallback(
    async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
      const newProduct: Product = {
        ...productData,
        id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedProducts = [newProduct, ...state.products];
      let updatedMovements = state.movements;

      // If initial stock > 0, log an initial stock movement
      if (newProduct.stockQuantity > 0) {
        const initMov: StockMovement = {
          id: `mov-${Date.now()}`,
          productId: newProduct.id,
          productName: newProduct.name,
          type: 'in',
          quantity: newProduct.stockQuantity,
          previousStock: 0,
          newStock: newProduct.stockQuantity,
          reason: 'purchase',
          note: 'Stock initial à la création du produit',
          createdAt: new Date().toISOString(),
        };
        updatedMovements = [initMov, ...state.movements];
      }

      await persistState({
        ...state,
        products: updatedProducts,
        movements: updatedMovements,
      });

      firestoreSyncService.syncProduct(newProduct).catch(() => {});
      return newProduct;
    },
    [state, persistState]
  );

  const updateProduct = useCallback(
    async (id: string, productData: Partial<Product>) => {
      let updatedProduct: Product | undefined;
      const updatedProducts = state.products.map((p) => {
        if (p.id === id) {
          updatedProduct = { ...p, ...productData, updatedAt: new Date().toISOString() };
          return updatedProduct;
        }
        return p;
      });
      await persistState({ ...state, products: updatedProducts });
      if (updatedProduct) {
        firestoreSyncService.syncProduct(updatedProduct).catch(() => {});
      }
    },
    [state, persistState]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const updatedProducts = state.products.filter((p) => p.id !== id);
      await persistState({ ...state, products: updatedProducts });
      firestoreSyncService.deleteProduct(id).catch(() => {});
      return true;
    },
    [state, persistState]
  );

  // Categories
  const addCategory = useCallback(
    async (catData: Omit<Category, 'id'>) => {
      const newCat: Category = {
        ...catData,
        id: `cat-${Date.now()}`,
      };
      await persistState({
        ...state,
        categories: [...state.categories, newCat],
      });
      firestoreSyncService.syncCategory(newCat).catch(() => {});
      return newCat;
    },
    [state, persistState]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      await persistState({
        ...state,
        categories: state.categories.filter((c) => c.id !== id),
      });
      firestoreSyncService.deleteCategory(id).catch(() => {});
    },
    [state, persistState]
  );

  // Stock Movements
  const recordStockMovement = useCallback(
    async ({
      productId,
      type,
      quantity,
      reason,
      note,
      referenceId,
      userName,
      date,
    }: {
      productId: string;
      type: 'in' | 'out' | 'adjustment';
      quantity: number;
      reason: StockMovementReason;
      note?: string;
      referenceId?: string;
      userName?: string;
      date?: string;
    }) => {
      const product = state.products.find((p) => p.id === productId);
      if (!product) {
        return { success: false, error: 'Produit introuvable' };
      }

      const prevStock = product.stockQuantity;
      let newStock = prevStock;

      if (type === 'in') {
        newStock = prevStock + Math.max(0, quantity);
      } else if (type === 'out') {
        const moveQty = Math.max(0, quantity);
        if (!state.settings.allowNegativeStock && prevStock < moveQty) {
          return {
            success: false,
            error: `Stock insuffisant (${prevStock} disponible). Le stock négatif est désactivé dans les paramètres.`,
          };
        }
        newStock = prevStock - moveQty;
      } else if (type === 'adjustment') {
        newStock = quantity;
      }

      const movementDate = date
        ? (date.includes('T') ? date : new Date(`${date}T12:00:00Z`).toISOString())
        : new Date().toISOString();

      const user = auth.currentUser;
      const movementUser = userName?.trim() || user?.displayName || user?.email || (state.settings.name ? state.settings.name : 'Responsable Stock');

      const movement: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        productId,
        productName: product.name,
        type,
        quantity: Math.abs(type === 'adjustment' ? newStock - prevStock : quantity),
        previousStock: prevStock,
        newStock,
        reason,
        note,
        referenceId,
        userName: movementUser,
        createdAt: movementDate,
      };

      // Perform atomic Firestore transaction if connected to Google Cloud
      if (user && typeof navigator !== 'undefined' && navigator.onLine) {
        const transRes = await firestoreSyncService.commitStockMovementTransaction({
          userId: user.uid,
          movement,
          type,
          quantity,
          allowNegativeStock: Boolean(state.settings.allowNegativeStock),
        });

        if (!transRes.success) {
          return { success: false, error: transRes.error };
        }
        if (transRes.newStock !== undefined) {
          newStock = transRes.newStock;
          movement.newStock = newStock;
        }
      }

      const updatedProducts = state.products.map((p) =>
        p.id === productId ? { ...p, stockQuantity: newStock, updatedAt: new Date().toISOString() } : p
      );

      // If stock replenished (type in), update pending restock requests for this product to 'available'
      let updatedRestockRequests = state.restockRequests;
      if (type === 'in' && newStock > 0 && state.restockRequests && state.restockRequests.length > 0) {
        const pendingForProd = state.restockRequests.filter((r) => r.productId === productId && r.status === 'pending');
        if (pendingForProd.length > 0) {
          updatedRestockRequests = state.restockRequests.map((r) =>
            r.productId === productId && r.status === 'pending'
              ? { ...r, status: 'available' as const, contactedAt: undefined, updatedAt: new Date().toISOString() }
              : r
          );
          // Sync updated restock requests
          pendingForProd.forEach((r) => {
            firestoreSyncService.syncRestockRequest({
              ...r,
              status: 'available',
              updatedAt: new Date().toISOString(),
            }).catch(() => {});
          });
        }
      }

      await persistState({
        ...state,
        products: updatedProducts,
        movements: [movement, ...state.movements],
        restockRequests: updatedRestockRequests,
      });

      return { success: true };
    },
    [state, persistState]
  );

  // Clients
  const addClient = useCallback(
    async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
      // Prevent duplicate clients by name or phone
      const existing = state.clients.find(
        (c) =>
          c.name.trim().toLowerCase() === clientData.name.trim().toLowerCase() ||
          (clientData.phone && c.phone && c.phone.trim() === clientData.phone.trim())
      );
      if (existing) {
        return existing;
      }

      const newClient: Client = {
        ...clientData,
        id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await persistState({
        ...state,
        clients: [newClient, ...state.clients],
      });
      // Direct write ensures instant cloud sync
      firestoreSyncService.syncClient(newClient).catch(() => {});
      return newClient;
    },
    [state, persistState]
  );

  const updateClient = useCallback(
    async (id: string, clientData: Partial<Client>) => {
      let updatedClient: Client | undefined;
      const updatedClients = state.clients.map((c) => {
        if (c.id === id) {
          updatedClient = { ...c, ...clientData, updatedAt: new Date().toISOString() };
          return updatedClient;
        }
        return c;
      });
      await persistState({ ...state, clients: updatedClients });
      if (updatedClient) {
        firestoreSyncService.syncClient(updatedClient).catch(() => {});
      }
    },
    [state, persistState]
  );

  const deleteClient = useCallback(
    async (id: string) => {
      await persistState({
        ...state,
        clients: state.clients.filter((c) => c.id !== id),
      });
      firestoreSyncService.deleteClient(id).catch(() => {});
      return true;
    },
    [state, persistState]
  );

  // Fast Sale / Create Invoice Flow
  const createSale = useCallback(
    async ({
      items,
      client,
      paymentMethod,
      amountPaid,
      notes,
      dueDate,
      isDraft = false,
      customInvoiceNumber,
      date,
    }: {
      items: CartItem[];
      client?: {
        id?: string;
        name?: string;
        phone?: string;
        email?: string;
        address?: string;
        taxId?: string;
        saveToDb?: boolean;
      };
      paymentMethod: PaymentMethod;
      amountPaid: number;
      notes?: string;
      dueDate?: string;
      isDraft?: boolean;
      customInvoiceNumber?: string;
      date?: string;
    }) => {
      if (!items || items.length === 0) {
        return { success: false, error: 'Le panier est vide. Ajoutez au moins un article.' };
      }

      // Check stock sufficiency for catalog products if negative stock is disallowed (only for non-drafts)
      if (!isDraft && !state.settings.allowNegativeStock) {
        for (const item of items) {
          if (!item.isFreeLine && item.productId) {
            const product = state.products.find((p) => p.id === item.productId);
            if (product && product.stockQuantity < item.quantity) {
              return {
                success: false,
                error: `Stock insuffisant pour "${item.designation}". Disponible: ${product.stockQuantity}, Demandé: ${item.quantity}.`,
              };
            }
          }
        }
      }

      // Handle client: default is 'Client comptant'
      let clientId = client?.id;
      let newClients = [...state.clients];
      const clientName = client?.name?.trim() || 'Client comptant';

      // Save to database ONLY if explicitly requested and client has a name
      if (!clientId && client?.saveToDb && client?.name?.trim()) {
        const existing = state.clients.find(
          (c) => c.name.toLowerCase() === client.name?.toLowerCase().trim()
        );
        if (existing) {
          clientId = existing.id;
        } else {
          const createdClient: Client = {
            id: `cli-${Date.now()}`,
            name: client.name.trim(),
            phone: client.phone?.trim(),
            email: client.email?.trim(),
            address: client.address?.trim(),
            taxId: client.taxId?.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          newClients = [createdClient, ...newClients];
          clientId = createdClient.id;
        }
      }

      // Financial calculations via central function
      const invoiceItems: InvoiceItem[] = items.map((it) => {
        const lineTotal = calculateLineTotal(it.quantity, it.unitPrice, it.discountPercent);
        return {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: it.productId,
          isFreeLine: it.isFreeLine,
          designation: it.designation,
          reference: it.reference,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          purchasePrice: it.purchasePrice,
          discountPercent: it.discountPercent,
          total: lineTotal,
        };
      });

      const summary = computeInvoiceSummary(
        invoiceItems,
        state.settings.vatEnabled,
        state.settings.vatRate,
        isDraft ? 0 : amountPaid,
        Boolean(isDraft)
      );

      // Generate or use custom invoice number
      const invoiceNumber =
        customInvoiceNumber?.trim() ||
        generateDocumentNumber(state.settings.invoicePrefix, state.settings.nextInvoiceNumber);

      const invoiceId = `inv-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const todayDate = getTodayDateString();
      const invoiceDate = date?.trim() || todayDate;

      const newInvoice: Invoice = {
        id: invoiceId,
        number: invoiceNumber,
        date: invoiceDate,
        dueDate: dueDate || invoiceDate,
        clientId,
        clientName,
        clientPhone: client?.phone?.trim(),
        clientAddress: client?.address?.trim(),
        clientTaxId: client?.taxId?.trim(),
        items: invoiceItems,
        subtotal: summary.subtotal,
        discountTotal: summary.discountTotal,
        vatRate: state.settings.vatEnabled ? state.settings.vatRate : 0,
        vatAmount: summary.vatAmount,
        total: summary.total,
        amountPaid: isDraft ? 0 : summary.amountPaid,
        remainingAmount: summary.remainingAmount,
        status: summary.status,
        notes,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Record payment if amountPaid > 0 and NOT draft
      const newPayments = [...state.payments];
      if (!isDraft && summary.amountPaid > 0) {
        const paymentRecord: PaymentRecord = {
          id: `pay-${Date.now()}`,
          invoiceId,
          invoiceNumber,
          amount: summary.amountPaid,
          date: date ? createPaymentDateString(date) : nowIso,
          method: paymentMethod,
          note: summary.amountPaid < summary.total ? 'Acompte vente' : 'Règlement total vente',
          createdAt: nowIso,
        };
        newPayments.unshift(paymentRecord);
      }

      // Deduct stock for catalog products and create stock movements (ONLY for non-drafts)
      let updatedProducts = [...state.products];
      let newMovements = [...state.movements];

      if (!isDraft) {
        for (const it of items) {
          if (!it.isFreeLine && it.productId) {
            const pIndex = updatedProducts.findIndex((p) => p.id === it.productId);
            if (pIndex !== -1) {
              const currentP = updatedProducts[pIndex];
              const prevStock = currentP.stockQuantity;
              const newStock = prevStock - it.quantity;

              updatedProducts[pIndex] = {
                ...currentP,
                stockQuantity: newStock,
                updatedAt: nowIso,
              };

              const movement: StockMovement = {
                id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                productId: currentP.id,
                productName: currentP.name,
                type: 'out',
                quantity: it.quantity,
                previousStock: prevStock,
                newStock,
                reason: 'sale',
                referenceId: invoiceNumber,
                note: `Vente ${invoiceNumber} - ${newInvoice.clientName}`,
                createdAt: nowIso,
              };
              newMovements.unshift(movement);
            }
          }
        }
      }

      // If connected to Google Cloud, execute atomic Firestore transaction for stock & sale
      const user = auth.currentUser;
      if (user && typeof navigator !== 'undefined' && navigator.onLine && !isDraft) {
        const transRes = await firestoreSyncService.commitSaleStockTransaction({
          userId: user.uid,
          invoice: newInvoice,
          payment: newPayments.length > 0 ? newPayments[0] : undefined,
          items: items.map((it) => ({
            productId: it.productId,
            designation: it.designation,
            quantity: it.quantity,
            isFreeLine: it.isFreeLine,
          })),
          movements: newMovements.slice(0, items.filter((it) => !it.isFreeLine && it.productId).length),
          allowNegativeStock: Boolean(state.settings.allowNegativeStock),
          nextInvoiceNumber: state.settings.nextInvoiceNumber + 1,
        });

        if (!transRes.success) {
          return { success: false, error: transRes.error };
        }

        // Apply true cloud updated stocks to local state
        if (transRes.updatedStocks) {
          for (const [prodId, confirmedStock] of Object.entries(transRes.updatedStocks)) {
            const idx = updatedProducts.findIndex((p) => p.id === prodId);
            if (idx !== -1) {
              updatedProducts[idx] = { ...updatedProducts[idx], stockQuantity: confirmedStock };
            }
          }
        }
      }

      // Save everything atomically
      await persistState({
        ...state,
        settings: {
          ...state.settings,
          nextInvoiceNumber: state.settings.nextInvoiceNumber + 1,
        },
        invoices: [newInvoice, ...state.invoices],
        payments: newPayments,
        products: updatedProducts,
        movements: newMovements,
        clients: newClients,
      });

      // Direct write guarantees for client
      if (client?.saveToDb && clientId) {
        const c = newClients.find((cl) => cl.id === clientId);
        if (c) firestoreSyncService.syncClient(c).catch(() => {});
      }

      return { success: true, invoice: newInvoice };
    },
    [state, persistState]
  );

  const updateInvoice = useCallback(
    async (id: string, invoiceData: Partial<Invoice>) => {
      let updatedInv: Invoice | undefined;
      const updatedInvoices = state.invoices.map((inv) => {
        if (inv.id === id) {
          updatedInv = { ...inv, ...invoiceData, updatedAt: new Date().toISOString() };
          return updatedInv;
        }
        return inv;
      });
      await persistState({ ...state, invoices: updatedInvoices });
      if (updatedInv) {
        firestoreSyncService.syncInvoice(updatedInv).catch(() => {});
      }
    },
    [state, persistState]
  );

  // Validate draft invoice: moves status to paid/partial/unpaid and decrements stock
  const validateDraftInvoice = useCallback(
    async ({
      invoiceId,
      paymentMethod,
      amountPaid,
    }: {
      invoiceId: string;
      paymentMethod: PaymentMethod;
      amountPaid: number;
    }) => {
      const invoice = state.invoices.find((i) => i.id === invoiceId);
      if (!invoice) return { success: false, error: 'Facture introuvable' };
      if (invoice.status !== 'draft') return { success: false, error: 'La facture n’est pas un brouillon' };

      // Stock sufficiency check
      if (!state.settings.allowNegativeStock) {
        for (const item of invoice.items) {
          if (!item.isFreeLine && item.productId) {
            const product = state.products.find((p) => p.id === item.productId);
            if (product && product.stockQuantity < item.quantity) {
              return {
                success: false,
                error: `Stock insuffisant pour "${item.designation}". Disponible: ${product.stockQuantity}, Demandé: ${item.quantity}.`,
              };
            }
          }
        }
      }

      const nowIso = new Date().toISOString();
      const safeAmountPaid = Math.min(invoice.total, Math.max(0, amountPaid || 0));
      const remainingAmount = roundCurrency(invoice.total - safeAmountPaid);
      const status = determineInvoiceStatus(invoice.total, safeAmountPaid);

      const newPayments = [...state.payments];
      if (safeAmountPaid > 0) {
        const paymentRecord: PaymentRecord = {
          id: `pay-${Date.now()}`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          amount: safeAmountPaid,
          date: nowIso,
          method: paymentMethod,
          note: safeAmountPaid < invoice.total ? 'Acompte validation' : 'Règlement total vente',
          createdAt: nowIso,
        };
        newPayments.unshift(paymentRecord);
      }

      // Deduct stock for real items
      let updatedProducts = [...state.products];
      let newMovements = [...state.movements];

      for (const it of invoice.items) {
        if (!it.isFreeLine && it.productId) {
          const pIndex = updatedProducts.findIndex((p) => p.id === it.productId);
          if (pIndex !== -1) {
            const currentP = updatedProducts[pIndex];
            const prevStock = currentP.stockQuantity;
            const newStock = prevStock - it.quantity;

            updatedProducts[pIndex] = {
              ...currentP,
              stockQuantity: newStock,
              updatedAt: nowIso,
            };

            const movement: StockMovement = {
              id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              productId: currentP.id,
              productName: currentP.name,
              type: 'out',
              quantity: it.quantity,
              previousStock: prevStock,
              newStock,
              reason: 'sale',
              referenceId: invoice.number,
              note: `Validation vente ${invoice.number} - ${invoice.clientName}`,
              createdAt: nowIso,
            };
            newMovements.unshift(movement);
          }
        }
      }

      const updatedInvoice: Invoice = {
        ...invoice,
        amountPaid: safeAmountPaid,
        remainingAmount,
        status,
        updatedAt: nowIso,
      };

      // Perform atomic Firestore transaction if connected to Google Cloud
      const user = auth.currentUser;
      if (user && typeof navigator !== 'undefined' && navigator.onLine) {
        const transRes = await firestoreSyncService.commitSaleStockTransaction({
          userId: user.uid,
          invoice: updatedInvoice,
          payment: newPayments.length > 0 ? newPayments[0] : undefined,
          items: invoice.items.map((it) => ({
            productId: it.productId,
            designation: it.designation,
            quantity: it.quantity,
            isFreeLine: it.isFreeLine,
          })),
          movements: newMovements.slice(0, invoice.items.filter((it) => !it.isFreeLine && it.productId).length),
          allowNegativeStock: Boolean(state.settings.allowNegativeStock),
        });

        if (!transRes.success) {
          return { success: false, error: transRes.error };
        }

        if (transRes.updatedStocks) {
          for (const [prodId, confirmedStock] of Object.entries(transRes.updatedStocks)) {
            const idx = updatedProducts.findIndex((p) => p.id === prodId);
            if (idx !== -1) {
              updatedProducts[idx] = { ...updatedProducts[idx], stockQuantity: confirmedStock };
            }
          }
        }
      }

      const updatedInvoices = state.invoices.map((inv) =>
        inv.id === invoiceId ? updatedInvoice : inv
      );

      await persistState({
        ...state,
        invoices: updatedInvoices,
        payments: newPayments,
        products: updatedProducts,
        movements: newMovements,
      });

      return { success: true, invoice: updatedInvoice };
    },
    [state, persistState]
  );

  // Cancel invoice: restores stock items if not draft!
  const cancelInvoice = useCallback(
    async (id: string) => {
      const invoice = state.invoices.find((i) => i.id === id);
      if (!invoice) return { success: false, error: 'Facture introuvable' };
      if (invoice.status === 'cancelled') return { success: false, error: 'Facture déjà annulée' };

      const nowIso = new Date().toISOString();
      let updatedProducts = [...state.products];
      let newMovements = [...state.movements];

      // Restore stock for catalog items ONLY if it wasn't a draft
      if (invoice.status !== 'draft') {
        for (const item of invoice.items) {
          if (!item.isFreeLine && item.productId) {
            const pIndex = updatedProducts.findIndex((p) => p.id === item.productId);
            if (pIndex !== -1) {
              const currentP = updatedProducts[pIndex];
              const prevStock = currentP.stockQuantity;
              const newStock = prevStock + item.quantity;

              updatedProducts[pIndex] = {
                ...currentP,
                stockQuantity: newStock,
                updatedAt: nowIso,
              };

              const mov: StockMovement = {
                id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                productId: currentP.id,
                productName: currentP.name,
                type: 'in',
                quantity: item.quantity,
                previousStock: prevStock,
                newStock,
                reason: 'customer_return',
                referenceId: invoice.number,
                note: `Annulation facture ${invoice.number}`,
                createdAt: nowIso,
              };
              newMovements.unshift(mov);
            }
          }
        }
      }

      // Perform atomic Firestore transaction if connected to Google Cloud
      const user = auth.currentUser;
      if (user && typeof navigator !== 'undefined' && navigator.onLine && invoice.status !== 'draft') {
        const cancelRes = await firestoreSyncService.commitCancelInvoiceTransaction({
          userId: user.uid,
          invoiceId: id,
          itemsToRestore: invoice.items
            .filter((it) => !it.isFreeLine && it.productId)
            .map((it) => ({ productId: it.productId!, quantity: it.quantity })),
          movements: newMovements.slice(0, invoice.items.filter((it) => !it.isFreeLine && it.productId).length),
        });

        if (!cancelRes.success) {
          return { success: false, error: cancelRes.error };
        }
      }

      const updatedInvoices = state.invoices.map((i) =>
        i.id === id ? { ...i, status: 'cancelled' as const, updatedAt: nowIso } : i
      );

      await persistState({
        ...state,
        invoices: updatedInvoices,
        products: updatedProducts,
        movements: newMovements,
      });

      return { success: true };
    },
    [state, persistState]
  );

  // Add partial or full payment to an invoice
  const addPaymentToInvoice = useCallback(
    async ({
      invoiceId,
      amount,
      method,
      note,
      date,
    }: {
      invoiceId: string;
      amount: number;
      method: PaymentMethod;
      note?: string;
      date?: string;
    }) => {
      const invoice = state.invoices.find((i) => i.id === invoiceId);
      if (!invoice) return { success: false, error: 'Facture introuvable' };
      if (invoice.status === 'cancelled') return { success: false, error: 'Impossible de payer une facture annulée' };
      if (invoice.remainingAmount <= 0) return { success: false, error: 'Cette facture est déjà soldée' };

      const safeAmount = roundCurrency(Math.max(0, amount));
      if (safeAmount <= 0) return { success: false, error: 'Montant de paiement invalide' };

      const nowIso = new Date().toISOString();
      const paymentDate = createPaymentDateString(date);

      const newPayment: PaymentRecord = {
        id: `pay-${Date.now()}`,
        invoiceId,
        invoiceNumber: invoice.number,
        amount: safeAmount,
        date: paymentDate,
        method,
        note: note?.trim(),
        createdAt: nowIso,
      };

      const newAmountPaid = roundCurrency(invoice.amountPaid + safeAmount);
      const newRemaining = Math.max(0, roundCurrency(invoice.total - newAmountPaid));
      const newStatus = determineInvoiceStatus(invoice.total, newAmountPaid);

      const updatedInvoices = state.invoices.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              amountPaid: newAmountPaid,
              remainingAmount: newRemaining,
              status: newStatus,
              updatedAt: nowIso,
            }
          : i
      );

      await persistState({
        ...state,
        payments: [newPayment, ...state.payments],
        invoices: updatedInvoices,
      });

      firestoreSyncService.syncPayment(newPayment).catch(() => {});
      const paidInv = updatedInvoices.find((i) => i.id === invoiceId);
      if (paidInv) firestoreSyncService.syncInvoice(paidInv).catch(() => {});

      return { success: true, payment: newPayment };
    },
    [state, persistState]
  );

  // Global Settlement of Client Receivables (FIFO distribution across oldest invoices first)
  const payClientReceivablesGlobally = useCallback(
    async ({
      clientId,
      clientName,
      amount,
      method,
      date,
      note,
    }: {
      clientId?: string;
      clientName: string;
      amount: number;
      method: PaymentMethod;
      date?: string;
      note?: string;
    }) => {
      const safeAmount = roundCurrency(Math.max(0, amount));
      if (safeAmount <= 0) {
        return {
          success: false,
          totalApplied: 0,
          affectedInvoices: [],
          paymentRecords: [],
          error: 'Montant de règlement invalide.',
        };
      }

      // Filter all unpaid or partial invoices belonging to this client (by ID or matching name)
      const matchingInvoices = state.invoices.filter((inv) => {
        if (inv.status === 'cancelled' || inv.remainingAmount <= 0) return false;
        if (clientId && inv.clientId === clientId) return true;
        return inv.clientName.trim().toLowerCase() === clientName.trim().toLowerCase();
      });

      if (matchingInvoices.length === 0) {
        return {
          success: false,
          totalApplied: 0,
          affectedInvoices: [],
          paymentRecords: [],
          error: 'Aucune facture impayée trouvée pour ce client.',
        };
      }

      // Sort FIFO: oldest invoices first by date / creation
      const sortedInvoices = [...matchingInvoices].sort((a, b) => {
        const dateA = a.date || a.createdAt;
        const dateB = b.date || b.createdAt;
        return dateA.localeCompare(dateB);
      });

      let remainingToApply = safeAmount;
      const affectedInvoices: { invoice: Invoice; amountApplied: number }[] = [];
      const newPaymentRecords: PaymentRecord[] = [];
      const updatedInvoicesMap = new Map<string, Invoice>();
      const nowIso = new Date().toISOString();
      const paymentDate = createPaymentDateString(date);

      for (const inv of sortedInvoices) {
        if (remainingToApply <= 0) break;

        const portion = Math.min(remainingToApply, inv.remainingAmount);
        const portionRounded = roundCurrency(portion);
        if (portionRounded <= 0) continue;

        remainingToApply = roundCurrency(remainingToApply - portionRounded);
        const newAmountPaid = roundCurrency(inv.amountPaid + portionRounded);
        const newRemaining = Math.max(0, roundCurrency(inv.total - newAmountPaid));
        const newStatus = determineInvoiceStatus(inv.total, newAmountPaid);

        const updatedInv: Invoice = {
          ...inv,
          amountPaid: newAmountPaid,
          remainingAmount: newRemaining,
          status: newStatus,
          updatedAt: nowIso,
        };
        updatedInvoicesMap.set(inv.id, updatedInv);
        affectedInvoices.push({ invoice: updatedInv, amountApplied: portionRounded });

        const paymentRecord: PaymentRecord = {
          id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          invoiceId: inv.id,
          invoiceNumber: inv.number,
          amount: portionRounded,
          date: paymentDate,
          method,
          note: note?.trim() || `Règlement global créance (FIFO) - ${clientName}`,
          createdAt: nowIso,
        };
        newPaymentRecords.push(paymentRecord);
      }

      const totalApplied = roundCurrency(safeAmount - remainingToApply);

      const updatedAllInvoices = state.invoices.map((inv) =>
        updatedInvoicesMap.has(inv.id) ? updatedInvoicesMap.get(inv.id)! : inv
      );

      await persistState({
        ...state,
        payments: [...newPaymentRecords, ...state.payments],
        invoices: updatedAllInvoices,
      });

      // Synchronize in background
      for (const p of newPaymentRecords) {
        firestoreSyncService.syncPayment(p).catch(() => {});
      }
      for (const aff of affectedInvoices) {
        firestoreSyncService.syncInvoice(aff.invoice).catch(() => {});
      }

      return {
        success: true,
        totalApplied,
        affectedInvoices,
        paymentRecords: newPaymentRecords,
      };
    },
    [state, persistState]
  );

  // Clients à relancer (Restock Requests)
  const addRestockRequest = useCallback(
    async (params: Omit<RestockRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
      const nowIso = new Date().toISOString();
      const newRequest: RestockRequest = {
        ...params,
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const updated = [newRequest, ...(state.restockRequests || [])];
      await persistState({ ...state, restockRequests: updated });
      firestoreSyncService.syncRestockRequest(newRequest).catch(() => {});
      return newRequest;
    },
    [state, persistState]
  );

  const updateRestockRequestStatus = useCallback(
    async (id: string, status: RestockRequestStatus, note?: string) => {
      const nowIso = new Date().toISOString();
      let updatedReq: RestockRequest | undefined;
      const updatedList: RestockRequest[] = (state.restockRequests || []).map((r) => {
        if (r.id === id) {
          const item: RestockRequest = {
            ...r,
            status,
            note: note !== undefined ? note : r.note,
            contactedAt: status === 'contacted' ? nowIso : r.contactedAt,
            resolvedAt: status === 'available' || status === 'cancelled' ? nowIso : r.resolvedAt,
            updatedAt: nowIso,
          };
          updatedReq = item;
          return item;
        }
        return r;
      });

      await persistState({ ...state, restockRequests: updatedList });
      if (updatedReq) {
        firestoreSyncService.syncRestockRequest(updatedReq).catch(() => {});
      }
    },
    [state, persistState]
  );

  const deleteRestockRequest = useCallback(
    async (id: string) => {
      const updatedList = (state.restockRequests || []).filter((r) => r.id !== id);
      await persistState({ ...state, restockRequests: updatedList });
      firestoreSyncService.deleteRestockRequest(id).catch(() => {});
    },
    [state, persistState]
  );

  // Quotes (Devis)
  const createQuote = useCallback(
    async ({
      client,
      items,
      expiryDate,
      notes,
    }: {
      client: {
        id?: string;
        name: string;
        phone?: string;
        address?: string;
      };
      items: CartItem[];
      expiryDate: string;
      notes?: string;
    }) => {
      if (!items || items.length === 0) {
        return { success: false, error: 'Ajoutez au moins un article au devis.' };
      }

      const quoteItems = items.map((it) => ({
        id: `qitem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: it.productId,
        isFreeLine: it.isFreeLine,
        designation: it.designation,
        reference: it.reference,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
        total: calculateLineTotal(it.quantity, it.unitPrice, it.discountPercent),
      }));

      const subtotal = calculateSubtotal(quoteItems);
      const discountTotal = calculateDiscountTotal(quoteItems);
      const vatAmount = calculateTax(
        subtotal - discountTotal,
        state.settings.vatRate,
        state.settings.vatEnabled
      );
      const total = calculateInvoiceTotal(subtotal, discountTotal, vatAmount);

      const quoteNumber = generateDocumentNumber(
        state.settings.quotePrefix,
        state.settings.nextQuoteNumber
      );

      const nowIso = new Date().toISOString();
      const todayDate = getTodayDateString();

      const newQuote: Quote = {
        id: `quote-${Date.now()}`,
        number: quoteNumber,
        date: todayDate,
        expiryDate: expiryDate || todayDate,
        clientId: client.id,
        clientName: client.name || 'Client de passage',
        clientPhone: client.phone,
        clientAddress: client.address,
        items: quoteItems,
        subtotal,
        discountTotal,
        vatRate: state.settings.vatEnabled ? state.settings.vatRate : 0,
        vatAmount,
        total,
        status: 'draft',
        notes,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await persistState({
        ...state,
        settings: {
          ...state.settings,
          nextQuoteNumber: state.settings.nextQuoteNumber + 1,
        },
        quotes: [newQuote, ...state.quotes],
      });

      firestoreSyncService.syncQuote(newQuote).catch(() => {});

      return { success: true, quote: newQuote };
    },
    [state, persistState]
  );

  const updateQuote = useCallback(
    async (id: string, quoteData: Partial<Quote>) => {
      let updatedQ: Quote | undefined;
      const updatedQuotes = state.quotes.map((q) => {
        if (q.id === id) {
          updatedQ = { ...q, ...quoteData, updatedAt: new Date().toISOString() };
          return updatedQ;
        }
        return q;
      });
      await persistState({ ...state, quotes: updatedQuotes });
      if (updatedQ) {
        firestoreSyncService.syncQuote(updatedQ).catch(() => {});
      }
    },
    [state, persistState]
  );

  const deleteQuote = useCallback(
    async (id: string) => {
      await persistState({
        ...state,
        quotes: state.quotes.filter((q) => q.id !== id),
      });
      firestoreSyncService.deleteQuote(id).catch(() => {});
    },
    [state, persistState]
  );

  // Convert Quote into Invoice
  const convertQuoteToInvoice = useCallback(
    async (quoteId: string) => {
      const quote = state.quotes.find((q) => q.id === quoteId);
      if (!quote) return { success: false, error: 'Devis introuvable' };
      if (quote.status === 'converted') return { success: false, error: 'Ce devis a déjà été converti en facture.' };

      // Map quote items to cart items and execute sale logic (with 0 amount paid initially)
      const cartItems: CartItem[] = quote.items.map((qi) => {
        const prod = qi.productId ? state.products.find((p) => p.id === qi.productId) : undefined;
        return {
          id: qi.id,
          productId: qi.productId,
          isFreeLine: qi.isFreeLine,
          designation: qi.designation,
          reference: qi.reference,
          description: qi.description,
          quantity: qi.quantity,
          unit: qi.unit,
          unitPrice: qi.unitPrice,
          purchasePrice: prod?.purchasePrice,
          discountPercent: qi.discountPercent || 0,
        };
      });

      const res = await createSale({
        items: cartItems,
        client: {
          id: quote.clientId,
          name: quote.clientName,
          phone: quote.clientPhone,
          address: quote.clientAddress,
        },
        paymentMethod: 'cash',
        amountPaid: 0,
        notes: `Converti depuis le devis ${quote.number}. ${quote.notes || ''}`.trim(),
      });

      if (!res.success || !res.invoice) {
        return { success: false, error: res.error || 'Erreur lors de la conversion' };
      }

      // Mark quote as converted and link invoice id
      const updatedQuotes = state.quotes.map((q) =>
        q.id === quoteId
          ? {
              ...q,
              status: 'converted' as const,
              convertedInvoiceId: res.invoice!.id,
              updatedAt: new Date().toISOString(),
            }
          : q
      );

      await persistState({
        ...state,
        quotes: updatedQuotes,
      });

      const convertedQ = updatedQuotes.find((q) => q.id === quoteId);
      if (convertedQ) firestoreSyncService.syncQuote(convertedQ).catch(() => {});

      return { success: true, invoice: res.invoice };
    },
    [state, createSale, persistState]
  );

  // Retours / Avoirs / Échanges
  const processSaleReturn = useCallback(
    async ({
      invoiceId,
      items,
      actionType,
      refundMethod = 'cash',
      exchangeProduct,
      reason,
      date,
      userName,
      notes,
    }: {
      invoiceId: string;
      items: {
        invoiceItemId: string;
        productId?: string;
        designation: string;
        quantity: number;
        unitPrice: number;
        total: number;
        restock: boolean;
        condition?: 'resellable' | 'defective';
      }[];
      actionType: ReturnActionType;
      refundMethod?: PaymentMethod;
      exchangeProduct?: {
        productId: string;
        designation: string;
        quantity: number;
        unitPrice: number;
        total: number;
      };
      reason: string;
      date?: string;
      userName?: string;
      notes?: string;
    }) => {
      const invoice = state.invoices.find((inv) => inv.id === invoiceId);
      if (!invoice) {
        return { success: false, error: 'Facture introuvable.' };
      }

      if (!items || items.length === 0) {
        return { success: false, error: 'Veuillez sélectionner au moins un article à retourner.' };
      }

      const totalReturnedAmount = roundCurrency(items.reduce((s, it) => s + (it.total || 0), 0));
      if (totalReturnedAmount <= 0) {
        return { success: false, error: 'Le montant total retourné doit être supérieur à zéro.' };
      }

      const nowIso = new Date().toISOString();
      const returnDate = date || getTodayDateString();
      const existingReturns = state.returns || [];
      const currentYear = new Date().getFullYear();
      const returnNumber = `RET-${currentYear}-${String(existingReturns.length + 1).padStart(4, '0')}`;

      // Calculate exchange difference if applicable
      let exchangePriceDiff: number | undefined = undefined;
      if (actionType === 'exchange' && exchangeProduct) {
        exchangePriceDiff = roundCurrency(exchangeProduct.total - totalReturnedAmount);
      }

      const newReturn: SaleReturn = {
        id: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        returnNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        items,
        actionType,
        refundMethod: actionType === 'refund' ? refundMethod : undefined,
        totalReturnedAmount,
        exchangeProduct: actionType === 'exchange' ? exchangeProduct : undefined,
        exchangePriceDifference: exchangePriceDiff,
        reason: reason.trim() || 'Retour client',
        date: returnDate,
        userName: userName?.trim() || auth.currentUser?.displayName || auth.currentUser?.email || state.settings.name || 'Responsable',
        notes: notes?.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // 1. Stock movements
      // For each returned item with restock: true, add stock movement 'in' with reason 'customer_return'
      const newMovements: StockMovement[] = [];
      const updatedProductsMap = new Map<string, Product>();

      for (const it of items) {
        if (it.restock && it.productId) {
          const product = updatedProductsMap.get(it.productId) || state.products.find((p) => p.id === it.productId);
          if (product) {
            const prevStock = product.stockQuantity;
            const newStock = prevStock + Math.max(0, it.quantity);
            const updatedProd = { ...product, stockQuantity: newStock, updatedAt: nowIso };
            updatedProductsMap.set(product.id, updatedProd);

            newMovements.push({
              id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              productId: product.id,
              productName: product.name,
              type: 'in',
              quantity: it.quantity,
              previousStock: prevStock,
              newStock,
              reason: 'customer_return',
              referenceId: returnNumber,
              note: `Retour sur vente ${invoice.number} (${reason})`,
              userName: newReturn.userName,
              createdAt: nowIso,
            });
          }
        }
      }

      // For exchange replacement product, decrement stock
      if (actionType === 'exchange' && exchangeProduct && exchangeProduct.productId) {
        const product = updatedProductsMap.get(exchangeProduct.productId) || state.products.find((p) => p.id === exchangeProduct.productId);
        if (product) {
          const prevStock = product.stockQuantity;
          const newStock = prevStock - Math.max(0, exchangeProduct.quantity);
          const updatedProd = { ...product, stockQuantity: newStock, updatedAt: nowIso };
          updatedProductsMap.set(product.id, updatedProd);

          newMovements.push({
            id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            productId: product.id,
            productName: product.name,
            type: 'out',
            quantity: exchangeProduct.quantity,
            previousStock: prevStock,
            newStock,
            reason: 'sale',
            referenceId: returnNumber,
            note: `Article délivré en échange contre ${returnNumber}`,
            userName: newReturn.userName,
            createdAt: nowIso,
          });
        }
      }

      // 2. Financial adjustments & Invoice update
      // "Pour un remboursement ou un avoir, mettre correctement à jour les montants de la facture et les paiements.
      // Ne jamais modifier ou supprimer l'historique original de la vente."
      const newPayments: PaymentRecord[] = [];
      let updatedInvoice: Invoice = { ...invoice };

      if (actionType === 'refund') {
        // Customer was paid back cash / mobile money
        // Record refund payment record
        const paymentRecord: PaymentRecord = {
          id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          amount: -totalReturnedAmount,
          date: createPaymentDateString(returnDate),
          method: refundMethod,
          note: `Remboursement retour ${returnNumber} (${reason})`,
          createdAt: nowIso,
        };
        newPayments.push(paymentRecord);

        // Adjust amountPaid and remainingAmount
        const newAmountPaid = Math.max(0, roundCurrency(invoice.amountPaid - totalReturnedAmount));
        const netDue = Math.max(0, roundCurrency(invoice.total - totalReturnedAmount));
        const newRemaining = Math.max(0, roundCurrency(netDue - newAmountPaid));
        const newStatus = newRemaining === 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid';

        updatedInvoice = {
          ...invoice,
          amountPaid: newAmountPaid,
          remainingAmount: newRemaining,
          status: newStatus,
          updatedAt: nowIso,
        };
      } else if (actionType === 'credit_note') {
        // Avoir client : the credit note offsets remaining balance if any, or stands as client credit
        const offset = Math.min(invoice.remainingAmount, totalReturnedAmount);
        const newRemaining = Math.max(0, roundCurrency(invoice.remainingAmount - offset));
        const newStatus = newRemaining === 0 ? 'paid' : invoice.amountPaid > 0 ? 'partial' : 'unpaid';

        updatedInvoice = {
          ...invoice,
          remainingAmount: newRemaining,
          status: newStatus,
          notes: invoice.notes
            ? `${invoice.notes}\n[Avoir client ${returnNumber} émis : ${totalReturnedAmount} ${state.settings.currency}]`
            : `[Avoir client ${returnNumber} émis : ${totalReturnedAmount} ${state.settings.currency}]`,
          updatedAt: nowIso,
        };
      } else if (actionType === 'exchange') {
        // Exchange : handle difference
        if (exchangePriceDiff && exchangePriceDiff > 0) {
          // Client paid extra difference
          const paymentRecord: PaymentRecord = {
            id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            amount: exchangePriceDiff,
            date: createPaymentDateString(returnDate),
            method: refundMethod,
            note: `Supplément payé échange ${returnNumber} (${exchangeProduct?.designation})`,
            createdAt: nowIso,
          };
          newPayments.push(paymentRecord);
        } else if (exchangePriceDiff && exchangePriceDiff < 0) {
          // Shop refunded difference to client
          const refundDiff = Math.abs(exchangePriceDiff);
          const paymentRecord: PaymentRecord = {
            id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            amount: -refundDiff,
            date: createPaymentDateString(returnDate),
            method: refundMethod,
            note: `Remboursement différence échange ${returnNumber}`,
            createdAt: nowIso,
          };
          newPayments.push(paymentRecord);
        }

        updatedInvoice = {
          ...invoice,
          updatedAt: nowIso,
        };
      }

      // 3. Persist new state
      const updatedProducts = state.products.map((p) =>
        updatedProductsMap.has(p.id) ? updatedProductsMap.get(p.id)! : p
      );

      const updatedInvoices = state.invoices.map((inv) =>
        inv.id === updatedInvoice.id ? updatedInvoice : inv
      );

      const updatedState: AppState = {
        ...state,
        products: updatedProducts,
        movements: [...newMovements, ...state.movements],
        invoices: updatedInvoices,
        payments: [...newPayments, ...state.payments],
        returns: [newReturn, ...(state.returns || [])],
      };

      await persistState(updatedState);

      // 4. Background Firestore sync
      firestoreSyncService.syncReturn(newReturn).catch(() => {});
      firestoreSyncService.syncInvoice(updatedInvoice).catch(() => {});
      for (const m of newMovements) {
        firestoreSyncService.syncStockMovement(m).catch(() => {});
      }
      for (const p of updatedProductsMap.values()) {
        firestoreSyncService.syncProduct(p).catch(() => {});
      }
      for (const pay of newPayments) {
        firestoreSyncService.syncPayment(pay).catch(() => {});
      }

      return { success: true, saleReturn: newReturn };
    },
    [state, persistState]
  );

  // PIN & Security
  const unlockWithPin = useCallback(
    (pin: string) => {
      if (!state.settings.pinEnabled || !state.settings.pinCode) {
        setState((prev) => ({ ...prev, isLocked: false }));
        return true;
      }
      if (state.settings.pinCode === pin) {
        setState((prev) => ({ ...prev, isLocked: false }));
        return true;
      }
      return false;
    },
    [state.settings.pinEnabled, state.settings.pinCode]
  );

  const setAppPin = useCallback(
    async (pin: string) => {
      const updated: AppState = {
        ...state,
        settings: {
          ...state.settings,
          pinEnabled: true,
          pinCode: pin,
        },
      };
      await persistState(updated);
    },
    [state, persistState]
  );

  const removeAppPin = useCallback(async () => {
    const updated: AppState = {
      ...state,
      settings: {
        ...state.settings,
        pinEnabled: false,
        pinCode: '',
      },
      isLocked: false,
    };
    await persistState(updated);
  }, [state, persistState]);

  const lockApp = useCallback(() => {
    if (state.settings.pinEnabled && state.settings.pinCode) {
      setState((prev) => ({ ...prev, isLocked: true }));
    }
  }, [state.settings.pinEnabled, state.settings.pinCode]);

  // Demo data and resets
  const loadDemoData = useCallback(async () => {
    const demo = getDemoState();
    await persistState(demo);
  }, [persistState]);

  const clearDemoData = useCallback(async () => {
    const empty: AppState = {
      ...initialEmptyState,
      settings: state.settings,
      hasCompletedOnboarding: true,
    };
    await persistState(empty);
  }, [state.settings, persistState]);

  const resetAllData = useCallback(async () => {
    if (dataRepository.clearAll) {
      await dataRepository.clearAll();
    }
    setState(initialEmptyState);
  }, []);

  const resetStateOnLogout = useCallback(async () => {
    stateRef.current = initialEmptyState;
    setState(initialEmptyState);
    dataRepository.setUserScope(null);
  }, []);

  const reloadStateForUser = useCallback(async (userId: string | null) => {
    setIsLoading(true);
    try {
      dataRepository.setUserScope(userId);
      const cached = await dataRepository.loadFullState();

      // Check LocalStorage and local state first (instant, 0ms)
      const hasCompletedLocally = isUserOnboarded(userId, cached);

      // Only check cloud onboarding if not already completed locally
      let hasCompletedCloud = false;
      if (userId && !hasCompletedLocally) {
        hasCompletedCloud = await firestoreSyncService.hasCloudData(userId);
      }

      // 1. Fetch definitive company settings from Firestore (authoritative source of truth)
      let authoritativeSettings: CompanySettings | null = null;
      if (userId) {
        try {
          const settingsSnap = await getDoc(doc(db, 'users', userId, 'settings', 'company'));
          if (settingsSnap.exists()) {
            const cloudData = settingsSnap.data() as CompanySettings;
            if (!isDemoSettings(cloudData) || !hasCustomUserSettings(cached?.settings)) {
              authoritativeSettings = cleanCompanySettings(cloudData, cached?.settings);
            }
          }
        } catch (err) {
          console.warn('Direct Firestore settings fetch warning:', err);
        }
      }

      // 2. Resolve final settings: Prioritize newer timestamp when comparing local vs cloud
      const localUpdatedTime = cached?.settings?.updatedAt
        ? new Date(cached.settings.updatedAt).getTime()
        : 0;
      const cloudUpdatedTime = authoritativeSettings?.updatedAt
        ? new Date(authoritativeSettings.updatedAt).getTime()
        : 0;

      const isLocalMoreRecent =
        hasCustomUserSettings(cached?.settings) &&
        localUpdatedTime > cloudUpdatedTime &&
        !isNaN(localUpdatedTime);

      let resolvedSettings: CompanySettings;
      if (isLocalMoreRecent && cached?.settings) {
        // Local settings were modified more recently (e.g. just before app reload): preserve local and sync to cloud
        resolvedSettings = cleanCompanySettings(cached.settings);
        if (userId) {
          firestoreSyncService.syncSettings(resolvedSettings).catch(() => {});
        }
      } else if (authoritativeSettings && hasCustomUserSettings(authoritativeSettings)) {
        resolvedSettings = authoritativeSettings;
      } else if (cached?.settings && hasCustomUserSettings(cached.settings)) {
        resolvedSettings = cleanCompanySettings(cached.settings);
        // Ensure Firestore gets initialized with these user settings if it lacked them
        if (userId) {
          firestoreSyncService.syncSettings(resolvedSettings).catch(() => {});
        }
      } else if (authoritativeSettings) {
        resolvedSettings = authoritativeSettings;
      } else if (cached?.settings) {
        resolvedSettings = cleanCompanySettings(cached.settings);
      } else {
        resolvedSettings = { ...defaultSettings };
      }

      const isCompleted =
        hasCompletedLocally ||
        hasCompletedCloud ||
        Boolean(resolvedSettings.hasCompletedOnboarding);

      if (isCompleted) {
        markUserOnboardedLocally(userId);
      }

      resolvedSettings = {
        ...resolvedSettings,
        hasCompletedOnboarding: isCompleted ? true : resolvedSettings.hasCompletedOnboarding,
      };

      if (
        cached &&
        (cached.products?.length ||
          cached.invoices?.length ||
          cached.clients?.length ||
          hasCustomUserSettings(resolvedSettings))
      ) {
        const normalizedCached: AppState = {
          ...cached,
          restockRequests: Array.isArray(cached.restockRequests) ? cached.restockRequests : [],
          returns: Array.isArray(cached.returns) ? cached.returns : [],
          hasCompletedOnboarding: isCompleted,
          settings: resolvedSettings,
        };
        stateRef.current = normalizedCached;
        setState(normalizedCached);
        // Persist immediately to the active user cache
        dataRepository.saveFullState(normalizedCached);
      } else {
        const readyState: AppState = {
          ...initialEmptyState,
          hasCompletedOnboarding: isCompleted,
          settings: resolvedSettings,
        };
        stateRef.current = readyState;
        setState(readyState);
        dataRepository.saveFullState(readyState);
      }
    } catch (e) {
      console.error('Failed to reload state for user:', e);
      stateRef.current = initialEmptyState;
      setState(initialEmptyState);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completeOnboarding = useCallback(
    async (customSettings?: { name: string; currency: string }) => {
      const uid = auth.currentUser?.uid;
      markUserOnboardedLocally(uid);

      const updatedSettings: CompanySettings = {
        ...state.settings,
        hasCompletedOnboarding: true,
        ...(customSettings?.name ? { name: customSettings.name.trim() } : {}),
        ...(customSettings?.currency ? { currency: customSettings.currency.trim() } : {}),
      };

      const nextState: AppState = {
        ...state,
        settings: updatedSettings,
        hasCompletedOnboarding: true,
      };

      stateRef.current = nextState;
      setState(nextState);

      // 1. Immediately persist to IndexedDB
      await dataRepository.saveFullState(nextState);

      // 2. Immediately persist to Firestore dedicated flags if authenticated
      if (uid) {
        await firestoreSyncService.persistOnboardingStatus(uid);
      }

      // 3. Sync settings changes to cloud
      firestoreSyncService.syncSettings(updatedSettings).catch((err) => {
        console.warn('Firestore settings sync error during onboarding:', err);
      });
    },
    [state]
  );

  const importBackup = useCallback(
    async (backupState: AppState) => {
      if (!backupState || !backupState.settings || !Array.isArray(backupState.products)) {
        return false;
      }
      stateRef.current = backupState;
      setState(backupState);
      await dataRepository.saveFullState(backupState);
      // Synchronize full restored state to Firestore Cloud
      await firestoreSyncService.syncFullRestoredState(backupState);
      return true;
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      state,
      isLoading,
      activeView,
      setActiveView,
      selectedItemId,
      setSelectedItemId,
      navigate,
      goBack,
      updateSettings,
      addProduct,
      updateProduct,
      deleteProduct,
      addCategory,
      deleteCategory,
      recordStockMovement,
      addClient,
      updateClient,
      deleteClient,
      createSale,
      updateInvoice,
      cancelInvoice,
      validateDraftInvoice,
      addPaymentToInvoice,
      payClientReceivablesGlobally,
      addRestockRequest,
      updateRestockRequestStatus,
      deleteRestockRequest,
      createQuote,
      updateQuote,
      deleteQuote,
      convertQuoteToInvoice,
      processSaleReturn,
      unlockWithPin,
      setAppPin,
      removeAppPin,
      lockApp,
      loadDemoData,
      clearDemoData,
      resetAllData,
      resetStateOnLogout,
      reloadStateForUser,
      completeOnboarding,
      importBackup,
    }),
    [
      state,
      isLoading,
      activeView,
      selectedItemId,
      navigate,
      goBack,
      updateSettings,
      addProduct,
      updateProduct,
      deleteProduct,
      addCategory,
      deleteCategory,
      recordStockMovement,
      addClient,
      updateClient,
      deleteClient,
      createSale,
      updateInvoice,
      cancelInvoice,
      validateDraftInvoice,
      addPaymentToInvoice,
      payClientReceivablesGlobally,
      addRestockRequest,
      updateRestockRequestStatus,
      deleteRestockRequest,
      createQuote,
      updateQuote,
      deleteQuote,
      convertQuoteToInvoice,
      processSaleReturn,
      unlockWithPin,
      setAppPin,
      removeAppPin,
      lockApp,
      loadDemoData,
      clearDemoData,
      resetAllData,
      resetStateOnLogout,
      reloadStateForUser,
      completeOnboarding,
      importBackup,
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
