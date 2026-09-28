import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  FileText,
  Send,
  XCircle,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { InvoiceStatus, QuoteStatus } from '../../types';

interface StatusBadgeProps {
  status: InvoiceStatus | QuoteStatus | 'in' | 'out' | 'adjustment' | 'low' | 'out_of_stock' | 'in_stock';
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', size = 'sm' }) => {
  let label = '';
  let colorStyles = '';
  let Icon: React.ComponentType<{ className?: string }> = CheckCircle2;

  switch (status) {
    // Invoices
    case 'paid':
      label = 'Payée';
      colorStyles = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      Icon = CheckCircle2;
      break;
    case 'partial':
      label = 'Partielle';
      colorStyles = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      Icon = Clock;
      break;
    case 'unpaid':
      label = 'Impayée';
      colorStyles = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      Icon = AlertCircle;
      break;
    case 'cancelled':
      label = 'Annulée';
      colorStyles = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      Icon = Ban;
      break;
    case 'draft':
      label = 'Brouillon';
      colorStyles = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      Icon = FileText;
      break;

    // Quotes
    case 'sent':
      label = 'Envoyé';
      colorStyles = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      Icon = Send;
      break;
    case 'accepted':
      label = 'Accepté';
      colorStyles = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      Icon = Check;
      break;
    case 'rejected':
      label = 'Refusé';
      colorStyles = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      Icon = XCircle;
      break;
    case 'expired':
      label = 'Expiré';
      colorStyles = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      Icon = Clock;
      break;
    case 'converted':
      label = 'Converti en facture';
      colorStyles = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      Icon = CheckCircle2;
      break;

    // Stock Movement Types
    case 'in':
      label = 'Entrée';
      colorStyles = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      Icon = ArrowDownLeft;
      break;
    case 'out':
      label = 'Sortie';
      colorStyles = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      Icon = ArrowUpRight;
      break;
    case 'adjustment':
      label = 'Ajustement';
      colorStyles = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      Icon = RefreshCw;
      break;

    // Stock Availability
    case 'low':
      label = 'Stock Faible';
      colorStyles = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      Icon = AlertTriangle;
      break;
    case 'out_of_stock':
      label = 'Rupture';
      colorStyles = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      Icon = AlertCircle;
      break;
    case 'in_stock':
      label = 'En stock';
      colorStyles = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      Icon = CheckCircle2;
      break;

    default:
      label = status;
      colorStyles = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }

  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-2 py-0.5 gap-1' 
    : 'text-xs px-2.5 py-1 gap-1.5';

  const iconSizeClass = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-md border shrink-0 ${sizeClasses} ${colorStyles} ${className}`}
    >
      <Icon className={iconSizeClass} />
      <span>{label}</span>
    </span>
  );
};
