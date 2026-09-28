import React from 'react';

interface AppCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#131B2E] rounded-[24px] border border-[#E8EDF2] dark:border-[#22304E] shadow-[0_2px_8px_-2px_rgba(20,33,61,0.04)] ${
        hoverable || onClick
          ? 'cursor-pointer hover:shadow-[0_8px_16px_-4px_rgba(20,33,61,0.06)] hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 active:scale-[0.99]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
