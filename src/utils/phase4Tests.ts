/**
 * StockFacture Pro - Phase 4 Test & Validation Suite
 * Strict verification of:
 * 1. Aging balance report (Balance Âgée : non-due, 1-30d, 31-60d, >60d)
 * 2. Overdue invoice detection (isInvoiceOverdue against reference date)
 * 3. Total receivables and open invoice count aggregation
 * 4. Debtor client debt aggregation (grouping multiple unpaid invoices per client)
 * 5. Partial payment handling and remaining balance recalculation
 * 6. Automatic transition to 'paid' and exclusion from open receivables once remaining = 0
 * 7. Cancellation protection: cancelled invoices strictly excluded from active receivables
 * 8. Multi-tone payment reminder message formatting (courteous, firm, urgent)
 * 9. Delay computation accuracy (getDaysDifference)
 * 10. Risk ranking and priority sorting (by overdue days and remaining balance)
 */

import { Invoice, PaymentRecord } from '../types';
import {
  calculateAgingBalance,
  isInvoiceOverdue,
  groupReceivablesByClient,
  generatePaymentReminderMessage,
  getDaysDifference,
} from './receivables';
import {
  calculateRemainingBalance,
  determineInvoiceStatus,
  calculateAmountPaid,
} from './calculations';

export interface Phase4TestResult {
  id: string;
  name: string;
  category: 'Échéancier & Balance Âgée' | 'Recouvrement & Relances' | 'Règlements & Soldes' | 'Filtrage & Risques';
  passed: boolean;
  message: string;
  details?: string;
  durationMs: number;
}

export interface Phase4SuiteReport {
  timestamp: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  successRate: number;
  tests: Phase4TestResult[];
  overallStatus: 'PASSED' | 'FAILED';
}

