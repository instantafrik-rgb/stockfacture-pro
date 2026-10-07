/**
 * StockFacture Pro - Phase 4 Receivables & Debt Recovery Engine
 * Functions for aging balances, overdue detection, reminder messaging, and client debt aggregation.
 */

import { Invoice } from '../types';
import { roundCurrency } from './calculations';

export interface AgingCategory {
  label: string;
  amount: number;
  count: number;
}

export interface AgingReport {
  notDue: AgingCategory; // Échéance future
  overdue1to30: AgingCategory; // 1 à 30 jours de retard
  overdue31to60: AgingCategory; // 31 à 60 jours de retard
  overdueOver60: AgingCategory; // Plus de 60 jours de retard (critique)
  totalDue: number;
  totalOverdue: number;
  totalInvoicesCount: number;
}

/**
 * Calculates days difference between reference date (defaults to today) and target date
 * Returns positive if target is in the past (overdue), negative if target is in the future.
 */
export function getDaysDifference(targetDateStr: string, referenceDateStr?: string): number {
  const ref = referenceDateStr ? new Date(referenceDateStr) : new Date();
  ref.setHours(0, 0, 0, 0);

  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);

  const diffTime = ref.getTime() - target.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Checks if an invoice is overdue
 */
export function isInvoiceOverdue(invoice: Invoice, referenceDateStr?: string): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return false;
  if (invoice.remainingAmount <= 0) return false;
  return getDaysDifference(invoice.dueDate, referenceDateStr) > 0;
}

/**
 * Computes the Aging Balance (Balance Âgée) across open invoices
 */
export function calculateAgingBalance(invoices: Invoice[], referenceDateStr?: string): AgingReport {
  const report: AgingReport = {
    notDue: { label: 'Non échues', amount: 0, count: 0 },
    overdue1to30: { label: '1 - 30 jours', amount: 0, count: 0 },
    overdue31to60: { label: '31 - 60 jours', amount: 0, count: 0 },
    overdueOver60: { label: '> 60 jours', amount: 0, count: 0 },
    totalDue: 0,
    totalOverdue: 0,
    totalInvoicesCount: 0,
  };

  for (const inv of invoices) {
    // Only consider unpaid or partial invoices that are not cancelled
    if (inv.status === 'paid' || inv.status === 'cancelled' || inv.remainingAmount <= 0) {
      continue;
    }

    const dueAmount = inv.remainingAmount;
    const daysOverdue = getDaysDifference(inv.dueDate, referenceDateStr);

    report.totalDue += dueAmount;
    report.totalInvoicesCount += 1;

    if (daysOverdue <= 0) {
      report.notDue.amount += dueAmount;
      report.notDue.count += 1;
    } else {
      report.totalOverdue += dueAmount;
      if (daysOverdue <= 30) {
        report.overdue1to30.amount += dueAmount;
        report.overdue1to30.count += 1;
      } else if (daysOverdue <= 60) {
        report.overdue31to60.amount += dueAmount;
        report.overdue31to60.count += 1;
      } else {
        report.overdueOver60.amount += dueAmount;
        report.overdueOver60.count += 1;
      }
    }
  }

  report.totalDue = roundCurrency(report.totalDue);
  report.totalOverdue = roundCurrency(report.totalOverdue);
  report.notDue.amount = roundCurrency(report.notDue.amount);
  report.overdue1to30.amount = roundCurrency(report.overdue1to30.amount);
  report.overdue31to60.amount = roundCurrency(report.overdue31to60.amount);
  report.overdueOver60.amount = roundCurrency(report.overdueOver60.amount);

  return report;
}

/**
 * Aggregates receivables per debtor client
 */
export interface ClientReceivableSummary {
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  totalRemaining: number;
  invoicesCount: number;
  oldestDueDate: string;
  hasOverdue: boolean;
  maxDaysOverdue: number;
}

export function groupReceivablesByClient(invoices: Invoice[], referenceDateStr?: string): ClientReceivableSummary[] {
  const map = new Map<string, ClientReceivableSummary>();

  for (const inv of invoices) {
    if (inv.status === 'paid' || inv.status === 'cancelled' || inv.remainingAmount <= 0) {
      continue;
    }

    const key = inv.clientId || inv.clientName.trim().toLowerCase();
    const daysOverdue = getDaysDifference(inv.dueDate, referenceDateStr);

    if (!map.has(key)) {
      map.set(key, {
        clientId: inv.clientId,
        clientName: inv.clientName,
        clientPhone: inv.clientPhone,
        totalRemaining: inv.remainingAmount,
        invoicesCount: 1,
        oldestDueDate: inv.dueDate,
        hasOverdue: daysOverdue > 0,
        maxDaysOverdue: Math.max(0, daysOverdue),
      });
    } else {
      const item = map.get(key)!;
      item.totalRemaining += inv.remainingAmount;
      item.invoicesCount += 1;
      if (new Date(inv.dueDate) < new Date(item.oldestDueDate)) {
        item.oldestDueDate = inv.dueDate;
      }
      if (daysOverdue > 0) {
        item.hasOverdue = true;
      }
      if (daysOverdue > item.maxDaysOverdue) {
        item.maxDaysOverdue = daysOverdue;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalRemaining - a.totalRemaining);
}

/**
 * Generates an empathetic and professional payment reminder text
 */
export function generatePaymentReminderMessage(
  invoice: Invoice,
  companyName: string,
  currency: string,
  options?: { tone?: 'courteous' | 'firm' | 'urgent' }
): string {
  const tone = options?.tone || 'courteous';
  const clientName = invoice.clientName || 'Cher client';
  const formattedAmount = `${invoice.remainingAmount.toLocaleString('fr-FR')} ${currency}`;

  if (tone === 'urgent') {
    return (
      `URGENT - RELANCE IMPAYÉ : Bonjour ${clientName}. Sauf erreur de notre part, la facture n° ${invoice.number} d'un montant de ${formattedAmount} auprès de ${companyName} est en dépassement d'échéance depuis le ${invoice.dueDate}. Merci de procéder sans délai à sa régularisation.`
    );
  }

  if (tone === 'firm') {
    return (
      `Bonjour ${clientName}, nous constatons que la facture n° ${invoice.number} (solde restant : ${formattedAmount}) arrivée à échéance le ${invoice.dueDate} n'a pas encore été réglée auprès de ${companyName}. Nous vous prions de bien vouloir régulariser ce paiement dans les meilleurs délais.`
    );
  }

  // Default courteous
  return (
    `Bonjour ${clientName}, petit rappel de la part de ${companyName} concernant la facture n° ${invoice.number} pour un solde restant de ${formattedAmount}, arrivée à échéance le ${invoice.dueDate}. Merci de nous contacter pour votre règlement.`
  );
}
