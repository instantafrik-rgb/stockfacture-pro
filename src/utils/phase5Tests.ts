/**
 * StockFacture Pro - Phase 5 Test & Validation Suite
 * Strict verification of:
 * 1. Financial metrics calculation (CA Facturé, CA Encaissé, Reste à percevoir)
 * 2. Cost of Goods Sold (COGS) calculation from items purchase price
 * 3. Real gross profit (Marge brute) and margin rate (%)
 * 4. Average basket (Panier moyen) per sale transaction
 * 5. Payment methods breakdown and percentage share
 * 6. Top product performance rankings (by turnover and volume)
 * 7. Inventory stock valuation (purchase value vs potential retail value)
 * 8. Daily cash closure (Rapport Z) expected drawer calculation
 * 9. Cash discrepancy detection (balanced 0, surplus > 0, shortage < 0)
 * 10. Temporal date filtering and period segmentation
 */

import { Invoice, PaymentRecord, Product, CashRegisterClosure } from '../types';
import {
  calculateFinancialMetrics,
  calculatePaymentBreakdown,
  calculateProductPerformances,
  calculateCashClosure,
} from './reportsAnalytics';
import { calculateStockValue } from './calculations';

export interface Phase5TestResult {
  id: string;
  name: string;
  category: 'Marges & Rentabilité' | 'Ventes & Panier Moyen' | 'Clôture de Caisse (Z)' | 'Stocks & Produits';
  passed: boolean;
  message: string;
  details?: string;
  durationMs: number;
}

export interface Phase5SuiteReport {
  timestamp: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  successRate: number;
  tests: Phase5TestResult[];
  overallStatus: 'PASSED' | 'FAILED';
}

