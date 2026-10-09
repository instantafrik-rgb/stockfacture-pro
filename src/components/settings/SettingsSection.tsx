/**
 * StockFacture Pro - Settings Section (Accordion)
 * 
 * Composant de section pliable pour la page Paramètres.
 * Une seule section peut être ouverte à la fois (accordéon strict).
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SettingsSectionProps {
  id: string;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  badge?: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  id,
  title,
  description,
  icon: Icon,
  iconColor = 'indigo',
  isOpen,
  onToggle,
  badge,
  children,
}) => {
  const iconColorClasses: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-900/40',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 border-orange-200/60 dark:border-orange-900/40',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200/60 dark:border-amber-900/40',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400 border-sky-200/60 dark:border-sky-900/40',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border-purple-200/60 dark:border-purple-900/40',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60',
  };

  return (
    <div
      className={`rounded-3xl border bg-white dark:bg-[#131B2E] shadow-sm overflow-hidden transition-all duration-200 ${
        isOpen
          ? 'border-orange-200 dark:border-orange-900/60 shadow-md'
          : 'border-[#E8EDF2] dark:border-[#22304E] hover:border-orange-200 dark:hover:border-orange-900/40'
      }`}
    >
      {/* Header cliquable */}
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left cursor-pointer transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${iconColorClasses[iconColor]}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-[#14213D] dark:text-white">
                {title}
              </h3>
              {badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800">
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="text-[11px] sm:text-xs text-[#64748B] dark:text-slate-400 mt-0.5 truncate">
                {description}
              </p>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-orange-500' : ''
          }`}
        />
      </button>

      {/* Contenu pliable */}
      {isOpen && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-[#E8EDF2] dark:border-[#22304E] animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};