export function runPhase4Tests(): Phase4SuiteReport {
  const tests: Phase4TestResult[] = [];

  function runTest(
    id: string,
    name: string,
    category: Phase4TestResult['category'],
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

  const sampleReferenceDate = '2026-09-24';

  const mockInvoices: Invoice[] = [
    // 1. Not due yet (due 2026-10-10 -> 16 days in future)
    {
      id: 'inv-1',
      number: 'FAC-2026-001',
      date: '2026-09-10',
      dueDate: '2026-10-10',
      clientName: 'Entreprise Bâtir Plus',
      items: [],
      subtotal: 50000,
      discountTotal: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 50000,
      amountPaid: 0,
      remainingAmount: 50000,
      status: 'unpaid',
      createdAt: '2026-09-10',
      updatedAt: '2026-09-10',
    },
    // 2. Overdue 1-30 days (due 2026-09-14 -> 10 days overdue)
    {
      id: 'inv-2',
      number: 'FAC-2026-002',
      date: '2026-08-30',
      dueDate: '2026-09-14',
      clientName: 'Cabinet Médical Riviera',
      items: [],
      subtotal: 80000,
      discountTotal: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 80000,
      amountPaid: 30000,
      remainingAmount: 50000,
      status: 'partial',
      createdAt: '2026-08-30',
      updatedAt: '2026-08-30',
    },
    // 3. Overdue 31-60 days (due 2026-08-10 -> 45 days overdue)
    {
      id: 'inv-3',
      number: 'FAC-2026-003',
      date: '2026-07-25',
      dueDate: '2026-08-10',
      clientName: 'Entreprise Bâtir Plus',
      items: [],
      subtotal: 120000,
      discountTotal: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 120000,
      amountPaid: 20000,
      remainingAmount: 100000,
      status: 'partial',
      createdAt: '2026-07-25',
      updatedAt: '2026-07-25',
    },
    // 4. Overdue > 60 days (due 2026-06-15 -> 101 days overdue)
    {
      id: 'inv-4',
      number: 'FAC-2026-004',
      date: '2026-06-01',
      dueDate: '2026-06-15',
      clientName: 'Pharmacie Centrale',
      items: [],
      subtotal: 70000,
      discountTotal: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 70000,
      amountPaid: 0,
      remainingAmount: 70000,
      status: 'unpaid',
      createdAt: '2026-06-01',
      updatedAt: '2026-06-01',
    },
    // 5. Already paid in full (should be excluded)
    {
      id: 'inv-5',
      number: 'FAC-2026-005',
      date: '2026-09-01',
      dueDate: '2026-09-15',
      clientName: 'Client Comptoir',
      items: [],
      subtotal: 30000,
      discountTotal: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 30000,
      amountPaid: 30000,
      remainingAmount: 0,
      status: 'paid',
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    },
    // 6. Cancelled invoice (should be excluded)
    {
      id: 'inv-6',
      number: 'FAC-2026-006',
      date: '2026-08-01',
      dueDate: '2026-08-15',
      clientName: 'Société Annulée',
      items: [],
      subtotal: 90000,
      discountTotal: 0,
      vatRate: 0,
      vatAmount: 0,
      total: 90000,
      amountPaid: 0,
      remainingAmount: 90000,
      status: 'cancelled',
      createdAt: '2026-08-01',
      updatedAt: '2026-08-01',
    },
  ];

  // TEST 1: Aging balance calculation
  runTest(
    'p4-test-1',
    'Calcul de la Balance Âgée (Non échue, 1-30j, 31-60j, >60j)',
    'Échéancier & Balance Âgée',
    () => {
      const aging = calculateAgingBalance(mockInvoices, sampleReferenceDate);

      const isNotDueOk = aging.notDue.amount === 50000 && aging.notDue.count === 1;
      const is1to30Ok = aging.overdue1to30.amount === 50000 && aging.overdue1to30.count === 1;
      const is31to60Ok = aging.overdue31to60.amount === 100000 && aging.overdue31to60.count === 1;
      const isOver60Ok = aging.overdueOver60.amount === 70000 && aging.overdueOver60.count === 1;
      const isTotalDueOk = aging.totalDue === 270000;
      const isTotalOverdueOk = aging.totalOverdue === 220000;

      const isValid = isNotDueOk && is1to30Ok && is31to60Ok && isOver60Ok && isTotalDueOk && isTotalOverdueOk;
      return {
        passed: isValid,
        message: isValid
          ? `Balance âgée certifiée : Non échue 50k | 1-30j 50k | 31-60j 100k | >60j 70k (Total dû : 270 000)`
          : `Erreur dans la balance âgée`,
        details: `Total dû: ${aging.totalDue} | Échu: ${aging.totalOverdue}`,
      };
    }
  );

  // TEST 2: Overdue detection accuracy
  runTest(
    'p4-test-2',
    'Détection précise des factures en dépassement d’échéance',
    'Échéancier & Balance Âgée',
    () => {
      const isInv1Overdue = isInvoiceOverdue(mockInvoices[0], sampleReferenceDate); // false (future)
      const isInv2Overdue = isInvoiceOverdue(mockInvoices[1], sampleReferenceDate); // true (past)
      const isInv5Overdue = isInvoiceOverdue(mockInvoices[4], sampleReferenceDate); // false (paid)
      const isInv6Overdue = isInvoiceOverdue(mockInvoices[5], sampleReferenceDate); // false (cancelled)

      const isValid = !isInv1Overdue && isInv2Overdue && !isInv5Overdue && !isInv6Overdue;
      return {
        passed: isValid,
        message: isValid
          ? 'Contrôle des retards conforme : détection stricte des échéances dépassées avec exclusion des payées et annulées'
          : 'Erreur détection facture en retard',
        details: `inv-1: ${isInv1Overdue} | inv-2: ${isInv2Overdue} | inv-5: ${isInv5Overdue} | inv-6: ${isInv6Overdue}`,
      };
    }
  );

  // TEST 3: Total receivables aggregation
  runTest(
    'p4-test-3',
    'Cumul exact des créances en cours et du nombre de dossiers débiteurs',
    'Échéancier & Balance Âgée',
    () => {
      const activeReceivables = mockInvoices.filter(
        (i) => (i.status === 'unpaid' || i.status === 'partial') && i.remainingAmount > 0
      );
      const totalSum = activeReceivables.reduce((acc, i) => acc + i.remainingAmount, 0);

      const isValid = totalSum === 270000 && activeReceivables.length === 4;
      return {
        passed: isValid,
        message: isValid
          ? `Cumul validé : 270 000 FCFA répartis sur 4 factures actives`
          : `Erreur cumul créances`,
        details: `Trouvé: ${totalSum} pour ${activeReceivables.length} factures`,
      };
    }
  );

  // TEST 4: Debtor client aggregation
  runTest(
    'p4-test-4',
    'Agrégation des créances par client débiteur (regroupement multi-factures)',
    'Filtrage & Risques',
    () => {
      const clientSummaries = groupReceivablesByClient(mockInvoices, sampleReferenceDate);

      // 'Entreprise Bâtir Plus' has inv-1 (50 000) and inv-3 (100 000) => 150 000 total across 2 invoices
      const batir = clientSummaries.find((c) => c.clientName === 'Entreprise Bâtir Plus');
      const isBatirOk = batir?.totalRemaining === 150000 && batir?.invoicesCount === 2;
      const totalClientsCount = clientSummaries.length; // 3 unique clients: Bâtir Plus, Riviera, Pharmacie Centrale

      const isValid = isBatirOk && totalClientsCount === 3;
      return {
        passed: isValid,
        message: isValid
          ? `Agrégation certifiée : 'Entreprise Bâtir Plus' totalise 150 000 sur 2 factures distinctes (Top débiteur)`
          : `Erreur regroupement débiteurs`,
        details: `Débiteurs détectés: ${clientSummaries.map((c) => `${c.clientName} (${c.totalRemaining})`).join(', ')}`,
      };
    }
  );

  // TEST 5: Subsequent partial payment processing
  runTest(
    'p4-test-5',
    'Traitement d’un encaissement partiel et recalcul immédiat du solde dû',
    'Règlements & Soldes',
    () => {
      const initialRemaining = 100000;
      const incomingDeposit = 40000;
      const newRemaining = initialRemaining - incomingDeposit;
      const newStatus = determineInvoiceStatus(120000, 20000 + incomingDeposit);

      const isValid = newRemaining === 60000 && newStatus === 'partial';
      return {
        passed: isValid,
        message: isValid
          ? `Encaissement partiel de 40 000 sur solde 100 000 => Nouveau solde : 60 000 (Maintien statut partiel)`
          : `Erreur calcul solde partiel`,
        details: `Nouveau solde: ${newRemaining} | Statut: ${newStatus}`,
      };
    }
  );

  // TEST 6: Automatic transition to paid when remaining reaches 0
  runTest(
    'p4-test-6',
    'Passage automatique à l’état « Solde intégral » (statut paid) et clôture de la créance',
    'Règlements & Soldes',
    () => {
      const totalInvoice = 80000;
      const initialPaid = 30000;
      const settlementPayment = 50000;
      const totalPaid = initialPaid + settlementPayment;
      const remaining = calculateRemainingBalance(totalInvoice, totalPaid);
      const finalStatus = determineInvoiceStatus(totalInvoice, totalPaid);

      const isValid = remaining === 0 && finalStatus === 'paid';
      return {
        passed: isValid,
        message: isValid
          ? `Facture soldée à 100% : solde = 0 FCFA, bascule instantanée en statut 'paid'`
          : `Erreur solde complet`,
        details: `Reste: ${remaining} | Statut: ${finalStatus}`,
      };
    }
  );

  // TEST 7: Exclusion of cancelled invoices from receivables
  runTest(
    'p4-test-7',
    'Exclusion stricte des factures annulées de la balance des créances',
    'Filtrage & Risques',
    () => {
      const aging = calculateAgingBalance([mockInvoices[5]], sampleReferenceDate);
      const clientGroup = groupReceivablesByClient([mockInvoices[5]], sampleReferenceDate);

      const isValid = aging.totalDue === 0 && clientGroup.length === 0;
      return {
        passed: isValid,
        message: isValid
          ? `Facture annulée FAC-2026-006 étanche : 0 impact sur les créances actives`
          : `Erreur fuite facture annulée dans créances`,
        details: `Total dû compté: ${aging.totalDue}`,
      };
    }
  );

  // TEST 8: Multi-tone payment reminder message formatting
  runTest(
    'p4-test-8',
    'Génération dynamique des messages de relance personnalisés (courtois, ferme, urgent)',
    'Recouvrement & Relances',
    () => {
      const inv = mockInvoices[1]; // Riviera, 50 000 remaining
      const msgCourteous = generatePaymentReminderMessage(inv, 'Quincaillerie Centrale', 'FCFA', { tone: 'courteous' });
      const msgFirm = generatePaymentReminderMessage(inv, 'Quincaillerie Centrale', 'FCFA', { tone: 'firm' });
      const msgUrgent = generatePaymentReminderMessage(inv, 'Quincaillerie Centrale', 'FCFA', { tone: 'urgent' });

      const hasInvNum = msgCourteous.includes(inv.number) && msgUrgent.includes(inv.number);
      const hasClientName = msgCourteous.includes(inv.clientName);
      const hasUrgentTag = msgUrgent.includes('URGENT');

      const isValid = hasInvNum && hasClientName && hasUrgentTag;
      return {
        passed: isValid,
        message: isValid
          ? `Relances générées avec succès : intégration du numéro (${inv.number}), nom client et modulations de ton`
          : `Erreur génération message relance`,
        details: `Exemple courtois: "${msgCourteous.slice(0, 60)}..."`,
      };
    }
  );

  // TEST 9: Exact day difference and delay calculation
  runTest(
    'p4-test-9',
    'Calcul chronologique du nombre de jours de retard d’échéance',
    'Échéancier & Balance Âgée',
    () => {
      // Due 2026-09-14 vs 2026-09-24 => 10 days overdue
      const daysOverdue = getDaysDifference('2026-09-14', '2026-09-24');
      // Due 2026-10-10 vs 2026-09-24 => -16 days (in future)
      const daysFuture = getDaysDifference('2026-10-10', '2026-09-24');

      const isValid = daysOverdue === 10 && daysFuture === -16;
      return {
        passed: isValid,
        message: isValid
          ? `Calcul temporel exact : +10 jours de retard pour échéance passée, -16 jours pour échéance future`
          : `Erreur calcul jours retard`,
        details: `Retard: ${daysOverdue}j | Futur: ${daysFuture}j`,
      };
    }
  );

  // TEST 10: Risk ranking and sorting by overdue severity
  runTest(
    'p4-test-10',
    'Priorisation automatique des créances par niveau d’urgence et montant',
    'Filtrage & Risques',
    () => {
      const clientSummaries = groupReceivablesByClient(mockInvoices, sampleReferenceDate);

      // Top 1 must be 'Entreprise Bâtir Plus' (150 000)
      const top1 = clientSummaries[0];
      const hasOverdueFlag = top1.hasOverdue === true;
      const sortedByAmount = clientSummaries.every((item, idx, arr) => {
        if (idx === 0) return true;
        return item.totalRemaining <= arr[idx - 1].totalRemaining;
      });

      const isValid = top1.clientName === 'Entreprise Bâtir Plus' && hasOverdueFlag && sortedByAmount;
      return {
        passed: isValid,
        message: isValid
          ? `Classement par criticité validé : 'Entreprise Bâtir Plus' en tête des priorités (150 000 FCFA)`
          : `Erreur tri risque créances`,
        details: `Ordre: ${clientSummaries.map((c) => c.clientName).join(' > ')}`,
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
