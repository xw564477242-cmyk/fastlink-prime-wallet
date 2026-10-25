import { useEffect, useState } from "react";
import { MobileShell, StatusBar } from "./MobileShell";
import { useCardListPages } from "@/hooks/use-card-list-pages";
import { useBackendSession } from "@/lib/backend-session";
import {
  isWalletOnlyPreview,
  safeCardFailure,
  supportReference,
} from "@/lib/launch-readonly-policy";
import { backendApi, type WalletCard } from "@/lib/backend-api";

export function LaunchReadOnlyCards({ requestedCardId }: { requestedCardId?: string } = {}) {
  const { session, invalidate, disconnect } = useBackendSession();
  const view = useCardListPages(session, null, invalidate);
  const [copyState, setCopyState] = useState("");
  const selected = view.cards.find((card) => card.cardId === view.activeId);
  const walletOnly = isWalletOnlyPreview();
  const detailId = requestedCardId ?? selected?.cardId;
  const detailKey =
    session && detailId
      ? JSON.stringify([
          session.actorId,
          session.tenantId,
          session.customerId,
          session.expiresAt,
          detailId,
        ])
      : null;
  const [detail, setDetail] = useState<{ key: string; card?: WalletCard; error?: string } | null>(
    null,
  );
  useEffect(() => {
    if (!walletOnly || !session || !detailId || !detailKey) return;
    let active = true;
    void backendApi.getCard(detailId).then(
      (card) => {
        if (active) setDetail({ key: detailKey, card });
      },
      (error) => {
        if (active) setDetail({ key: detailKey, error: safeCardFailure(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [walletOnly, session, detailId, detailKey]);
  const shownCard = walletOnly ? (detail?.key === detailKey ? detail.card : undefined) : selected;
  const detailError = walletOnly && detail?.key === detailKey ? detail.error : undefined;
  const trace = view.error?.match(/Trace ([A-Za-z0-9._:-]{8,128})$/)?.[1];
  const reference =
    session && trace && trace !== "unavailable"
      ? supportReference(session.tenantId, session.environment, trace)
      : null;
  const copy = async () => {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setCopyState("已复制客服查询参考，请发送给所属租户客服");
    } catch {
      setCopyState("复制不可用，请手动复制下方参考");
    }
  };
  return (
    <MobileShell>
      <StatusBar title="首发卡查询" />
      <main className="space-y-4 px-6 py-6">
        <h1 className="text-xl font-semibold">我的卡片</h1>
        <button onClick={() => void disconnect().catch(() => undefined)}>退出登录</button>
        <p>只读持久化记录，不是实时供应商状态。数据原始更新时间未由列表接口提供。</p>
        <p>创建与激活已列入本批，但真实 Provider 执行须另行批准；此处只展示持久化卡记录。</p>
        <fieldset disabled aria-label="Provider 操作待批准">
          <legend>卡操作（停点①）</legend>
          <button>创建虚拟卡</button>
          <button>激活选中卡</button>
        </fieldset>
        <button
          disabled={!view.scopeReady || view.loading || view.loadingMore}
          onClick={() => {
            setCopyState("");
            void view.reloadList();
          }}
        >
          刷新卡列表
        </button>
        {view.loading && <p role="status">正在读取…</p>}
        {!view.loading && !view.error && view.cards.length === 0 && (
          <p>暂无卡片记录。此状态不表示已发行新卡。</p>
        )}
        {view.error && (
          <section role="alert">
            <p>{view.error}</p>
            {reference && (
              <>
                <pre className="whitespace-pre-wrap break-all">{reference}</pre>
                <button onClick={() => void copy()}>复制客服参考</button>
                <p role="status">{copyState}</p>
              </>
            )}
          </section>
        )}
        <ul>
          {view.cards.map((card) => (
            <li key={card.cardId}>
              <button
                aria-pressed={view.activeId === card.cardId}
                onClick={() => view.selectCard(card.cardId)}
              >
                {card.alias || "卡片"} · 尾号{card.last4} · {card.status}
              </button>
            </li>
          ))}
        </ul>
        {view.nextCursor && (
          <button disabled={view.loading || view.loadingMore} onClick={() => void view.loadMore()}>
            {view.loadingMore ? "正在读取…" : "下一页"}
          </button>
        )}
        {walletOnly && detailKey && detail?.key !== detailKey && (
          <p role="status">正在读取卡详情…</p>
        )}
        {detailError && <p role="alert">{detailError}</p>}
        {shownCard && (
          <section aria-label="卡状态详情">
            <h2>卡状态详情</h2>
            <dl>
              <dt>卡ID</dt>
              <dd>{shownCard.cardId}</dd>
              <dt>状态</dt>
              <dd>{shownCard.status}</dd>
              <dt>类型</dt>
              <dd>{shownCard.type}</dd>
              <dt>尾号</dt>
              <dd>{shownCard.last4}</dd>
              <dt>有效期</dt>
              <dd>{shownCard.expiry}</dd>
              <dt>币种</dt>
              <dd>{shownCard.currency}</dd>
            </dl>
            <p>
              {walletOnly
                ? "详情来自本次受授权的独立基础详情请求，不含余额或供应商实时查询。"
                : "详情来自本次列表快照。刷新失败时不作为最新状态。"}
            </p>
          </section>
        )}
      </main>
    </MobileShell>
  );
}
