import React from 'react';
import { ArrowRight, ShoppingCart } from 'lucide-react';

export interface MobileActionBarProps {
  total?: string | number;
  totalLabel?: string;
  itemCount?: number;
  primaryAction: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  children?: React.ReactNode;
  className?: string;
}

/**
 * MobileActionBar
 * Dedicated action bar docked securely ABOVE the bottom navigation bar on mobile.
 * Uses calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px)) to guarantee
 * that action buttons are NEVER hidden by the navigation.
 */
export const MobileActionBar: React.FC<MobileActionBarProps> = ({
  total,
  totalLabel = 'Total',
  itemCount,
  primaryAction,
  secondaryAction,
  children,
  className = '',
}) => {
  return (
    <div
      className={`fixed bottom-above-nav left-0 right-0 z-30 bg-white/98 dark:bg-[#131B2E]/98 backdrop-blur-md border-t border-[#E8EDF2] dark:border-[#22304E] shadow-[0_-4px_16px_rgba(20,33,61,0.06)] p-3 sm:p-4 transition-all md:relative md:bottom-auto md:z-10 md:border md:rounded-2xl md:shadow-md md:mt-4 ${className}`}
    >
      <div className="max-w-xl mx-auto flex flex-col gap-2.5">
        {children ? (
          children
        ) : (
          <>
            {/* Top row: Summary & Optional Secondary action */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  {totalLabel}
                  {itemCount !== undefined && (
                    <span className="font-normal lowercase ml-1">
                      ({itemCount} article{itemCount > 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                {total !== undefined && (
                  <div className="text-xl sm:text-2xl font-black font-financial text-[#14213D] dark:text-white leading-tight truncate">
                    {total}
                  </div>
                )}
              </div>

              {secondaryAction && (
                <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  className="px-3.5 py-2 rounded-xl bg-[#FAFAF8] dark:bg-slate-800 text-[#26354F] dark:text-slate-200 text-xs font-bold border border-[#E8EDF2] dark:border-slate-700 hover:bg-slate-100 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                >
                  {secondaryAction.icon}
                  <span>{secondaryAction.label}</span>
                </button>
              )}
            </div>

            {/* Primary Action Button (Encaisser / Valider) */}
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-extrabold text-sm sm:text-base shadow-md shadow-orange-500/25 transition-transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              {primaryAction.loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{primaryAction.label}</span>
                  {primaryAction.icon || <ArrowRight className="w-4 h-4 stroke-[2.5]" />}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
