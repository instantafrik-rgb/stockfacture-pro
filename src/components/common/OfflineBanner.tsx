import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900/90 text-white dark:bg-amber-600/90 dark:text-white px-3.5 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-md animate-bounce">
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span>Mode hors-ligne actif (Données locales disponibles)</span>
    </div>
  );
};
