import { BackendApiError } from "./backend-api";
import {
  isBackendSessionInvalidationReason,
  type BackendSessionInvalidationReason,
} from "./backend-session-policy";

export type ErrorCategory =
  | "session"
  | "permission"
  | "network"
  | "timeout"
  | "business"
  | "service"
  | "cancelled";
export type PublicError = {
  category: ErrorCategory;
  status?: number;
  code?: string;
  traceId?: string;
  title: string;
  description: string;
};

export function classifyPublicError(reason: unknown): PublicError {
  const api = reason instanceof BackendApiError ? reason : undefined;
  const cancelled =
    api?.cancelled || (reason instanceof DOMException && reason.name === "AbortError");
  const category: ErrorCategory = cancelled
    ? "cancelled"
    : api?.status === 401 || isBackendSessionInvalidationReason(reason)
      ? "session"
      : api?.status === 403
        ? "permission"
        : api?.status === 408
          ? "timeout"
          : api?.status === 0
            ? "network"
            : api && api.status >= 400 && api.status < 500
              ? "business"
              : "service";
  const messages: Record<ErrorCategory, [string, string]> = {
    session: ["会话已失效", "请重新验证会话。"],
    permission: ["无权执行此操作", "当前账户没有执行此操作的权限。"],
    network: ["连接失败", "无法连接服务，请检查网络后重试。"],
    timeout: ["请求超时", "服务未及时响应，请稍后重试。"],
    business: ["操作未完成", "请求未能完成，请检查操作条件。"],
    service: ["服务暂时不可用", "操作未能完成，请稍后再试。"],
    cancelled: ["", ""],
  };
  // Neither backend messages nor exception stacks are safe UI copy.
  return {
    category,
    status: api?.status,
    code: api?.code,
    traceId: api?.traceId && /^[A-Za-z0-9_.:-]{1,128}$/.test(api.traceId) ? api.traceId : undefined,
    title: messages[category][0],
    description: messages[category][1],
  };
}

export type ErrorLease = { valid: () => boolean };
export type ErrorReport = {
  operation: string;
  reason: unknown;
  isCurrent: () => boolean;
  ownership?: "global" | "local" | "boundary";
  retry?: {
    safeReadOnly: true;
    run: (signal: AbortSignal, isCurrent: () => boolean) => Promise<void>;
  };
};
export type QueuedError = PublicError & {
  id: number;
  key: string;
  operation: string;
  scope: string;
  retrying: boolean;
  canRetry: boolean;
};
type Entry = {
  view: QueuedError;
  lease: ErrorLease;
  isCurrent: () => boolean;
  retry?: ErrorReport["retry"];
  controller?: AbortController;
};

/** One instance per verified session generation; no raw error/response is retained. */
export class PublicErrorQueue {
  private entries: Entry[] = [];
  private recent = new Map<string, number>();
  private sequence = 0;
  private listeners = new Set<() => void>();
  private snapshot: readonly QueuedError[] = [];
  constructor(
    readonly scope: string,
    private scopeValid: () => boolean,
    private invalidateSession: (reason: BackendSessionInvalidationReason) => void,
    private now = Date.now,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private publish() {
    this.pruneExpired();
    this.snapshot = this.entries.map(({ view }) => view);
    this.listeners.forEach((listener) => listener());
  }
  private valid(entry: Pick<Entry, "lease" | "isCurrent">) {
    return this.scopeValid() && entry.lease.valid() && entry.isCurrent();
  }
  private pruneExpired() {
    const expired = new Set(this.entries.filter((entry) => !this.valid(entry)));
    if (!expired.size) return false;
    // Detach before aborting so late callbacks cannot still find their entry.
    this.entries = this.entries.filter((entry) => !expired.has(entry));
    for (const entry of expired) {
      this.recent.delete(entry.view.key);
      const controller = entry.controller;
      entry.retry = undefined;
      entry.controller = undefined;
      controller?.abort();
    }
    return true;
  }
  report(lease: ErrorLease, input: ErrorReport) {
    if (this.pruneExpired()) this.publish();
    if (input.ownership && input.ownership !== "global") return;
    if (!this.valid({ lease, isCurrent: input.isCurrent })) return;
    const error = classifyPublicError(input.reason);
    if (error.category === "cancelled") return;
    if (error.category === "session") {
      this.clear();
      this.invalidateSession(
        isBackendSessionInvalidationReason(input.reason) ? input.reason : "EXPLICIT_401",
      );
      return;
    }
    const key = JSON.stringify([
      this.scope,
      input.operation,
      error.category,
      error.status,
      error.code,
    ]);
    for (const [previous, time] of this.recent)
      if (this.now() - time >= 2000) this.recent.delete(previous);
    if (this.entries.some((entry) => entry.view.key === key) || this.recent.has(key)) return;
    this.recent.set(key, this.now());
    const retry =
      error.category !== "permission" && input.retry?.safeReadOnly === true
        ? input.retry
        : undefined;
    this.entries.push({
      lease,
      isCurrent: input.isCurrent,
      retry,
      view: {
        ...error,
        id: ++this.sequence,
        key,
        operation: input.operation,
        scope: this.scope,
        retrying: false,
        canRetry: !!retry,
      },
    });
    this.publish();
  }
  dismiss(id: number) {
    this.pruneExpired();
    this.entries.find((entry) => entry.view.id === id)?.controller?.abort();
    this.entries = this.entries.filter((entry) => entry.view.id !== id);
    this.publish();
  }
  release(lease: ErrorLease) {
    for (const entry of this.entries.filter((entry) => entry.lease === lease)) {
      entry.controller?.abort();
      this.recent.delete(entry.view.key);
    }
    this.entries = this.entries.filter((entry) => entry.lease !== lease);
    this.publish();
  }
  clear() {
    this.entries.forEach((entry) => entry.controller?.abort());
    this.entries = [];
    this.recent.clear();
    this.publish();
  }
  async retry(id: number) {
    if (this.pruneExpired()) this.publish();
    const entry = this.entries.find((item) => item.view.id === id);
    if (!entry || entry.view.retrying || !entry.retry) return;
    if (!this.valid(entry)) {
      this.dismiss(id);
      return;
    }
    entry.controller = new AbortController();
    entry.view = { ...entry.view, retrying: true };
    this.publish();
    const current = () =>
      this.entries.includes(entry) && this.valid(entry) && !entry.controller?.signal.aborted;
    try {
      await entry.retry.run(entry.controller.signal, current);
      if (current()) this.dismiss(id);
    } catch (reason) {
      if (!current()) return;
      const error = classifyPublicError(reason);
      if (error.category === "session") {
        this.clear();
        this.invalidateSession(
          isBackendSessionInvalidationReason(reason) ? reason : "EXPLICIT_401",
        );
        return;
      }
      if (error.category === "cancelled") {
        this.dismiss(id);
        return;
      }
      // An explicit attempt always reports its failure in the existing dialog.
      const key = JSON.stringify([
        this.scope,
        entry.view.operation,
        error.category,
        error.status,
        error.code,
      ]);
      this.entries = this.entries.filter((other) => {
        if (other !== entry && other.view.key === key) {
          other.controller?.abort();
          return false;
        }
        return true;
      });
      this.recent.set(key, this.now());
      entry.view = {
        ...entry.view,
        ...error,
        key,
        retrying: false,
        canRetry: error.category !== "permission",
      };
      if (error.category === "permission") entry.retry = undefined;
      this.publish();
    } finally {
      if (this.entries.includes(entry) && !this.valid(entry)) this.dismiss(id);
    }
  }
}
