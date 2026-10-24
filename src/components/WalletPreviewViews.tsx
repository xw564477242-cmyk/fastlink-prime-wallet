import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Banknote, ChevronLeft, ChevronRight, CircleHelp, History, Layers } from "lucide-react";
import { MobileShell, StatusBar } from "./MobileShell";
import { useBackendSession } from "@/lib/backend-session";
import { usePreviewWalletBalances } from "@/hooks/use-preview-wallet-balances";
import { useWalletAccountHistory } from "@/hooks/use-wallet-account-history";
import { useWalletTransactionDetail } from "@/hooks/use-wallet-transaction-detail";
import { clientRequestAllowed } from "@/lib/launch-readonly-policy";
import type { WalletAccountTransaction, WalletTransactionTypeFilter } from "@/lib/backend-api";

// Recovered balance/history functionality only; no B17 funds, KYC or other UI shells.
function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <MobileShell>
      <StatusBar title={title} />
      <main className="px-6 pb-8 pt-2">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
          返回首页
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
        {children}
      </main>
    </MobileShell>
  );
}

export function PreviewNotice({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-5 flex gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground"
      role="status"
    >
      <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </div>
  );
}

function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-5 rounded-3xl border border-border/50 bg-surface/60 p-5">
      {title && <h2 className="mb-4 font-display text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

function EmptyRows({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 px-4 py-7 text-center text-xs leading-relaxed text-muted-foreground">
      <History className="mx-auto mb-3 h-6 w-6 opacity-60" />
      {children}
    </div>
  );
}

function AssetTabs({ kind }: { kind: "digital" | "fiat" }) {
  const tabs = [
    { key: "digital", to: "/assets/digital", label: "数字资产" },
    { key: "fiat", to: "/assets/fiat", label: "法币钱包" },
    { key: "cards", to: "/assets/cards", label: "卡片资产" },
  ] as const;
  return (
    <div className="mt-5 grid grid-cols-3 rounded-2xl bg-surface/70 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={tab.to}
          className={`rounded-xl px-1 py-3 text-center text-xs font-semibold ${kind === tab.key ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

export function PreviewAssetsPage({ kind }: { kind: "digital" | "fiat" }) {
  const { session } = useBackendSession();
  const balances = usePreviewWalletBalances(session);
  const assetClass = kind === "digital" ? "DIGITAL" : "FIAT";
  const accounts = balances.catalog
    ? balances.accounts.filter((account) =>
        balances.catalog?.items.some(
          (asset) => asset.assetCode === account.assetCode && asset.assetClass === assetClass,
        ),
      )
    : [];
  const balanceReady = Boolean(
    session && balances.supported && balances.catalog && !balances.loading && !balances.error,
  );
  const unclassified = balances.catalog
    ? balances.accounts.filter(
        (account) =>
          !balances.catalog?.items.some((asset) => asset.assetCode === account.assetCode),
      )
    : [];
  const name = { digital: "数字资产", fiat: "法币钱包" }[kind];
  const Icon = kind === "digital" ? Layers : Banknote;
  return (
    <Page title="我的资产" subtitle="按币种查看当前账户的钱包余额。">
      <AssetTabs kind={kind} />
      <section className="mt-5 rounded-3xl bg-gradient-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">{name}余额</p>
            <div className="mt-2 space-y-1 font-display text-3xl font-semibold" translate="no">
              {balanceReady && accounts.length > 0 ? (
                accounts.map((account) => (
                  <p key={account.assetCode}>
                    {account.availableBalance} {account.assetCode}
                  </p>
                ))
              ) : (
                <p>—</p>
              )}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          按币种显示当前账户可用余额，不汇总不同币种，不进行估值。
        </p>
      </section>
      <PreviewNotice>
        余额来自当前会话的钱包账户；资产类别来自后端资产目录。充值、提现等资金操作保持关闭。
      </PreviewNotice>
      <Panel title="资产列表">
        {!session && <EmptyRows>请先登录后查看钱包余额。</EmptyRows>}
        {session && !balances.supported && <EmptyRows>当前预览未开放余额读取。</EmptyRows>}
        {session && balances.supported && (balances.loading || balances.catalogLoading) && (
          <EmptyRows>正在读取钱包余额与资产类别…</EmptyRows>
        )}
        {(balances.error || balances.catalogFailed) && (
          <EmptyRows>余额或资产类别读取失败，暂不显示金额；这不表示余额为零。</EmptyRows>
        )}
        {balanceReady &&
          accounts.map((account) => (
            <div key={account.assetCode} className="border-b border-border/40 py-4 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{account.assetCode}</p>
                <p translate="no" className="text-sm font-semibold">
                  {account.availableBalance} {account.assetCode}
                </p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground" translate="no">
                账面 {account.ledgerBalance} · 待处理 {account.pendingBalance}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                更新于 {new Date(account.updatedAt).toLocaleString()}
              </p>
            </div>
          ))}
        {balanceReady && accounts.length === 0 && (
          <EmptyRows>当前账户未返回{name}账户；未返回账户不代表余额为零。</EmptyRows>
        )}
        {balanceReady && unclassified.length > 0 && (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            部分币种未包含在资产目录中，未自行归类；可在首页按币种查看余额。
          </p>
        )}
      </Panel>
      <Panel title="最近交易">
        <Link
          to="/history"
          className="flex items-center justify-between gap-2 text-sm text-primary"
        >
          查看钱包真实交易记录 <ChevronRight className="h-4 w-4" />
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">
          按币种读取当前账户历史，不包含未开放的卡交易。
        </p>
      </Panel>
    </Page>
  );
}

export function PreviewHistoryPage() {
  const [filter, setFilter] = useState("全部");
  const { session } = useBackendSession();
  const supported =
    clientRequestAllowed("/v1/wallet/balances") &&
    clientRequestAllowed("/v1/wallet/transactions?assetCode=USD");
  const types: Record<string, WalletTransactionTypeFilter | undefined> = {
    全部: undefined,
    充值: "DEPOSIT",
    提现: "WITHDRAWAL",
    转账: "TRANSFER",
    卡消费: "MERCHANT_PAYMENT",
  };
  const history = useWalletAccountHistory(supported ? session : null, { type: types[filter] });
  const [selection, setSelection] = useState<{ scopeKey: string | null; id: string } | null>(null);
  const selected =
    selection?.scopeKey === history.transactions.scopeKey
      ? (history.transactions.items.find((item) => item.id === selection?.id) ?? null)
      : null;
  const detail = useWalletTransactionDetail(
    supported ? session : null,
    history.accounts.selectedAssetCode,
    selected,
    history.transactions.scopeKey,
  );
  return (
    <Page title="交易记录" subtitle="按币种查看当前账户的钱包交易；卡片交易尚未开放。">
      <section className="mt-5 rounded-3xl bg-gradient-card p-5">
        <p className="text-xs text-muted-foreground">本月收支</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {["收入", "支出"].map((x) => (
            <div key={x}>
              <p className="text-xs text-muted-foreground">{x}</p>
              <p className="mt-2 text-2xl">—</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          当前分页不代表整月账目，不计算月度收支或跨币种总额。
        </p>
      </section>
      {history.accounts.accounts.length > 0 && (
        <div className="mt-5">
          <label htmlFor="wallet-history-asset" className="text-xs text-muted-foreground">
            交易币种
          </label>
          <select
            id="wallet-history-asset"
            value={history.accounts.selectedAssetCode ?? ""}
            onChange={(event) => history.selectAccount(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-border/50 bg-surface p-3 text-sm"
          >
            {history.accounts.accounts.map((account) => (
              <option key={account.assetCode} value={account.assetCode}>
                {account.assetCode}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {["全部", "充值", "提现", "转账", "卡消费"].map((x) => (
          <button
            type="button"
            key={x}
            onClick={() => setFilter(x)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs ${filter === x ? "bg-primary/15 text-primary" : "bg-surface text-muted-foreground"}`}
          >
            {x}
          </button>
        ))}
      </div>
      <PreviewNotice>
        只读查看钱包持久化记录。筛选不会发起充值、提现、转账或卡消费；金额保留后端原始十进制字符串。
      </PreviewNotice>
      <Panel title={filter === "全部" ? "全部交易" : `${filter}记录`}>
        {!session && <EmptyRows>请先登录后查看钱包交易。</EmptyRows>}
        {session && !supported && <EmptyRows>当前预览未开放钱包交易读取。</EmptyRows>}
        {session && supported && (history.accounts.loading || history.transactions.loading) && (
          <EmptyRows>正在读取钱包交易…</EmptyRows>
        )}
        {(history.accounts.error || history.transactions.error) && (
          <EmptyRows>交易读取失败或访问被拒绝，暂不显示记录；这不表示没有交易。</EmptyRows>
        )}
        {session &&
          supported &&
          !history.accounts.loading &&
          !history.accounts.error &&
          history.accounts.accounts.length === 0 && (
            <EmptyRows>当前账户未返回可查询的钱包账户。</EmptyRows>
          )}
        {session &&
          supported &&
          history.accounts.selectedAssetCode &&
          !history.transactions.loading &&
          !history.transactions.error &&
          history.transactions.items.length === 0 && (
            <EmptyRows>当前币种和筛选条件未返回交易记录。</EmptyRows>
          )}
        {history.transactions.items.map((transaction) => (
          <button
            type="button"
            key={transaction.id}
            onClick={() =>
              setSelection({ scopeKey: history.transactions.scopeKey, id: transaction.id })
            }
            className="flex w-full items-center justify-between gap-3 border-b border-border/40 py-4 text-left last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{transactionTypeLabel(transaction.type)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {transactionStatusLabel(transaction.status)} ·{" "}
                {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </div>
            <p translate="no" className="text-sm font-semibold">
              {transaction.direction === "incoming" ? "+" : "−"}
              {transaction.amount} {transaction.assetCode}
            </p>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
        {history.transactions.refreshError && (
          <p role="status" className="mt-3 text-xs text-destructive">
            刷新失败，仍显示上次成功读取的记录。
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={history.refresh}
            disabled={!history.canRefresh}
            className="rounded-xl bg-primary/10 px-4 py-2 text-xs text-primary disabled:opacity-40"
          >
            {history.transactions.refreshing ? "正在刷新…" : "刷新记录"}
          </button>
          {history.transactions.nextCursor && (
            <button
              type="button"
              onClick={() => void history.loadMore()}
              disabled={history.transactions.loadingMore || history.transactions.refreshing}
              className="rounded-xl bg-surface px-4 py-2 text-xs text-primary disabled:opacity-40"
            >
              {history.transactions.loadingMore ? "正在读取…" : "加载更多"}
            </button>
          )}
        </div>
      </Panel>
      {selected && (
        <Panel title="钱包交易详情">
          {detail.loading && (
            <p role="status" className="text-xs text-muted-foreground">
              正在读取交易详情…
            </p>
          )}
          {detail.error && (
            <p role="alert" className="text-xs text-destructive">
              详情读取失败或访问被拒绝，暂不显示详情。
            </p>
          )}
          {detail.detail && (
            <dl className="space-y-3 text-xs">
              {[
                ["交易编号", detail.detail.id],
                ["类型", transactionTypeLabel(detail.detail.type)],
                ["状态", transactionStatusLabel(detail.detail.status)],
                ["方向", detail.detail.direction === "incoming" ? "收入" : "支出"],
                ["金额", `${detail.detail.amount} ${detail.detail.assetCode}`],
                ["创建时间", new Date(detail.detail.createdAt).toLocaleString()],
                ["更新时间", new Date(detail.detail.updatedAt).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd translate="no" className="min-w-0 break-all text-right">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="mt-4 text-xs text-primary"
          >
            关闭详情
          </button>
        </Panel>
      )}
    </Page>
  );
}

function transactionTypeLabel(type: WalletAccountTransaction["type"]) {
  return {
    deposit: "充值",
    withdrawal: "提现",
    transfer: "转账",
    merchant_payment: "消费",
    refund: "退款",
    fx: "兑换",
  }[type];
}

function transactionStatusLabel(status: WalletAccountTransaction["status"]) {
  return { pending: "处理中", completed: "已完成", failed: "失败", reversed: "已撤回" }[status];
}
