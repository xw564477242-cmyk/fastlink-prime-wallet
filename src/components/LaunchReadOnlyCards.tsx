import { useState } from "react";
import { MobileShell, StatusBar } from "./MobileShell";
import { useCardListPages } from "@/hooks/use-card-list-pages";
import { useBackendSession } from "@/lib/backend-session";
import { supportReference } from "@/lib/launch-readonly-policy";

export function LaunchReadOnlyCards() {
  const { session, invalidate, disconnect } = useBackendSession();
  const view = useCardListPages(session, null, invalidate);
  const [copyState, setCopyState] = useState("");
  const selected = view.cards.find((card) => card.cardId === view.activeId);
  const trace = view.error?.match(/Trace ([A-Za-z0-9._:-]{8,128})$/)?.[1];
  const reference = session && trace && trace !== "unavailable"
    ? supportReference(session.tenantId, session.environment, trace) : null;
  const copy = async () => {
    if (!reference) return;
    try { await navigator.clipboard.writeText(reference); setCopyState("已复制客服查询参考，请发送给所属租户客服"); }
    catch { setCopyState("复制不可用，请手动复制下方参考"); }
  };
  return <MobileShell><StatusBar title="首发卡查询" /><main className="space-y-4 px-6 py-6">
    <h1 className="text-xl font-semibold">我的卡片</h1>
    <button onClick={() => void disconnect().catch(() => undefined)}>退出登录</button>
    <p>只读持久化记录，不是实时供应商状态。数据原始更新时间未由列表接口提供。</p>
    <p>创建与激活已列入本批，但真实 Provider 执行须另行批准；此处只展示持久化卡记录。</p>
    <fieldset disabled aria-label="Provider 操作待批准">
      <legend>卡操作（停点①）</legend><button>创建虚拟卡</button><button>激活选中卡</button>
    </fieldset>
    <button disabled={!view.scopeReady || view.loading || view.loadingMore} onClick={() => { setCopyState(""); void view.reloadList(); }}>刷新卡列表</button>
    {view.loading && <p role="status">正在读取…</p>}
    {!view.loading && !view.error && view.cards.length === 0 && <p>暂无卡片记录。此状态不表示已发行新卡。</p>}
    {view.error && <section role="alert"><p>{view.error}</p>{reference && <><pre className="whitespace-pre-wrap break-all">{reference}</pre><button onClick={() => void copy()}>复制客服参考</button><p role="status">{copyState}</p></>}</section>}
    <ul>{view.cards.map((card) => <li key={card.cardId}><button aria-pressed={view.activeId === card.cardId} onClick={() => view.selectCard(card.cardId)}>{card.alias || "卡片"} · 尾号{card.last4} · {card.status}</button></li>)}</ul>
    {view.nextCursor && <button disabled={view.loading || view.loadingMore} onClick={() => void view.loadMore()}>{view.loadingMore ? "正在读取…" : "下一页"}</button>}
    {selected && <section aria-label="卡状态详情"><h2>卡状态详情</h2><dl>
      <dt>卡ID</dt><dd>{selected.cardId}</dd><dt>状态</dt><dd>{selected.status}</dd>
      <dt>类型</dt><dd>{selected.type}</dd><dt>尾号</dt><dd>{selected.last4}</dd>
      <dt>有效期</dt><dd>{selected.expiry}</dd><dt>币种</dt><dd>{selected.currency}</dd>
    </dl><p>详情来自本次列表快照。刷新失败时不作为最新状态。</p></section>}
  </main></MobileShell>;
}
