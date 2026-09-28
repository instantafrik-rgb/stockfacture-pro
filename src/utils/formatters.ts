/**
 * StockFacture Pro - Formatting Utilities (Currency, Dates, Numbers)
 */

import { CurrencyPosition } from '../types';

/**
 * Format currency according to business settings
 * e.g. "100 000 FCFA" or "FCFA 100 000"
 */
export function formatCurrency(
  amount: number | undefined | null,
  currency: string = 'FCFA',
  position: CurrencyPosition = 'after'
): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const isInteger = Number.isInteger(absNum);
  
  // Format with standard ASCII space separator (never \u202F or \u00A0 which jsPDF turns into /)
  const rounded = isInteger ? Math.round(absNum).toString() : absNum.toFixed(2);
  const [intPart, decPart] = rounded.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const formattedNumber = (isNegative ? '-' : '') + (decPart ? `${formattedInt},${decPart}` : formattedInt);

  if (position === 'before') {
    return `${currency} ${formattedNumber}`;
  }
  return `${formattedNumber} ${currency}`;
}

/**
 * Format date for display: "24 sept. 2026"
 */
export function formatDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

/**
 * Format date with time: "24 sept. 2026 à 14:30"
 */
export function formatDateTime(dateStr: string | Date | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

/**
 * Format relative date (e.g. "Aujourd'hui", "Hier", "Il y a 3 jours")
 */
export function formatRelativeDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return formatDate(dateStr);
  } catch {
    return formatDate(dateStr);
  }
}

/**
 * Format ISO current date for date input: YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate sequential invoice or quote number
 * e.g. generateDocumentNumber("FAC-2026-", 42) -> "FAC-2026-0042"
 */
export function generateDocumentNumber(prefix: string, nextNumber: number, padLength: number = 4): string {
  const padded = String(nextNumber).padStart(padLength, '0');
  return `${prefix}${padded}`;
}

/**
 * Payment method label & color in French
 */
export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'cash':
      return 'Espèces';
    case 'mobile_money':
      return 'Mobile Money';
    case 'bank_transfer':
      return 'Virement bancaire';
    case 'card':
      return 'Carte bancaire';
    case 'check':
      return 'Chèque';
    default:
      return 'Autre';
  }
}

/**
 * Stock movement reason label in French
 */
export function getStockReasonLabel(reason: string): string {
  switch (reason) {
    case 'purchase':
      return 'Entrée';
    case 'sale':
      return 'Vente';
    case 'donation':
      return 'Don';
    case 'defective':
      return 'Article défectueux';
    case 'loss':
      return 'Perte';
    case 'breakage':
      return 'Article défectueux';
    case 'customer_return':
      return 'Retour client';
    case 'theft':
      return 'Perte';
    case 'correction':
      return 'Ajustement';
    default:
      return 'Autre';
  }
}
