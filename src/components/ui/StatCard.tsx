import React from 'react';
import { AppCard } from './AppCard';
import { PastelIcon, PastelColor } from './PastelIcon';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: PastelColor;
  accentColor?: PastelColor;
  badge?: string;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  iconColor = 'orange',
  accentColor,
  badge,
  onClick,
  className = '',
}) => {
  return (
    <AppCard
      onClick={onClick}
      className={`p-4 sm:p-5 flex flex-col justify-between space-y-2.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#64748B] dark:text-slate-400">
          {label}
        </span>
        {icon ? (
          <PastelIcon icon={icon} color={iconColor} size="sm" />
        ) : badge ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {badge}
          </span>
        ) : null}
      </div>

      <div>
        <div className="text-xl sm:text-2xl font-black font-financial text-[#14213D] dark:text-white tracking-tight">
          {value}
        </div>
        {subtitle && (
          <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </AppCard>
  );
};
