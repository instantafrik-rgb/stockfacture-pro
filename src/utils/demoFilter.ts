/**
 * StockFacture Pro - Demo Data Filter & Detection Utilities
 * 
 * Accurately detects and filters out historical demo data across all collections
 * while safeguarding all genuine user data, custom company settings, and categories.
 */

import {
  AppState,
  Product,
  Client,
  Invoice,
  Quote,
  PaymentRecord,
  StockMovement,
  RestockRequest,
  CashRegisterClosure,
  SaleReturn,
} from '../types';

export const DEMO_PRODUCT_IDS = new Set([
  'prod-1',
  'prod-2',
  'prod-3',
  'prod-4',
  'prod-5',
  'prod-6',
  'prod-7',
  'prod-8',
  'prod-9',
  'prod-10',
  'prod-11',
  'prod-12',
  'prod-13',
  'prod-14',
  'prod-15',
  'prod-16',
  'prod-chg-1',
  'prod-demo-1',
  'prod-demo-2',
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
  'p6',
  'p7',
  'p8',
  'p9',
  'p10',
]);

export const DEMO_PRODUCT_SKUS = new Set([
  'CHG-GAN-65W',
  'CBL-CL-12M',
  'CBL-CC-100W',
  'AUD-AIR-PRO',
  'AUD-HEAD-BT',
  'PROT-VT-9D',
  'COQ-MAG-SIL',
  'PWR-20K-FC',
  'STK-USB-128',
  'STK-SSD-512',
  'PC-MSE-WL',
  'HUB-7IN1',
]);

export const DEMO_PRODUCT_BARCODES = new Set([
  '61820260001',
  '61820260002',
  '61820260003',
  '61820260004',
  '61820260005',
  '61820260006',
  '61820260007',
  '61820260008',
  '61820260009',
  '61820260010',
  '61820260011',
  '61820260012',
]);

export const DEMO_PRODUCT_NAMES = new Set([
  'Chargeur Rapide 65W GaN USB-C Multi-Ports',
  'Câble Renforcé USB-C vers Lightning 1.2m',
  'Câble USB-C vers USB-C 100W PD 2m',
  'Écouteurs Sans Fil AirPods Pro TWS (ANC)',
  'Casque Bluetooth Pliable Super Bass Pro',
  'Verre Trempé Antichoc 9D Intégral iPhone 15/14',
  'Coque Silicone Liquide MagSafe Antichoc',
  'Power Bank 20 000 mAh Fast Charge 22.5W',
  'Clé USB 3.2 Double Connecteur Type-C / USB-A 128Go',
  'Disque SSD Externe Portable 512Go Type-C',
  'Souris Sans Fil Ergonomique Rechargeable 2.4G',
  'Hub Adaptateur USB-C 7-en-1 (HDMI 4K, SD, USB 3.0)',
  'Chargeur Rapide 33W Type-C',
]);

export const DEMO_CLIENT_IDS = new Set([
  'cli-1',
  'cli-2',
  'cli-3',
  'cli-02',
  'c1',
  'c2',
  'c3',
  'c4',
  'cli-demo-1',
  'cli-demo-2',
]);

export const DEMO_CLIENT_NAMES = new Set([
  'Jean-Marc Yao (Cyber Café Le Phare)',
  'Cabinet Nova Consulting Sarl',
  'Mlle Fatou Bamba',
  'Amadou Diallo',
  'Fatou Traoré',
  'Kouassi Michel',
]);

export const DEMO_INVOICE_IDS = new Set([
  'inv-1',
  'inv-2',
  'inv-3',
  'inv-1001',
  'inv-1002',
  'inv-1003',
  'i1',
  'i2',
  'i3',
]);

export const DEMO_INVOICE_NUMBERS = new Set([
  'FAC-2026-1001',
  'FAC-2026-1002',
  'FAC-2026-1003',
]);

export const DEMO_QUOTE_IDS = new Set([
  'quote-1',
  'quote-2',
  'quo-1001',
  'quo-1002',
  'q1',
  'q2',
]);

export const DEMO_QUOTE_NUMBERS = new Set(['DEV-2026-1001', 'DEV-2026-1002']);

export const DEMO_PAYMENT_IDS = new Set([
  'pay-1',
  'pay-2',
  'pay-1001',
  'pay-1002',
  'pay-1003',
  'pay-1004',
]);

export const DEMO_MOVEMENT_IDS = new Set([
  'mov-1',
  'mov-2',
  'mov-3',
  'mov-4',
  'mov-5',
  'mov-6',
  'mov-7',
  'mov-8',
  'mov-9',
  'mov-10',
  'mov-11',
  'mov-12',
]);

export const DEMO_RESTOCK_IDS = new Set(['req-01', 'req-02', 'rr-1', 'rr-2']);
export const DEMO_CLOSURE_IDS = new Set(['close-1', 'close-2', 'cl-1', 'cl-2', 'closure-demo-1']);
export const DEMO_RETURN_IDS = new Set(['ret-1', 'ret-2', 'ret-demo-1']);

export function isDemoProduct(p?: Partial<Product> | null): boolean {
  if (!p) return false;
  if ((p as any).isDemo === true) return true;
  if (p.id && DEMO_PRODUCT_IDS.has(p.id)) return true;
  if (p.sku && DEMO_PRODUCT_SKUS.has(p.sku)) return true;
  if (p.barcode && DEMO_PRODUCT_BARCODES.has(p.barcode)) return true;
  if (p.name && DEMO_PRODUCT_NAMES.has(p.name.trim())) return true;
  return false;
}

