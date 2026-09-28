/**
 * StockFacture Pro - Phase 5 Financial Reports & Cash Register Closure Engine
 * Comprehensive business intelligence metrics:
 * - Real profit margins (gross profit, margin rate, markup rate)
 * - Cost of Goods Sold (COGS / CMP)
 * - Average basket per transaction
 * - Payment methods breakdown
 * - Top performing and most profitable products
 * - Daily Cash Register Closure (Rapport Z de caisse) and drawer difference detection
 */

import { Invoice, PaymentRecord, Product, PaymentMethod, CashRegisterClosure } from '../types';
import { roundCurrency } from './calculations';

export interface FinancialMetrics {
  totalBilled: number; // CA Facturé
  totalCollected: number; // CA Encaissé
  totalReceivables: number; // Solde restant dû (créances)
  transactionsCount: number; // Nombre de ventes / factures
  itemsSoldTotal: number; // Nombre total d'unités d'articles vendues
  averageBasket: number; // Panier moyen
  totalCostOfGoodsSold: number; // Coût d'achat total des marchandises vendues (COGS)
  grossProfit: number; // Marge Brute Réelle (CA Facturé - COGS)
  marginRate: number; // Taux de marge brute (%) : (Marge / CA) * 100
  markupRate: number; // Taux de marque / coefficient multiplicateur (%) : (Marge / Coût) * 100
}

/**
 * Calculates comprehensive financial metrics for a set of invoices
 */
export function calculateFinancialMetrics(invoices: Invoice[]): FinancialMetrics {
  const activeInvoices = invoices.filter((i) => i.status !== 'cancelled');

  let totalBilled = 0;
  let totalCollected = 0;
  let totalReceivables = 0;
  let itemsSoldTotal = 0;
  let totalCostOfGoodsSold = 0;

  for (const inv of activeInvoices) {
    totalBilled += inv.total;
    totalCollected += inv.amountPaid;
    totalReceivables += inv.remainingAmount;

    for (const item of inv.items) {
      itemsSoldTotal += item.quantity;
      const costPerUnit = item.purchasePrice ?? 0;
      totalCostOfGoodsSold += costPerUnit * item.quantity;
    }
  }

  totalBilled = roundCurrency(totalBilled);
  totalCollected = roundCurrency(totalCollected);
  totalReceivables = roundCurrency(totalReceivables);
  totalCostOfGoodsSold = roundCurrency(totalCostOfGoodsSold);

  const transactionsCount = activeInvoices.length;
  const averageBasket = transactionsCount > 0 ? roundCurrency(totalBilled / transactionsCount) : 0;
  const grossProfit = roundCurrency(totalBilled - totalCostOfGoodsSold);

  const marginRate = totalBilled > 0 ? Math.round((grossProfit / totalBilled) * 1000) / 10 : 0;
  const markupRate = totalCostOfGoodsSold > 0 ? Math.round((grossProfit / totalCostOfGoodsSold) * 1000) / 10 : 0;

  return {
    totalBilled,
    totalCollected,
    totalReceivables,
    transactionsCount,
    itemsSoldTotal,
    averageBasket,
    totalCostOfGoodsSold,
    grossProfit,
    marginRate,
    markupRate,
  };
}

export interface PaymentBreakdownItem {
  method: PaymentMethod;
  label: string;
  total: number;
  percentage: number;
  count: number;
}

/**
 * Calculates breakdown of sales and collections per payment method
 */
export function calculatePaymentBreakdown(payments: PaymentRecord[]): PaymentBreakdownItem[] {
  const map = new Map<PaymentMethod, { total: number; count: number }>();
  let grandTotal = 0;

  const METHOD_LABELS: Record<PaymentMethod, string> = {
    cash: 'Espèces',
    mobile_money: 'Mobile Money',
    card: 'Carte bancaire',
    bank_transfer: 'Virement bancaire',
    check: 'Chèque',
    other: 'Autre mode',
  };

  for (const p of payments) {
    const existing = map.get(p.method) || { total: 0, count: 0 };
    existing.total += p.amount;
    existing.count += 1;
    grandTotal += p.amount;
    map.set(p.method, existing);
  }

  const result: PaymentBreakdownItem[] = [];
  for (const [method, stats] of map.entries()) {
    const percentage = grandTotal > 0 ? Math.round((stats.total / grandTotal) * 1000) / 10 : 0;
    result.push({
      method,
      label: METHOD_LABELS[method] || method,
      total: roundCurrency(stats.total),
      percentage,
      count: stats.count,
    });
  }

  return result.sort((a, b) => b.total - a.total);
}

