import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductThumbnailProps {
  imageUrl?: string;
  name: string;
  categoryColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  roundedClassName?: string;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-24 h-24 text-xl',
};

const iconSizes = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
};

export const ProductThumbnail: React.FC<ProductThumbnailProps> = ({
  imageUrl,
  name,
  categoryColor,
  size = 'md',
  className = '',
  roundedClassName = 'rounded-2xl',
}) => {
  const [hasError, setHasError] = useState(false);

  const initials = (name || 'PR')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const color = categoryColor || '#3B82F6';

  return (
    <div
      className={`relative shrink-0 overflow-hidden flex items-center justify-center font-bold select-none border border-slate-100 dark:border-slate-800 transition-colors ${sizeClasses[size]} ${roundedClassName} ${className}`}
      style={{
        backgroundColor: imageUrl && !hasError ? '#f8fafc' : `${color}15`,
        color: color,
      }}
    >
      {imageUrl && !hasError ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-center">
          {size === 'xs' || size === 'sm' ? (
            <span className="font-black leading-none">{initials}</span>
          ) : size === 'md' ? (
            <Package className={`${iconSizes[size]} opacity-80`} />
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <Package className={`${iconSizes[size]} opacity-80`} />
              <span className="text-[10px] font-black tracking-wider uppercase opacity-75">{initials}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
