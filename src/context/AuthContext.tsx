import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase.ts';
import { apiFetch as baseApiFetch } from '../lib/api.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  apiFetch: async () => { throw new Error('Auth not initialized'); } 
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const wrappedApiFetch = useCallback(async <T = any,>(path: string, options?: RequestInit): Promise<T> => {
    const method = (options?.method || 'GET').toUpperCase();
    try {
      return await baseApiFetch<T>(path, options);
    } catch (err: any) {
      console.error('[AUTH CONTEXT API ERROR]', {
        method,
        pathname: path,
        message: err?.message || 'Unknown network error',
        status: err?.status
      });
      throw err;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, apiFetch: wrappedApiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

