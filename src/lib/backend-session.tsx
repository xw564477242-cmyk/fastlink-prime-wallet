import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { backendApi, backendRuntime, type BackendSession } from "./backend-api";

const STORAGE_KEY = "fastlink.backend.session.v1";

function readStoredToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(STORAGE_KEY, token);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // The session remains memory-only when browser storage is unavailable.
  }
}

type BackendSessionContextValue = {
  checking: boolean;
  token: string;
  session: BackendSession | null;
  error: string | null;
  connect(token: string): Promise<void>;
  disconnect(): void;
};

const BackendSessionContext = createContext<BackendSessionContextValue | null>(null);

export function BackendSessionProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState("");
  const [session, setSession] = useState<BackendSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    storeToken("");
    setToken("");
    setSession(null);
    setError(null);
  }, []);

  const connect = useCallback(async (candidate: string) => {
    const normalized = candidate.trim();
    if (!normalized) throw new Error("Backend bearer session is required");
    const verified = await backendApi.session(normalized);
    if (backendRuntime.environment && verified.environment !== backendRuntime.environment) {
      throw new Error(
        `Wallet build is ${backendRuntime.environment}, but Backend session is ${verified.environment}`,
      );
    }
    storeToken(normalized);
    setToken(normalized);
    setSession(verified);
    setError(null);
  }, []);

  useEffect(() => {
    const candidate = readStoredToken();
    if (!candidate) {
      setChecking(false);
      return;
    }
    void connect(candidate)
      .catch((reason) => {
        storeToken("");
        setToken("");
        setSession(null);
        setError(reason instanceof Error ? reason.message : "Backend session is unavailable");
      })
      .finally(() => setChecking(false));
  }, [connect]);

  const value = useMemo(
    () => ({ checking, token, session, error, connect, disconnect }),
    [checking, token, session, error, connect, disconnect],
  );

  return <BackendSessionContext.Provider value={value}>{children}</BackendSessionContext.Provider>;
}

export function useBackendSession() {
  const value = useContext(BackendSessionContext);
  if (!value) throw new Error("useBackendSession must be used inside BackendSessionProvider");
  return value;
}
