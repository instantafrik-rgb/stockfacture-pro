/**
 * StockFacture Pro - Centralized Financial & Commercial Calculation Engine
 */

import { InvoiceItem, PaymentRecord, Product, InvoiceStatus } from '../types';

/**
 * Rounds to 2 decimal places to avoid floating point anomalies
 */
export function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate total for a single line item taking discount percentage into account
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number = 0
): number {
  const safeQty = Math.max(0, Number(quantity) || 0);
  const safePrice = Math.max(0, Number(unitPrice) || 0);
  const safeDiscount = Math.min(100, Math.max(0, Number(discountPercent) || 0));

  const gross = safeQty * safePrice;
  const discountAmount = gross * (safeDiscount / 100);
  return roundCurrency(gross - discountAmount);
}

/**
 * Calculate subtotal of an items array (sum of raw quantity * unitPrice)
 */
export function calculateSubtotal(
  items: Array<{ quantity: number; unitPrice: number }>
): number {
  return roundCurrency(
    items.reduce((sum, item) => {
      const q = Math.max(0, Number(item.quantity) || 0);
      const p = Math.max(0, Number(item.unitPrice) || 0);
      return sum + q * p;
    }, 0)
  );
}

/**
 * Calculate total discount across items
 */
export function calculateDiscountTotal(
  items: Array<{ quantity: number; unitPrice: number; discountPercent?: number }>
): number {
  return roundCurrency(
    items.reduce((sum, item) => {
      const q = Math.max(0, Number(item.quantity) || 0);
      const p = Math.max(0, Number(item.unitPrice) || 0);
      const d = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
      return sum + (q * p * (d / 100));
    }, 0)
  );
}

/**
 * Calculate VAT amount given taxable base and rate
 */
export function calculateTax(
  taxableBase: number,
  vatRate: number,
  vatEnabled: boolean = true
): number {
  if (!vatEnabled || vatRate <= 0) return 0;
  const safeBase = Math.max(0, Number(taxableBase) || 0);
  const safeRate = Math.max(0, Number(vatRate) || 0);
  return roundCurrency(safeBase * (safeRate / 100));
}

/**
 * Calculate full invoice total
 */
export function calculateInvoiceTotal(
  subtotal: number,
  discountTotal: number,
  vatAmount: number
): number {
  const base = Math.max(0, subtotal - discountTotal);
  return roundCurrency(base + Math.max(0, vatAmount));
}

/**
 * Calculate total amount paid from an array of payment records
 */
export function calculateAmountPaid(payments: PaymentRecord[]): number {
  return roundCurrency(
    payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  );
}

/**
 * Calculate remaining balance
 */
export function calculateRemainingBalance(
  total: number,
  amountPaid: number
): number {
  const diff = roundCurrency(Number(total) - Number(amountPaid));
  return Math.max(0, diff);
}

/**
 * Compute invoice status based on total and paid amounts
 */
export function determineInvoiceStatus(
  total: number,
  amountPaid: number,
  isCancelled: boolean = false
): InvoiceStatus {
  if (isCancelled) return 'cancelled';
  const paid = roundCurrency(Number(amountPaid));
  const tot = roundCurrency(Number(total));

  if (paid <= 0) return 'unpaid';
  if (paid >= tot) return 'paid';
  return 'partial';
}

export interface InvoiceSummary {
  subtotal: number;
  discountTotal: number;
  taxableBase: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  remainingAmount: number;
  status: InvoiceStatus;
}

/**
 * Central calculation function for all invoice totals, taxes, discounts, balance and status
 */
export function computeInvoiceSummary(
  items: Array<{ quantity: number; unitPrice: number; discountPercent?: number }>,
  vatEnabled: boolean,
  vatRate: number,
  amountPaid: number = 0,
  isDraft: boolean = false,
  isCancelled: boolean = false
): InvoiceSummary {
  const subtotal = calculateSubtotal(items);
  const discountTotal = calculateDiscountTotal(items);
  const taxableBase = Math.max(0, subtotal - discountTotal);
  const vatAmount = calculateTax(taxableBase, vatRate, vatEnabled);
  const total = calculateInvoiceTotal(subtotal, discountTotal, vatAmount);
  const safePaid = Math.max(0, roundCurrency(amountPaid));
  const remainingAmount = calculateRemainingBalance(total, safePaid);

  let status: InvoiceStatus;
  if (isCancelled) {
    status = 'cancelled';
  } else if (isDraft) {
    status = 'draft';
  } else {
    status = determineInvoiceStatus(total, safePaid);
  }

  return {
    subtotal,
    discountTotal,
    taxableBase,
    vatAmount,
    total,
    amountPaid: safePaid,
    remainingAmount,
    status,
  };
}

/**
 * Calculate estimated profit for items where purchasePrice is known
 * Returns { profit: number, hasEstimatedCost: boolean }
 */
export function calculateProfit(
  items: Array<{
    quantity: number;
    unitPrice: number;
    purchasePrice?: number;
    discountPercent?: number;
  }>
): { profit: number; hasCostData: boolean; totalRevenue: number; totalCost: number } {
  let totalRevenue = 0;
  let totalCost = 0;
  let hasCostData = false;

  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const lineRev = calculateLineTotal(qty, item.unitPrice, item.discountPercent || 0);
    totalRevenue += lineRev;

    if (item.purchasePrice !== undefined && item.purchasePrice !== null && item.purchasePrice >= 0) {
      totalCost += qty * item.purchasePrice;
      hasCostData = true;
    }
  }

  const profit = roundCurrency(totalRevenue - totalCost);
  return {
    profit,
    hasCostData,
    totalRevenue: roundCurrency(totalRevenue),
    totalCost: roundCurrency(totalCost),
  };
}

/**
 * Calculate inventory valuation:
 * - at purchase value (Coût d'achat du stock)
 * - at retail value (Valeur marchande potentielle)
 */
export function calculateStockValue(products: Product[]): {
  purchaseValue: number;
  sellingValue: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
} {
  let purchaseValue = 0;
  let sellingValue = 0;
  let totalUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const p of products) {
    const qty = Number(p.stockQuantity) || 0;
    const pPrice = Number(p.purchasePrice) || 0;
    const sPrice = Number(p.sellingPrice) || 0;
    const minAlert = Number(p.minStockAlert) || 0;

    if (qty <= 0) {
      outOfStockCount++;
    } else if (qty <= minAlert) {
      lowStockCount++;
    }

    if (qty > 0) {
      totalUnits += qty;
      purchaseValue += qty * pPrice;
      sellingValue += qty * sPrice;
    }
  }

  return {
    purchaseValue: roundCurrency(purchaseValue),
    sellingValue: roundCurrency(sellingValue),
    totalUnits,
    lowStockCount,
    outOfStockCount,
  };
}
