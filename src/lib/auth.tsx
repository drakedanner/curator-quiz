"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  isAuthenticated: false,
  signIn: async () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const autoAttemptedRef = useRef<string | null>(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("auth-token");
    const storedWallet = localStorage.getItem("auth-wallet");
    if (stored && storedWallet && address && storedWallet === address.toLowerCase()) {
      setToken(stored);
    }
  }, [address]);

  // Clear token when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setToken(null);
      autoAttemptedRef.current = null;
      localStorage.removeItem("auth-token");
      localStorage.removeItem("auth-wallet");
    }
  }, [isConnected]);

  const signIn = useCallback(async () => {
    if (!address) return;

    const siweMessage = new SiweMessage({
      domain: window.location.host,
      address,
      statement: "Sign in to Curator Quiz",
      uri: window.location.origin,
      version: "1",
      chainId: 1,
      nonce: crypto.randomUUID().replace(/-/g, ""),
    });

    const message = siweMessage.prepareMessage();
    const signature = await signMessageAsync({ message });

    const res = await fetch("/api/auth/siwe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, signature }),
    });

    if (!res.ok) throw new Error("Sign-in failed");

    const { token: jwt } = await res.json();
    setToken(jwt);
    localStorage.setItem("auth-token", jwt);
    localStorage.setItem("auth-wallet", address.toLowerCase());
  }, [address, signMessageAsync]);

  // Auto sign-in when wallet connects (connect = sign in)
  useEffect(() => {
    if (!isConnected || !address || token) return;
    const stored = localStorage.getItem("auth-token");
    const storedWallet = localStorage.getItem("auth-wallet");
    if (stored && storedWallet === address.toLowerCase()) return;
    // Only auto-attempt once per address per session
    if (autoAttemptedRef.current === address) return;
    autoAttemptedRef.current = address;
    signIn().catch(() => {});
  }, [isConnected, address, token, signIn]);

  const signOut = useCallback(() => {
    setToken(null);
    localStorage.removeItem("auth-token");
    localStorage.removeItem("auth-wallet");
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
