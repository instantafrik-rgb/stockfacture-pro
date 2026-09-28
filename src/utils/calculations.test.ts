/**
 * StockFacture Pro - Financial & Business Rules In-Code Test Runner
 */

import {
  calculateLineTotal,
  calculateSubtotal,
  calculateDiscountTotal,
  calculateTax,
  calculateInvoiceTotal,
  calculateAmountPaid,
  calculateRemainingBalance,
  determineInvoiceStatus,
  calculateProfit,
  calculateStockValue,
} from './calculations';
import { generateDocumentNumber } from './formatters';
import { Product, PaymentRecord } from '../types';

export function runBusinessRulesTests(): { passed: number; failed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      passed++;
      results.push(`✅ PASS: ${testName}`);
    } else {
      failed++;
      results.push(`❌ FAIL: ${testName}`);
    }
  }

  // 1. Line total with discount
  assert(calculateLineTotal(5, 10000, 10) === 45000, 'Calcul total ligne avec remise 10%');
  assert(calculateLineTotal(3, 1500, 0) === 4500, 'Calcul total ligne sans remise');

  // 2. Subtotal & Discount
  const items = [
    { quantity: 2, unitPrice: 5000, discountPercent: 0 },
    { quantity: 4, unitPrice: 2500, discountPercent: 10 },
  ];
  assert(calculateSubtotal(items) === 20000, 'Calcul sous-total brut');
  assert(calculateDiscountTotal(items) === 1000, 'Calcul remise cumulée');

  // 3. Tax / TVA
  assert(calculateTax(100000, 18, true) === 18000, 'Calcul TVA activée 18%');
  assert(calculateTax(100000, 18, false) === 0, 'Calcul TVA désactivée');

  // 4. Invoice Total
  assert(calculateInvoiceTotal(100000, 10000, 16200) === 106200, 'Calcul total facture final');

  // 5. Payments & Balances
  const payments: PaymentRecord[] = [
    { id: '1', invoiceId: 'inv-1', invoiceNumber: 'FAC-1', amount: 30000, date: '', method: 'cash', createdAt: '' },
    { id: '2', invoiceId: 'inv-1', invoiceNumber: 'FAC-1', amount: 20000, date: '', method: 'mobile_money', createdAt: '' },
  ];
  const paid = calculateAmountPaid(payments);
  assert(paid === 50000, 'Calcul cumul des versements reçus');
  assert(calculateRemainingBalance(100000, paid) === 50000, 'Calcul solde restant dû');

  // 6. Invoice Status
  assert(determineInvoiceStatus(100000, 0) === 'unpaid', 'Statut: non payée');
  assert(determineInvoiceStatus(100000, 40000) === 'partial', 'Statut: partiellement payée');
  assert(determineInvoiceStatus(100000, 100000) === 'paid', 'Statut: payée en totalité');
  assert(determineInvoiceStatus(100000, 50000, true) === 'cancelled', 'Statut: annulée');

  // 7. Profit
  const profitItems = [
    { quantity: 2, unitPrice: 15000, purchasePrice: 10000, discountPercent: 0 },
    { quantity: 1, unitPrice: 5000, purchasePrice: 2000, discountPercent: 0 },
  ];
  const profitRes = calculateProfit(profitItems);
  assert(profitRes.profit === 13000 && profitRes.hasCostData, 'Calcul marge commerciale estimée');

  // 8. Numbering
  assert(generateDocumentNumber('FAC-2026-', 1) === 'FAC-2026-0001', 'Numérotation séquentielle facture');
  assert(generateDocumentNumber('DEV-2026-', 42) === 'DEV-2026-0042', 'Numérotation séquentielle devis');

  // 9. Stock valuation
  const products: Product[] = [
    {
      id: '1',
      name: 'Riz',
      purchasePrice: 10000,
      sellingPrice: 15000,
      stockQuantity: 10,
      minStockAlert: 5,
      unit: 'sac',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      name: 'Huile',
      purchasePrice: 5000,
      sellingPrice: 7000,
      stockQuantity: 2,
      minStockAlert: 5,
      unit: 'bidon',
      createdAt: '',
      updatedAt: '',
    },
  ];
  const stockVal = calculateStockValue(products);
  assert(stockVal.purchaseValue === 110000, 'Valorisation stock achat');
  assert(stockVal.sellingValue === 164000, 'Valorisation stock vente');
  assert(stockVal.lowStockCount === 1, 'Détection alerte stock faible');

  return { passed, failed, results };
}