export interface ProductPerformance {
  productId?: string;
  designation: string;
  reference?: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginRate: number;
}

/**
 * Computes performance rankings for products (by revenue, volume, and profitability)
 */
export function calculateProductPerformances(invoices: Invoice[]): ProductPerformance[] {
  const map = new Map<string, ProductPerformance>();

  for (const inv of invoices) {
    if (inv.status === 'cancelled') continue;

    for (const item of inv.items) {
      const key = item.productId || item.designation.toLowerCase().trim();
      const existing = map.get(key) || {
        productId: item.productId,
        designation: item.designation,
        reference: item.reference,
        unitsSold: 0,
        revenue: 0,
        cost: 0,
        grossProfit: 0,
        marginRate: 0,
      };

      const itemCost = (item.purchasePrice || 0) * item.quantity;
      existing.unitsSold += item.quantity;
      existing.revenue += item.total;
      existing.cost += itemCost;
      existing.grossProfit += item.total - itemCost;

      map.set(key, existing);
    }
  }

  const list = Array.from(map.values()).map((p) => {
    const revenue = roundCurrency(p.revenue);
    const cost = roundCurrency(p.cost);
    const grossProfit = roundCurrency(p.grossProfit);
    const marginRate = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;
    return {
      ...p,
      revenue,
      cost,
      grossProfit,
      marginRate,
    };
  });

  return list.sort((a, b) => b.revenue - a.revenue);
}

export interface CashClosureCalculation {
  openingCash: number;
  cashSales: number;
  mobileMoneySales: number;
  cardSales: number;
  otherSales: number;
  totalSales: number;
  transactionsCount: number;
  expectedCashInDrawer: number;
  actualCashInDrawer: number;
  cashDifference: number;
  status: 'balanced' | 'surplus' | 'shortage';
}

/**
 * Calculates theoretical day closure metrics and drawer difference (Rapport Z de caisse)
 */
export function calculateCashClosure(
  targetDate: string,
  payments: PaymentRecord[],
  invoices: Invoice[],
  openingCash: number = 0,
  actualCashInDrawer: number = 0
): CashClosureCalculation {
  // Payments recorded on this date
  const dayPayments = payments.filter((p) => p.date === targetDate);
  const dayInvoices = invoices.filter((i) => i.date === targetDate && i.status !== 'cancelled');

  let cashSales = 0;
  let mobileMoneySales = 0;
  let cardSales = 0;
  let otherSales = 0;

  for (const p of dayPayments) {
    if (p.method === 'cash') cashSales += p.amount;
    else if (p.method === 'mobile_money') mobileMoneySales += p.amount;
    else if (p.method === 'card') cardSales += p.amount;
    else otherSales += p.amount;
  }

  const totalSales = cashSales + mobileMoneySales + cardSales + otherSales;
  const expectedCashInDrawer = roundCurrency(openingCash + cashSales);
  const cashDifference = roundCurrency(actualCashInDrawer - expectedCashInDrawer);

  let status: CashClosureCalculation['status'] = 'balanced';
  if (cashDifference > 0) status = 'surplus';
  else if (cashDifference < 0) status = 'shortage';

  return {
    openingCash: roundCurrency(openingCash),
    cashSales: roundCurrency(cashSales),
    mobileMoneySales: roundCurrency(mobileMoneySales),
    cardSales: roundCurrency(cardSales),
    otherSales: roundCurrency(otherSales),
    totalSales: roundCurrency(totalSales),
    transactionsCount: dayInvoices.length,
    expectedCashInDrawer,
    actualCashInDrawer: roundCurrency(actualCashInDrawer),
    cashDifference,
    status,
  };
}
