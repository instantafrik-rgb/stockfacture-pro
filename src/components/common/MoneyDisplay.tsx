import React from 'react';
import { useApp } from '../../store/AppContext';
import { formatCurrency } from '../../utils/formatters';

interface MoneyDisplayProps {
  amount: number | undefined | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'muted';
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  amount,
  className = '',
  size = 'md',
  variant = 'default',
}) => {
  const { state } = useApp();
  const formatted = formatCurrency(amount, state.settings.currency, state.settings.currencyPosition);

  let sizeClass = 'text-sm font-semibold';
  if (size === 'sm') sizeClass = 'text-xs font-medium';
  if (size === 'lg') sizeClass = 'text-base font-bold';
  if (size === 'xl') sizeClass = 'text-xl font-bold tracking-tight';
  if (size === '2xl') sizeClass = 'text-2xl sm:text-3xl font-extrabold tracking-tight';

  let colorClass = 'text-slate-900 dark:text-white';
  if (variant === 'success') colorClass = 'text-emerald-600 dark:text-emerald-400';
  if (variant === 'danger') colorClass = 'text-rose-600 dark:text-rose-400';
  if (variant === 'warning') colorClass = 'text-amber-600 dark:text-amber-400';
  if (variant === 'muted') colorClass = 'text-slate-500 dark:text-slate-400';

  return (
    <span className={`tabular-nums font-mono ${sizeClass} ${colorClass} ${className}`}>
      {formatted}
    </span>
  );
};
