import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import {
  backendSessionAfterInvalidation,
  backendSessionIntrinsicInvalidationReason,
  backendSessionInvalidationReasonFromError,
  backendSessionRequestCanCommit,
  type BackendSessionInvalidationReason,
  type BackendSessionInvalidator,
} from "./backend-session-policy";

type BackendSessionContextValue = {
  checking: boolean;
  session: BackendSession | null;
  error: string | null;
  connect(credentials: BackendCredentials, mode: "login" | "register"): Promise<void>;
  refresh(): Promise<void>;
  disconnect(): Promise<void>;
  invalidate: BackendSessionInvalidator;
};

const BackendSessionContext = createContext<BackendSessionContextValue | null>(null);

class BackendSessionAuthorityError extends Error {
  constructor(
    readonly invalidationReason: "EXPIRED" | "ENVIRONMENT_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "BackendSessionAuthorityError";
  }
}

export function BackendSessionProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<BackendSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<BackendSession | null>(null);
  const authorityEpochRef = useRef(0);

  const verifyEnvironment = useCallback((verified: BackendSession) => {
    const invalidationReason = backendSessionIntrinsicInvalidationReason(
      verified,
      backendRuntime.environment,
    );
    if (invalidationReason === "ENVIRONMENT_MISMATCH") {
      throw new BackendSessionAuthorityError(
        invalidationReason,
        "Backend session environment does not match this Wallet build",
      );
    }
    if (invalidationReason === "EXPIRED") {
      throw new BackendSessionAuthorityError(invalidationReason, "Backend session has expired");
    }
    return verified;
  }, []);

  const commitSession = useCallback(
    (
      expectedSession: BackendSession | null,
      nextSession: BackendSession | null,
      requestEpoch?: number,
    ) => {
      if (
        requestEpoch !== undefined &&
        !backendSessionRequestCanCommit(
          sessionRef.current,
          expectedSession,
          authorityEpochRef.current,
          requestEpoch,
        )
      ) {
        return false;
      }
      if (sessionRef.current !== expectedSession) return false;
      sessionRef.current = nextSession;
      authorityEpochRef.current += 1;
      setSession(nextSession);
      return true;
    },
    [],
  );

  const invalidate = useCallback(
    (expectedSession: BackendSession, reason: BackendSessionInvalidationReason) => {
      const currentSession = sessionRef.current;
      const nextSession = backendSessionAfterInvalidation(currentSession, expectedSession, reason);
      if (nextSession !== currentSession) commitSession(currentSession, nextSession);
    },
    [commitSession],
  );

  const refresh = useCallback(async () => {
    const expectedSession = sessionRef.current;
    const requestEpoch = ++authorityEpochRef.current;
    try {
      const verified = verifyEnvironment(await backendApi.refreshSession());
      if (commitSession(expectedSession, verified, requestEpoch)) setError(null);
    } catch (reason) {
      if (
        !backendSessionRequestCanCommit(
          sessionRef.current,
          expectedSession,
          authorityEpochRef.current,
          requestEpoch,
        )
      ) {
        throw reason;
      }
      const invalidationReason =
        reason instanceof BackendSessionAuthorityError
          ? reason.invalidationReason
          : backendSessionInvalidationReasonFromError(reason);
      if (expectedSession && invalidationReason) invalidate(expectedSession, invalidationReason);
      throw reason;
    }
  }, [commitSession, invalidate, verifyEnvironment]);

  const disconnect = useCallback(async () => {
    const expectedSession = sessionRef.current;
    const requestEpoch = ++authorityEpochRef.current;
    try {
      await backendApi.logout();
    } finally {
      if (commitSession(expectedSession, null, requestEpoch)) setError(null);
    }
  }, [commitSession]);

  const connect = useCallback(
    async (credentials: BackendCredentials, mode: "login" | "register") => {
      const expectedSession = sessionRef.current;
      const requestEpoch = ++authorityEpochRef.current;
      try {
        const verified = verifyEnvironment(
          mode === "register"
            ? await backendApi.register(credentials)
            : await backendApi.login(credentials),
        );
        if (commitSession(expectedSession, verified, requestEpoch)) {
          setError(null);
          setChecking(false);
        }
      } catch (reason) {
        if (
          !backendSessionRequestCanCommit(
            sessionRef.current,
            expectedSession,
            authorityEpochRef.current,
            requestEpoch,
          )
        ) {
          throw reason;
        }
        if (reason instanceof BackendSessionAuthorityError && expectedSession) {
          invalidate(expectedSession, reason.invalidationReason);
        }
        setChecking(false);
        throw reason;
      }
    },
    [commitSession, invalidate, verifyEnvironment],
  );

  useEffect(() => {
    if (!session || typeof session.expiresAt !== "string") return;
    const expiry = Date.parse(session.expiresAt);
    if (!Number.isFinite(expiry)) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const remaining = expiry - Date.now();
      if (remaining <= 0) {
        invalidate(session, "EXPIRED");
        return;
      }
      timeout = globalThis.setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    };
    schedule();
    return () => {
      if (timeout !== undefined) globalThis.clearTimeout(timeout);
    };
  }, [invalidate, session]);

  useEffect(() => {
    const expectedSession = sessionRef.current;
    const requestEpoch = ++authorityEpochRef.current;
    void backendApi
      .session()
      .then((verified) => {
        if (commitSession(expectedSession, verifyEnvironment(verified), requestEpoch)) {
          setError(null);
          setChecking(false);
        }
      })
      .catch((reason) => {
        if (
          !backendSessionRequestCanCommit(
            sessionRef.current,
            expectedSession,
            authorityEpochRef.current,
            requestEpoch,
          )
        ) {
          return;
        }
        commitSession(expectedSession, null, requestEpoch);
        if (!(reason instanceof BackendApiError && reason.status === 401)) {
          setError(reason instanceof Error ? reason.message : "Backend session is unavailable");
        }
        setChecking(false);
      });
    return () => {
      if (authorityEpochRef.current === requestEpoch) authorityEpochRef.current += 1;
    };
  }, [commitSession, verifyEnvironment]);

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
