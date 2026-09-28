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
} from '../types';
import { dataRepository, firestoreSyncService } from '../services/data';
import { getDemoState, initialEmptyState } from '../data/demoData';
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
import { generateDocumentNumber, getTodayDateString } from '../utils/formatters';

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

  // PIN & Security
  unlockWithPin: (pin: string) => boolean;
  setAppPin: (pin: string) => Promise<void>;
  removeAppPin: () => Promise<void>;
  lockApp: () => void;

  // Demo & Reset
  loadDemoData: () => Promise<void>;
  clearDemoData: () => Promise<void>;
  resetAllData: () => Promise<void>;
  importBackup: (backupState: AppState) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialEmptyState);
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
          // If categories still contain old grocery demo data, upgrade to telephony & IT accessories boutique
          const hasOldGroceryData = loaded.categories?.some((c) =>
            c.name.toLowerCase().includes('alimentation') || c.name.toLowerCase().includes('épicerie')
          );
          if (hasOldGroceryData) {
            const demo = getDemoState();
            await dataRepository.saveFullState(demo);
            setState(demo);
            return;
          }

          // Strictly ensure light theme is the default experience
          if (!loaded.settings?.theme || loaded.settings.theme === 'dark') {
            loaded.settings = { ...loaded.settings, theme: 'light' };
            await dataRepository.saveFullState(loaded);
          }
          // If PIN is enabled, lock upon startup
          const shouldLock = Boolean(loaded.settings?.pinEnabled && loaded.settings?.pinCode);
          setState({ ...loaded, isLocked: shouldLock });
        } else {
          // Start with demo state for immediate exploration if first time
          const demo = getDemoState();
          await dataRepository.saveFullState(demo);
          setState(demo);
        }
      } catch (e) {
        console.error('Initialization error:', e);
        setState(getDemoState());
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Listen for real-time remote updates from Firestore and merge into local state
  useEffect(() => {
    firestoreSyncService.registerRemoteUpdateListener((updater) => {
      setState((prev) => {
        const next = updater(prev);
        dataRepository.saveFullState(next);
        return next;
      });
    });
  }, []);

  // Sync state to storage
  const persistState = useCallback(async (newState: AppState) => {
    setState(newState);
    await dataRepository.saveFullState(newState);
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
      const updated: AppState = {
        ...state,
        settings: { ...state.settings, ...newSettings },
      };
      await persistState(updated);
    },
    [state, persistState]
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

      return newProduct;
    },
    [state, persistState]
  );

  const updateProduct = useCallback(
    async (id: string, productData: Partial<Product>) => {
      const updatedProducts = state.products.map((p) =>
        p.id === id ? { ...p, ...productData, updatedAt: new Date().toISOString() } : p
      );
      await persistState({ ...state, products: updatedProducts });
    },
    [state, persistState]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const updatedProducts = state.products.filter((p) => p.id !== id);
      await persistState({ ...state, products: updatedProducts });
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
      date,
    }: {
      productId: string;
      type: 'in' | 'out' | 'adjustment';
      quantity: number;
      reason: StockMovementReason;
      note?: string;
      referenceId?: string;
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
        createdAt: movementDate,
      };

      const updatedProducts = state.products.map((p) =>
        p.id === productId ? { ...p, stockQuantity: newStock, updatedAt: new Date().toISOString() } : p
      );

      await persistState({
        ...state,
        products: updatedProducts,
        movements: [movement, ...state.movements],
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
      return newClient;
    },
    [state, persistState]
  );

  const updateClient = useCallback(
    async (id: string, clientData: Partial<Client>) => {
      const updatedClients = state.clients.map((c) =>
        c.id === id ? { ...c, ...clientData, updatedAt: new Date().toISOString() } : c
      );
      await persistState({ ...state, clients: updatedClients });
    },
    [state, persistState]
  );

  const deleteClient = useCallback(
    async (id: string) => {
      await persistState({
        ...state,
        clients: state.clients.filter((c) => c.id !== id),
      });
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
          date: nowIso,
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

      return { success: true, invoice: newInvoice };
    },
    [state, persistState]
  );

  const updateInvoice = useCallback(
    async (id: string, invoiceData: Partial<Invoice>) => {
      const updatedInvoices = state.invoices.map((inv) =>
        inv.id === id ? { ...inv, ...invoiceData, updatedAt: new Date().toISOString() } : inv
      );
      await persistState({ ...state, invoices: updatedInvoices });
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
      const paymentDate = date ? new Date(date).toISOString() : nowIso;

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

      return { success: true, payment: newPayment };
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

      return { success: true, quote: newQuote };
    },
    [state, persistState]
  );

  const updateQuote = useCallback(
    async (id: string, quoteData: Partial<Quote>) => {
      const updatedQuotes = state.quotes.map((q) =>
        q.id === id ? { ...q, ...quoteData, updatedAt: new Date().toISOString() } : q
      );
      await persistState({ ...state, quotes: updatedQuotes });
    },
    [state, persistState]
  );

  const deleteQuote = useCallback(
    async (id: string) => {
      await persistState({
        ...state,
        quotes: state.quotes.filter((q) => q.id !== id),
      });
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

      return { success: true, invoice: res.invoice };
    },
    [state, createSale, persistState]
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

  const importBackup = useCallback(
    async (backupState: AppState) => {
      if (!backupState || !backupState.settings || !Array.isArray(backupState.products)) {
        return false;
      }
      await persistState(backupState);
      return true;
    },
    [persistState]
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
      createQuote,
      updateQuote,
      deleteQuote,
      convertQuoteToInvoice,
      unlockWithPin,
      setAppPin,
      removeAppPin,
      lockApp,
      loadDemoData,
      clearDemoData,
      resetAllData,
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
      createQuote,
      updateQuote,
      deleteQuote,
      convertQuoteToInvoice,
      unlockWithPin,
      setAppPin,
      removeAppPin,
      lockApp,
      loadDemoData,
      clearDemoData,
      resetAllData,
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
