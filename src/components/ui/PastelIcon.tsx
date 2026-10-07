import React from 'react';

export type PastelColor = 'orange' | 'blue' | 'emerald' | 'purple' | 'rose' | 'amber' | 'slate';

interface PastelIconProps {
  icon: React.ComponentType<{ className?: string }>;
  color?: PastelColor;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PastelIcon: React.FC<PastelIconProps> = ({
  icon: Icon,
  color = 'orange',
  size = 'md',
  className = '',
}) => {
  const colorMap: Record<PastelColor, { bg: string; text: string; border: string }> = {
    orange: {
      bg: 'bg-[#FFF2DF] dark:bg-orange-950/40',
      text: 'text-[#D97706] dark:text-orange-400',
      border: 'border-[#FFE4BF] dark:border-orange-900/50',
    },
    blue: {
      bg: 'bg-[#EEF4FF] dark:bg-sky-950/40',
      text: 'text-[#2563EB] dark:text-sky-400',
      border: 'border-[#DDE7FF] dark:border-sky-900/50',
    },
    emerald: {
      bg: 'bg-[#E7F8F1] dark:bg-emerald-950/40',
      text: 'text-[#059669] dark:text-emerald-400',
      border: 'border-[#D1F2E4] dark:border-emerald-900/50',
    },
    purple: {
      bg: 'bg-[#F1EDFF] dark:bg-purple-950/40',
      text: 'text-[#7C3AED] dark:text-purple-400',
      border: 'border-[#E4DCFF] dark:border-purple-900/50',
    },
    rose: {
      bg: 'bg-[#FFF0F3] dark:bg-rose-950/40',
      text: 'text-[#E11D48] dark:text-rose-400',
      border: 'border-[#FFE0E6] dark:border-rose-900/50',
    },
    amber: {
      bg: 'bg-[#FFF7DC] dark:bg-amber-950/40',
      text: 'text-[#D97706] dark:text-amber-400',
      border: 'border-[#FEEFB3] dark:border-amber-900/50',
    },
    slate: {
      bg: 'bg-[#F1F5F9] dark:bg-slate-800',
      text: 'text-[#64748B] dark:text-slate-300',
      border: 'border-[#E2E8F0] dark:border-slate-700',
    },
  };

  const sizeClasses = {
    sm: 'w-9 h-9 rounded-xl',
    md: 'w-12 h-12 rounded-2xl',
    lg: 'w-14 h-14 rounded-2xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  const scheme = colorMap[color];

  return (
    <div
      className={`${sizeClasses[size]} ${scheme.bg} ${scheme.text} border ${scheme.border} flex items-center justify-center shrink-0 transition-transform ${className}`}
    >
      <Icon className={iconSizes[size]} />
    </div>
  );
};
