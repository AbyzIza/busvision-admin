import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { 
  auth, 
  loginWithGoogle as fbLoginWithGoogle, 
  loginWithEmail as fbLoginWithEmail, 
  registerWithEmail as fbRegisterWithEmail, 
  logoutUser as fbLogoutUser,
  sendResetPassword as fbSendResetPassword,
  formatAuthError
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: 'google.com' | 'password' | 'demo' | string;
  isDemo?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  rawFirebaseUser: FirebaseUser | null;
  isLoading: boolean;
  authError: string | null;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  clearError: () => void;
  loginAsDemo: (name?: string, role?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER_STORAGE_KEY = 'busvision_auth_demo_session';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [rawFirebaseUser, setRawFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if we have an active Demo Session in localStorage first
    const savedDemo = localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (savedDemo) {
      try {
        const parsed = JSON.parse(savedDemo) as AppUser;
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setRawFirebaseUser(fbUser);
      if (fbUser) {
        // Firebase user authenticated
        localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        const providerId = fbUser.providerData[0]?.providerId || 'password';
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Диспетчер',
          photoURL: fbUser.photoURL,
          providerId,
          isDemo: false
        });
      } else {
        // If no real Firebase user and no saved demo session, set to null
        if (!localStorage.getItem(DEMO_USER_STORAGE_KEY)) {
          setUser(null);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const fbUser = await fbLoginWithGoogle();
      const providerId = fbUser.providerData[0]?.providerId || 'google.com';
      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || 'Google Пользователь',
        photoURL: fbUser.photoURL,
        providerId,
        isDemo: false
      });
      localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      setIsAuthModalOpen(false);
    } catch (err: unknown) {
      console.error('[BusVision Auth] Google Sign-in error:', err);
      const friendlyMsg = formatAuthError(err);
      setAuthError(friendlyMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithEmail = useCallback(async (email: string, pass: string) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const fbUser = await fbLoginWithEmail(email, pass);
      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Диспетчер',
        photoURL: fbUser.photoURL,
        providerId: 'password',
        isDemo: false
      });
      localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      setIsAuthModalOpen(false);
    } catch (err: unknown) {
      console.error('[BusVision Auth] Email Sign-in error:', err);
      const friendlyMsg = formatAuthError(err);
      setAuthError(friendlyMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerWithEmail = useCallback(async (email: string, pass: string, displayName?: string) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const fbUser = await fbRegisterWithEmail(email, pass, displayName);
      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: displayName || fbUser.displayName || email.split('@')[0] || 'Диспетчер',
        photoURL: fbUser.photoURL,
        providerId: 'password',
        isDemo: false
      });
      localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      setIsAuthModalOpen(false);
    } catch (err: unknown) {
      console.error('[BusVision Auth] Email Registration error:', err);
      const friendlyMsg = formatAuthError(err);
      setAuthError(friendlyMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      await fbLogoutUser();
    } catch (err) {
      console.warn('[BusVision Auth] Logout notice:', err);
    }
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    setUser(null);
    setRawFirebaseUser(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      await fbSendResetPassword(email);
    } catch (err: unknown) {
      const friendlyMsg = formatAuthError(err);
      setAuthError(friendlyMsg);
      throw err;
    }
  }, []);

  const loginAsDemo = useCallback((name = 'Азамат Серікбаев', role = 'Старший диспетчер') => {
    const demoUser: AppUser = {
      uid: 'demo_dispatcher_42',
      email: 'dispatcher@busvision.kz',
      displayName: `${name} (${role})`,
      photoURL: null,
      providerId: 'demo',
      isDemo: true
    };
    setUser(demoUser);
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(demoUser));
    setIsAuthModalOpen(false);
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        rawFirebaseUser,
        isLoading,
        authError,
        isAuthModalOpen,
        setIsAuthModalOpen,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        sendPasswordReset,
        clearError,
        loginAsDemo
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
