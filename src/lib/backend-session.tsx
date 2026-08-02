import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BackendApiError,
  backendApi,
  backendRuntime,
  type BackendCredentials,
  type BackendSession,
} from "./backend-api";

type BackendSessionContextValue = {
  checking: boolean;
  session: BackendSession | null;
  error: string | null;
  connect(credentials: BackendCredentials, mode: "login" | "register"): Promise<void>;
  refresh(): Promise<void>;
  disconnect(): Promise<void>;
  invalidate(expectedSession: BackendSession): void;
};

const BackendSessionContext = createContext<BackendSessionContextValue | null>(null);

export function BackendSessionProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<BackendSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyEnvironment = useCallback((verified: BackendSession) => {
    if (backendRuntime.environment && verified.environment !== backendRuntime.environment) {
      throw new Error(
        `Wallet build is ${backendRuntime.environment}, but Backend session is ${verified.environment}`,
      );
    }
    return verified;
  }, []);

  const refresh = useCallback(async () => {
    const verified = verifyEnvironment(await backendApi.refreshSession());
    setSession(verified);
    setError(null);
  }, [verifyEnvironment]);

  const disconnect = useCallback(async () => {
    try {
      await backendApi.logout();
    } finally {
      setSession(null);
      setError(null);
    }
  }, []);

  const invalidate = useCallback((expectedSession: BackendSession) => {
    setSession((current) => (current === expectedSession ? null : current));
  }, []);

  const connect = useCallback(
    async (credentials: BackendCredentials, mode: "login" | "register") => {
      const verified = verifyEnvironment(
        mode === "register"
          ? await backendApi.register(credentials)
          : await backendApi.login(credentials),
      );
      setSession(verified);
      setError(null);
    },
    [verifyEnvironment],
  );

  useEffect(() => {
    void backendApi
      .session()
      .then((verified) => {
        setSession(verifyEnvironment(verified));
        setError(null);
      })
      .catch((reason) => {
        setSession(null);
        if (!(reason instanceof BackendApiError && reason.status === 401)) {
          setError(reason instanceof Error ? reason.message : "Backend session is unavailable");
        }
      })
      .finally(() => setChecking(false));
  }, [verifyEnvironment]);

  const value = useMemo(
    () => ({ checking, session, error, connect, refresh, disconnect, invalidate }),
    [checking, session, error, connect, refresh, disconnect, invalidate],
  );

  return <BackendSessionContext.Provider value={value}>{children}</BackendSessionContext.Provider>;
}

export function useBackendSession() {
  const value = useContext(BackendSessionContext);
  if (!value) throw new Error("useBackendSession must be used inside BackendSessionProvider");
  return value;
}
