/**
 * StockFacture Pro - Default State & Base Categories
 * 
 * Production Configuration:
 * - Empty collections for products, movements, clients, invoices, quotes, payments, etc.
 * - Base editable categories preserved
 * - Neutral default company settings
 * - Absolutely zero mock/demo data
 */

import { AppState, CompanySettings, Category } from '../types';

export const defaultSettings: CompanySettings = {
  name: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  taxId: '',
  currency: 'FCFA',
  currencyPosition: 'after',
  invoicePrefix: 'FAC-2026-',
  nextInvoiceNumber: 1001,
  quotePrefix: 'DEV-2026-',
  nextQuoteNumber: 1001,
  vatEnabled: false,
  vatRate: 18,
  paymentTerms: 'Règlement à réception.',
  invoiceFooterNote: 'Merci pour votre confiance !',
  allowNegativeStock: false,
  pinEnabled: false,
  pinCode: '',
  theme: 'light',
  hasCompletedOnboarding: false,
};

export const demoSettings: CompanySettings = { ...defaultSettings };

export const defaultCategories: Category[] = [
  { id: 'cat-chg', name: 'Chargeurs & Câbles', color: '#f97316' },
  { id: 'cat-aud', name: 'Écouteurs & Audio', color: '#0284c7' },
  { id: 'cat-prot', name: 'Coques & Verres Trempés', color: '#10b981' },
  { id: 'cat-stk', name: 'Stockage & Clés USB', color: '#8b5cf6' },
  { id: 'cat-pwr', name: 'Power Banks & Batteries', color: '#f59e0b' },
  { id: 'cat-pc', name: 'Accessoires PC & Bureautique', color: '#64748b' },
];

export const initialEmptyState: AppState = {
  settings: defaultSettings,
  categories: defaultCategories,
  products: [],
  movements: [],
  clients: [],
  invoices: [],
  payments: [],
  quotes: [],
  closures: [],
  restockRequests: [],
  returns: [],
  isLocked: false,
  hasCompletedOnboarding:
    typeof window !== 'undefined' &&
    localStorage.getItem('stockfacture_onboarding_completed') === 'true',
};

/**
 * In production, getDemoState returns a clean empty state with base categories.
 * Prevents any accidental re-injection of mock items.
 */
export function getDemoState(): AppState {
  return {
    ...initialEmptyState,
    categories: [...defaultCategories],
  };
}