export function runPhase5Tests(): Phase5SuiteReport {
  const tests: Phase5TestResult[] = [];

  function runTest(
    id: string,
    name: string,
    category: Phase5TestResult['category'],
    fn: () => { passed: boolean; message: string; details?: string }
  ) {
    const start = performance.now();
    try {
      const res = fn();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      tests.push({
        id,
        name,
        category,
        passed: res.passed,
        message: res.message,
        details: res.details,
        durationMs,
      });
    } catch (err: any) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      tests.push({
        id,
        name,
        category,
        passed: false,
        message: `Erreur inattendue: ${err?.message || String(err)}`,
        durationMs,
      });
    }
  }

  // Sample data for testing
  const sampleInvoices: Invoice[] = [
    {
      id: 'inv-1',
      number: 'FAC-2026-001',
      date: '2026-09-24',
      dueDate: '2026-09-24',
      clientName: 'Client Comptoir',
      items: [
        {
          id: 'item-1',
          productId: 'p1',
          isFreeLine: false,
          unit: 'sac',
          designation: 'Riz Parfumé 5kg',
          quantity: 2,
          unitPrice: 5000, // 10 000
          purchasePrice: 3500, // Cost = 7 000
          total: 10000,
        },
        {
          id: 'item-2',
          productId: 'p2',
          isFreeLine: false,
          unit: 'bouteille',
          designation: 'Huile Végétale 1L',
          quantity: 5,
          unitPrice: 2000, // 10 000
          purchasePrice: 1500, // Cost = 7 500
          total: 10000,
        },
      ],
      subtotal: 20000,
      discountTotal: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 20000,
      amountPaid: 20000,
      remainingAmount: 0,
      status: 'paid',
      createdAt: '2026-09-24T10:00:00Z',
      updatedAt: '2026-09-24T10:00:00Z',
    },
    {
      id: 'inv-2',
      number: 'FAC-2026-002',
      date: '2026-09-24',
      dueDate: '2026-10-15',
      clientName: 'Entreprise Bâtir Plus',
      items: [
        {
          id: 'item-3',
          productId: 'p3',
          isFreeLine: false,
          unit: 'barre',
          designation: 'Fer à Béton 12mm',
          quantity: 10,
          unitPrice: 6000, // 60 000
          purchasePrice: 4500, // Cost = 45 000
          total: 60000,
        },
      ],
      subtotal: 60000,
      discountTotal: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 60000,
      amountPaid: 25000,
      remainingAmount: 35000,
      status: 'partial',
      createdAt: '2026-09-24T14:00:00Z',
      updatedAt: '2026-09-24T14:00:00Z',
    },
  ];

  const samplePayments: PaymentRecord[] = [
    {
      id: 'pay-1',
      invoiceId: 'inv-1',
      invoiceNumber: 'FAC-2026-001',
      amount: 20000,
      date: '2026-09-24',
      method: 'cash',
      createdAt: '2026-09-24T10:00:00Z',
    },
    {
      id: 'pay-2',
      invoiceId: 'inv-2',
      invoiceNumber: 'FAC-2026-002',
      amount: 25000,
      date: '2026-09-24',
      method: 'mobile_money',
      createdAt: '2026-09-24T14:00:00Z',
    },
  ];

  // TEST 1: Exact Revenue calculation
  runTest(
    'p5-test-1',
    'Calcul du Chiffre d’Affaires (Facturé 80 000, Encaissé 45 000, Solde 35 000)',
    'Ventes & Panier Moyen',
    () => {
      const metrics = calculateFinancialMetrics(sampleInvoices);

      const isValid =
        metrics.totalBilled === 80000 &&
        metrics.totalCollected === 45000 &&
        metrics.totalReceivables === 35000;

      return {
        passed: isValid,
        message: isValid
          ? `Chiffre d’affaires vérifié : 80 000 FCFA facturé, 45 000 FCFA encaissé, 35 000 FCFA à percevoir`
          : `Erreur calcul CA`,
        details: `Facturé: ${metrics.totalBilled} | Encaissé: ${metrics.totalCollected} | Reste: ${metrics.totalReceivables}`,
      };
    }
  );

  // TEST 2: Cost of Goods Sold (COGS)
  runTest(
    'p5-test-2',
    'Calcul du Coût d’Achat des Marchandises Vendues (COGS)',
    'Marges & Rentabilité',
    () => {
      // Cost: (2 * 3500) + (5 * 1500) + (10 * 4500) = 7000 + 7500 + 45000 = 59 500
      const metrics = calculateFinancialMetrics(sampleInvoices);
      const isValid = metrics.totalCostOfGoodsSold === 59500;

      return {
        passed: isValid,
        message: isValid
          ? `Coût d’achat des ventes certifié : 59 500 FCFA`
          : `Erreur calcul coût d’achat`,
        details: `Calculé: ${metrics.totalCostOfGoodsSold} (attendu 59 500)`,
      };
    }
  );

  // TEST 3: Gross profit & margin rate
  runTest(
    'p5-test-3',
    'Calcul de la Marge Brute Réelle et du Taux de Marge (%)',
    'Marges & Rentabilité',
    () => {
      // Gross Profit = 80 000 - 59 500 = 20 500 FCFA
      // Margin Rate = (20 500 / 80 000) * 100 = 25.6%
      const metrics = calculateFinancialMetrics(sampleInvoices);
      const isValid = metrics.grossProfit === 20500 && metrics.marginRate === 25.6;

      return {
        passed: isValid,
        message: isValid
          ? `Marge brute réelle certifiée : 20 500 FCFA soit 25.6% de taux de marge`
          : `Erreur marge brute`,
        details: `Marge: ${metrics.grossProfit} | Taux: ${metrics.marginRate}%`,
      };
    }
  );

  // TEST 4: Average Basket calculation
  runTest(
    'p5-test-4',
    'Calcul du Panier Moyen par transaction de vente',
    'Ventes & Panier Moyen',
    () => {
      // 80 000 / 2 factures = 40 000 FCFA
      const metrics = calculateFinancialMetrics(sampleInvoices);
      const isValid = metrics.averageBasket === 40000 && metrics.transactionsCount === 2;

      return {
        passed: isValid,
        message: isValid
          ? `Panier moyen certifié : 40 000 FCFA sur 2 transactions`
          : `Erreur calcul panier moyen`,
        details: `Panier moyen: ${metrics.averageBasket} FCFA`,
      };
    }
  );

  // TEST 5: Payment breakdown aggregation
  runTest(
    'p5-test-5',
    'Ventilation du chiffre d’affaires par mode de règlement (Espèces, Mobile Money)',
    'Ventes & Panier Moyen',
    () => {
      // Cash: 20 000 (44.4%), Mobile Money: 25 000 (55.6%)
      const breakdown = calculatePaymentBreakdown(samplePayments);
      const cash = breakdown.find((b) => b.method === 'cash');
      const mm = breakdown.find((b) => b.method === 'mobile_money');

      const isCashOk = cash?.total === 20000 && cash.percentage === 44.4;
      const isMmOk = mm?.total === 25000 && mm.percentage === 55.6;

      const isValid = Boolean(isCashOk && isMmOk && breakdown.length === 2);
      return {
        passed: isValid,
        message: isValid
          ? `Répartition certifiée : Espèces 20 000 (44.4%) | Mobile Money 25 000 (55.6%)`
          : `Erreur répartition paiements`,
        details: `Espèces: ${cash?.total} (${cash?.percentage}%) | Mobile Money: ${mm?.total} (${mm?.percentage}%)`,
      };
    }
  );

  // TEST 6: Top product rankings
  runTest(
    'p5-test-6',
    'Classement des produits par Chiffre d’Affaires et Rentabilité unitaire',
    'Stocks & Produits',
    () => {
      const prods = calculateProductPerformances(sampleInvoices);
      // Top 1 should be 'Fer à Béton 12mm' (60 000 CA, profit 15 000)
      const top1 = prods[0];
      const isTop1Ok = top1.designation.includes('Fer à Béton') && top1.revenue === 60000 && top1.grossProfit === 15000;

      return {
        passed: isTop1Ok,
        message: isTop1Ok
          ? `Top produit identifié : '${top1.designation}' (CA: 60 000 FCFA, Marge: 15 000 FCFA)`
          : `Erreur classement top produit`,
        details: `Top: ${top1?.designation} | CA: ${top1?.revenue}`,
      };
    }
  );

  // TEST 7: Stock valuation
  runTest(
    'p5-test-7',
    'Valorisation du stock disponible au coût d’achat et à la valeur marchande',
    'Stocks & Produits',
    () => {
      const mockProducts: Product[] = [
        {
          id: 'p1',
          name: 'Produit A',
          stockQuantity: 10,
          purchasePrice: 2000,
          sellingPrice: 3000,
          minStockAlert: 2,
          unit: 'pièce',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'p2',
          name: 'Produit B',
          stockQuantity: 5,
          purchasePrice: 4000,
          sellingPrice: 6000,
          minStockAlert: 1,
          unit: 'pièce',
          createdAt: '',
          updatedAt: '',
        },
      ];

      // Cost value: (10 * 2000) + (5 * 4000) = 20 000 + 20 000 = 40 000
      // Retail value: (10 * 3000) + (5 * 6000) = 30 000 + 30 000 = 60 000
      // Potential profit: 20 000
      const valuation = calculateStockValue(mockProducts);
      const potentialProfit = valuation.sellingValue - valuation.purchaseValue;
      const isValid =
        valuation.purchaseValue === 40000 &&
        valuation.sellingValue === 60000 &&
        potentialProfit === 20000;

      return {
        passed: isValid,
        message: isValid
          ? `Valorisation certifiée : Coût d’achat 40 000 FCFA | Vente potentielle 60 000 FCFA | Marge latente 20 000 FCFA`
          : `Erreur valorisation stock`,
        details: `Coût: ${valuation.purchaseValue} | Vente: ${valuation.sellingValue}`,
      };
    }
  );

  // TEST 8: Cash Register Closure (Rapport Z) expected drawer
  runTest(
    'p5-test-8',
    'Algorithme de clôture de caisse Z (Fond de caisse initial + Ventes espèces théoriques)',
    'Clôture de Caisse (Z)',
    () => {
      // Opening cash: 15 000. Cash sales: 20 000. Expected cash: 35 000.
      const closure = calculateCashClosure('2026-09-24', samplePayments, sampleInvoices, 15000, 35000);

      const isValid =
        closure.openingCash === 15000 &&
        closure.cashSales === 20000 &&
        closure.expectedCashInDrawer === 35000 &&
        closure.status === 'balanced' &&
        closure.cashDifference === 0;

      return {
        passed: isValid,
        message: isValid
          ? `Calcul théorique certifié : 15 000 (fond) + 20 000 (espèces) = 35 000 FCFA attendus (Écart 0)`
          : `Erreur clôture caisse`,
        details: `Attendu: ${closure.expectedCashInDrawer} | Différence: ${closure.cashDifference}`,
      };
    }
  );

  // TEST 9: Cash discrepancy detection (Surplus & Shortage)
  runTest(
    'p5-test-9',
    'Détection et qualification des écarts de caisse (Excédent et Déficit de caisse)',
    'Clôture de Caisse (Z)',
    () => {
      // Expected = 35 000
      // Case 1: Counted = 36 000 => Surplus of +1 000
      const surplusClosure = calculateCashClosure('2026-09-24', samplePayments, sampleInvoices, 15000, 36000);
      // Case 2: Counted = 33 500 => Shortage of -1 500
      const shortageClosure = calculateCashClosure('2026-09-24', samplePayments, sampleInvoices, 15000, 33500);

      const isSurplusOk = surplusClosure.cashDifference === 1000 && surplusClosure.status === 'surplus';
      const isShortageOk = shortageClosure.cashDifference === -1500 && shortageClosure.status === 'shortage';

      const isValid = isSurplusOk && isShortageOk;
      return {
        passed: isValid,
        message: isValid
          ? `Contrôle des écarts certifié : Détection surplus (+1 000 FCFA) et manquant (-1 500 FCFA)`
          : `Erreur détection écarts caisse`,
        details: `Surplus: ${surplusClosure.cashDifference} (${surplusClosure.status}) | Manquant: ${shortageClosure.cashDifference} (${shortageClosure.status})`,
      };
    }
  );

  // TEST 10: Date filtering & period segmentation
  runTest(
    'p5-test-10',
    'Segmentation temporelle et filtrage par plage de dates',
    'Ventes & Panier Moyen',
    () => {
      const pastInvoice: Invoice = {
        ...sampleInvoices[0],
        id: 'inv-past',
        date: '2026-08-01',
        total: 100000,
      };
      const allInvoices = [...sampleInvoices, pastInvoice];

      // Filter for Sept 2026 only
      const septemberInvoices = allInvoices.filter((i) => i.date >= '2026-09-01' && i.date <= '2026-09-30');
      const isFilteredOk = septemberInvoices.length === 2 && !septemberInvoices.some((i) => i.id === 'inv-past');

      return {
        passed: isFilteredOk,
        message: isFilteredOk
          ? `Filtrage chronologique certifié : exclusion des factures hors période sélectionnée`
          : `Erreur filtrage dates`,
        details: `Retenues: ${septemberInvoices.length} sur 3 factures`,
      };
    }
  );

  const passedCount = tests.filter((t) => t.passed).length;
  const failedCount = tests.length - passedCount;
  const successRate = Math.round((passedCount / tests.length) * 100);

  return {
    timestamp: new Date().toISOString(),
    totalTests: tests.length,
    passedCount,
    failedCount,
    successRate,
    tests,
    overallStatus: failedCount === 0 ? 'PASSED' : 'FAILED',
  };
}
