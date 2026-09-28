import React from 'react';
import { AppCard } from './AppCard';
import { PastelIcon, PastelColor } from './PastelIcon';
import { ArrowRight } from 'lucide-react';

interface ActionCardProps {
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: PastelColor;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: PastelColor;
  onClick: () => void;
  className?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  subtitle,
  badge,
  badgeColor = 'blue',
  icon,
  iconColor,
  onClick,
  className = '',
}) => {
  const badgeColors: Record<PastelColor, string> = {
    orange: 'bg-[#FFF2DF] text-[#D97706] border-[#FFE4BF] dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800/60',
    blue: 'bg-[#EEF4FF] text-[#2563EB] border-[#DDE7FF] dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800/60',
    emerald: 'bg-[#E7F8F1] text-[#059669] border-[#D1F2E4] dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800/60',
    purple: 'bg-[#F1EDFF] text-[#7C3AED] border-[#E4DCFF] dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800/60',
    rose: 'bg-[#FFF0F3] text-[#E11D48] border-[#FFE0E6] dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800/60',
    amber: 'bg-[#FFF7DC] text-[#D97706] border-[#FEEFB3] dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/60',
    slate: 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-300',
  };

  return (
    <AppCard
      onClick={onClick}
      hoverable
      className={`p-5 sm:p-6 flex flex-col justify-between space-y-4 group ${className}`}
    >
      <div className="flex items-start justify-between">
        <PastelIcon
          icon={icon}
          color={iconColor}
          size="lg"
          className="group-hover:scale-105"
        />

        {badge && (
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${badgeColors[badgeColor]}`}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-lg sm:text-xl font-black text-[#14213D] dark:text-white flex items-center justify-between">
          <span>{title}</span>
          <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
        </h3>
        <p className="text-xs sm:text-sm text-[#64748B] dark:text-slate-400 leading-relaxed">
          {subtitle}
        </p>
      </div>
    </AppCard>
  );
};
