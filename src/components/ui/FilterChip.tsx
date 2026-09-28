import React from 'react';

interface FilterChipProps {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
  className?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  active,
  count,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-xs ${
        active
          ? 'bg-[#14213D] text-white dark:bg-white dark:text-[#14213D]'
          : 'bg-white text-[#64748B] hover:text-[#14213D] hover:bg-slate-50 border border-[#E8EDF2] dark:bg-[#131B2E] dark:text-slate-400 dark:border-[#22304E] dark:hover:bg-slate-800'
      } ${className}`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            active
              ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-[#14213D]'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};
