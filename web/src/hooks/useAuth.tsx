'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userId: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userId: null,
  userDisplayName: null,
  userEmail: null,
  login: async () => {},
  logout: async () => {},
  getToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginInProgress, setLoginInProgress] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login() {
    if (loginInProgress) return;
    setLoginInProgress(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } finally {
      setLoginInProgress(false);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  async function getToken() {
    if (!user) return null;
    return user.getIdToken();
  }

  const userId = user?.uid || null;
  const userDisplayName = user?.displayName || null;
  const userEmail = user?.email || null;

  return (
    <AuthContext.Provider value={{ user, loading, userId, userDisplayName, userEmail, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
