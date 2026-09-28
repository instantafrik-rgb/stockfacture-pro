/**
 * StockFacture Pro - Firebase Authentication & Cloud Sync Context
 * 
 * Manages Google Sign-In, Sign-Out, Connection Status in Settings,
 * and First-Time Local Data Migration to Firestore.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { auth, signInWithGoogle as firebaseSignIn, logOut as firebaseLogOut, subscribeToAuth } from '../services/firebase';
import { firestoreSyncService } from '../services/data/FirestoreSyncService';
import { dataRepository, SyncStatus } from '../services/data';
import { useApp } from './AppContext';

interface AuthContextType {
  user: User | null;
  isLoadingAuth: boolean;
  syncStatus: SyncStatus;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  hasLocalDataToMigrate: boolean;
  migrateLocalDataToCloud: () => Promise<boolean>;
  dismissMigrationPrompt: () => void;
  isMigrating: boolean;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useApp();
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(firestoreSyncService.getStatus());
  const [hasLocalDataToMigrate, setHasLocalDataToMigrate] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Subscribe to sync status updates
  useEffect(() => {
    const unsub = firestoreSyncService.subscribeStatus((newStatus) => {
      setSyncStatus(newStatus);
    });
    return unsub;
  }, []);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
      setAuthError(null);

      if (currentUser) {
        // Start real-time Firestore listeners for this user
        firestoreSyncService.startSync(currentUser.uid);

        // Check for first-login migration safety
        const hasCloud = await firestoreSyncService.hasCloudData(currentUser.uid);
        const hasLocal = (state.products && state.products.length > 0) ||
                         (state.clients && state.clients.length > 0) ||
                         (state.invoices && state.invoices.length > 0);

        if (!hasCloud && hasLocal) {
          // Local data exists on device, cloud is empty: propose migration
          setHasLocalDataToMigrate(true);
        } else {
          setHasLocalDataToMigrate(false);
        }
      } else {
        firestoreSyncService.stopSync();
        setHasLocalDataToMigrate(false);
      }
    });

    return () => unsubscribe();
  }, [state.products, state.clients, state.invoices]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await firebaseSignIn();
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setAuthError(err?.message || 'Échec de la connexion Google');
      throw err;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      firestoreSyncService.stopSync();
      await firebaseLogOut();
      setUser(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  }, []);

  const migrateLocalDataToCloud = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setIsMigrating(true);
    try {
      const fullState = await dataRepository.loadFullState();
      if (!fullState) {
        setIsMigrating(false);
        return false;
      }
      const success = await firestoreSyncService.migrateLocalToCloud(user.uid, fullState);
      if (success) {
        setHasLocalDataToMigrate(false);
      }
      return success;
    } catch (err) {
      console.error('Migration error:', err);
      return false;
    } finally {
      setIsMigrating(false);
    }
  }, [user]);

  const dismissMigrationPrompt = useCallback(() => {
    setHasLocalDataToMigrate(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoadingAuth,
        syncStatus,
        signInWithGoogle,
        signOutUser,
        hasLocalDataToMigrate,
        migrateLocalDataToCloud,
        dismissMigrationPrompt,
        isMigrating,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