export function isDemoClient(c?: Partial<Client> | null): boolean {
  if (!c) return false;
  if ((c as any).isDemo === true) return true;
  if (c.id && DEMO_CLIENT_IDS.has(c.id)) return true;
  if (c.name && DEMO_CLIENT_NAMES.has(c.name.trim())) return true;
  return false;
}

export function isDemoInvoice(i?: Partial<Invoice> | null): boolean {
  if (!i) return false;
  if ((i as any).isDemo === true) return true;
  if (i.id && DEMO_INVOICE_IDS.has(i.id)) return true;
  if (i.number && DEMO_INVOICE_NUMBERS.has(i.number.trim())) return true;
  if (i.clientId && DEMO_CLIENT_IDS.has(i.clientId)) return true;
  if (i.clientName && DEMO_CLIENT_NAMES.has(i.clientName.trim())) return true;
  return false;
}

export function isDemoQuote(q?: Partial<Quote> | null): boolean {
  if (!q) return false;
  if ((q as any).isDemo === true) return true;
  if (q.id && DEMO_QUOTE_IDS.has(q.id)) return true;
  if (q.number && DEMO_QUOTE_NUMBERS.has(q.number.trim())) return true;
  if (q.clientId && DEMO_CLIENT_IDS.has(q.clientId)) return true;
  if (q.clientName && DEMO_CLIENT_NAMES.has(q.clientName.trim())) return true;
  return false;
}

export function isDemoPayment(p?: Partial<PaymentRecord> | null): boolean {
  if (!p) return false;
  if ((p as any).isDemo === true) return true;
  if (p.id && DEMO_PAYMENT_IDS.has(p.id)) return true;
  if (p.invoiceId && DEMO_INVOICE_IDS.has(p.invoiceId)) return true;
  if (p.invoiceNumber && DEMO_INVOICE_NUMBERS.has(p.invoiceNumber.trim())) return true;
  return false;
}

export function isDemoMovement(m?: Partial<StockMovement> | null): boolean {
  if (!m) return false;
  if ((m as any).isDemo === true) return true;
  if (m.id && DEMO_MOVEMENT_IDS.has(m.id)) return true;
  if (m.productId && DEMO_PRODUCT_IDS.has(m.productId)) return true;
  if (m.productName && DEMO_PRODUCT_NAMES.has(m.productName.trim())) return true;
  if (m.referenceId && (DEMO_INVOICE_NUMBERS.has(m.referenceId) || DEMO_INVOICE_IDS.has(m.referenceId))) return true;
  return false;
}

export function isDemoRestockRequest(r?: Partial<RestockRequest> | null): boolean {
  if (!r) return false;
  if ((r as any).isDemo === true) return true;
  if (r.id && DEMO_RESTOCK_IDS.has(r.id)) return true;
  if (r.productId && DEMO_PRODUCT_IDS.has(r.productId)) return true;
  if (r.clientId && DEMO_CLIENT_IDS.has(r.clientId)) return true;
  return false;
}

export function isDemoClosure(c?: Partial<CashRegisterClosure> | null): boolean {
  if (!c) return false;
  if ((c as any).isDemo === true) return true;
  if (c.id && DEMO_CLOSURE_IDS.has(c.id)) return true;
  if (c.notes && (c.notes.toLowerCase().includes('demo') || c.notes.toLowerCase().includes('factice'))) return true;
  return false;
}

export function isDemoReturn(r?: Partial<SaleReturn> | null): boolean {
  if (!r) return false;
  if ((r as any).isDemo === true) return true;
  if (r.id && DEMO_RETURN_IDS.has(r.id)) return true;
  if (r.invoiceId && DEMO_INVOICE_IDS.has(r.invoiceId)) return true;
  if (r.invoiceNumber && DEMO_INVOICE_NUMBERS.has(r.invoiceNumber.trim())) return true;
  return false;
}

/**
 * Purges all demo items from an AppState while preserving all real user items,
 * company settings, and categories.
 */
export function purgeDemoFromState(state: AppState): { state: AppState; hasChanges: boolean } {
  let hasChanges = false;

  const products = (state.products || []).filter((p) => {
    const isDemo = isDemoProduct(p);
    if (isDemo) hasChanges = true;
    return !isDemo;
  });

  const clients = (state.clients || []).filter((c) => {
    const isDemo = isDemoClient(c);
    if (isDemo) hasChanges = true;
    return !isDemo;
  });

  const invoices = (state.invoices || []).filter((i) => {
    const isDemo = isDemoInvoice(i);
    if (isDemo) hasChanges = true;
    return !isDemo;
  });

  const quotes = (state.quotes || []).filter((q) => {
    const isDemo = isDemoQuote(q);
    if (isDemo) hasChanges = true;
    return !isDemo;
  });

  const payments = (state.payments || []).filter((p) => {
    const isDemo = isDemoPayment(p);
    if (isDemo) hasChanges = true;
    return !isDemo;
  });

  const movements = (state.movements || []).filter((m) => {
    const isDemo = isDemoMovement(m);
    if (isDemo) hasChanges = true;
    return !isDemo;
  });

  const restockRequests = (state.restockRequests || []).filter((r) => {
    const isDemo = isDemoRestockRequest(r);
    if (isDemo) hasChanges = true;
    return !isDemo;
  });

  const closures = (state.closures || []).filter((cl) => {
    const isDemo = isDemoClosure(cl);
    if (isDemo) hasChanges = true;
    return !isDemo;
  });

  const returns = (state.returns || []).filter((ret) => {
    const isDemo = isDemoReturn(ret);
    if (isDemo) hasChanges = true;
    return !isDemo;
  });

  return {
    state: {
      ...state,
      products,
      clients,
      invoices,
      quotes,
      payments,
      movements,
      restockRequests,
      closures,
      returns,
    },
    hasChanges,
  };
}
