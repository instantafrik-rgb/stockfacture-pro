import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNavigation } from './BottomNavigation';
import { OfflineBanner } from '../common/OfflineBanner';
import { PinLockModal } from '../common/PinLockModal';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#0B0F19] text-[#14213D] dark:text-[#F8FAFC] flex flex-row antialiased selection:bg-orange-500/20 selection:text-orange-900">
      {/* Offline connectivity banner */}
      <OfflineBanner />

      {/* Security PIN Lockscreen */}
      <PinLockModal />

      {/* Desktop Sidebar (hidden on mobile) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header />
        
        {/* Main scrollable body with guaranteed mobile bottom spacing */}
        <main className="flex-1 pb-mobile-nav md:pb-8 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Persistent Bottom Tab Navigation */}
        <BottomNavigation />
      </div>
    </div>
  );
};
