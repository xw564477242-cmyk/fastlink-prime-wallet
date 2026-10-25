import { useEffect, useState } from "react";
import { backendApi, type BackendSession, type WalletAssetCatalog } from "@/lib/backend-api";
import { walletBalanceSessionKey } from "@/lib/wallet-account-state";
import { clientRequestAllowed } from "@/lib/launch-readonly-policy";
import { useHomeWalletBalances } from "./use-home-wallet-balances";

// Classification is public backend metadata, never a client-side currency guess.
export function usePreviewWalletBalances(session: BackendSession | null) {
  const balanceAllowed = clientRequestAllowed("/v1/wallet/balances");
  const catalogAllowed = clientRequestAllowed("/v1/wallet/assets");
  const balances = useHomeWalletBalances(balanceAllowed ? session : null);
  const scopeKey = balanceAllowed && catalogAllowed ? walletBalanceSessionKey(session) : null;
  const [catalogState, setCatalogState] = useState<{
    scopeKey: string | null;
    catalog: WalletAssetCatalog | null;
    loading: boolean;
    failed: boolean;
  }>({ scopeKey: null, catalog: null, loading: false, failed: false });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setCatalogState({ scopeKey, catalog: null, loading: scopeKey !== null, failed: false });
    if (!session || !scopeKey) return () => controller.abort();
    void backendApi.walletAssets(session, controller.signal).then(
      (catalog) => {
        if (active) setCatalogState({ scopeKey, catalog, loading: false, failed: false });
      },
      () => {
        if (active) setCatalogState({ scopeKey, catalog: null, loading: false, failed: true });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [scopeKey, session]);

  const catalog = catalogState.scopeKey === scopeKey ? catalogState.catalog : null;
  return {
    ...balances,
    supported: balanceAllowed && catalogAllowed,
    catalog,
    catalogLoading:
      scopeKey !== null && (catalogState.scopeKey !== scopeKey || catalogState.loading),
    catalogFailed: catalogState.scopeKey === scopeKey && catalogState.failed,
  };
}
