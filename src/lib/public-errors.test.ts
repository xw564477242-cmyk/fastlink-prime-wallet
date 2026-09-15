import { describe, expect, it } from "bun:test";
import { BackendApiError } from "./backend-api";
import { classifyPublicError, PublicErrorQueue, type ErrorReport } from "./public-errors";
const api = (status: number, trace = "trace-1", code?: string) =>
  new BackendApiError(status, trace, "secret raw payload", code);
const lease = { valid: () => true };
const report = (reason: unknown, operation = "read") => ({
  reason,
  operation,
  isCurrent: () => true,
});
function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}

describe("public error ownership, queue and safe retry", () => {
  it("classifies status, business codes and active cancellation without raw copy", () => {
    for (const [status, category] of [
      [401, "session"],
      [403, "permission"],
      [0, "network"],
      [408, "timeout"],
      [409, "business"],
      [503, "service"],
    ] as const) {
      const result = classifyPublicError(api(status, "trace-1", "EXISTING_CODE"));
      expect(result.category).toBe(category);
      expect(result.code).toBe("EXISTING_CODE");
      expect(JSON.stringify(result)).not.toContain("secret");
    }
    expect(classifyPublicError(new DOMException("secret", "AbortError")).category).toBe(
      "cancelled",
    );
    expect(
      classifyPublicError(new BackendApiError(408, "x", "secret", undefined, true)).category,
    ).toBe("cancelled");
    expect(classifyPublicError(api(500, "bad\ntrace")).traceId).toBeUndefined();
    expect(classifyPublicError(new Error("secret")).category).toBe("service");
  });
  it("deduplicates dynamic traces, queues FIFO, and expires the two-second window", () => {
    let now = 0;
    const q = new PublicErrorQueue(
      "TEST:1",
      () => true,
      () => {},
      () => now,
    );
    q.report(lease, report(api(500)));
    q.report(lease, report(api(500, "other")));
    q.report(lease, report(api(403)));
    expect(q.getSnapshot().map((e) => e.category)).toEqual(["service", "permission"]);
    q.dismiss(q.getSnapshot()[0].id);
    now = 1999;
    q.report(lease, report(api(500)));
    expect(q.getSnapshot()).toHaveLength(1);
    now = 2000;
    q.report(lease, report(api(500)));
    expect(q.getSnapshot()).toHaveLength(2);
  });
  it("deduplicates a visible event beyond two seconds", () => {
    let now = 0;
    const q = new PublicErrorQueue(
      "TEST:1",
      () => true,
      () => {},
      () => now,
    );
    q.report(lease, report(api(500)));
    now = 4000;
    q.report(lease, report(api(500)));
    expect(q.getSnapshot()).toHaveLength(1);
  });
  it("keeps operations and codes distinct; clears scope and callbacks", () => {
    const q = new PublicErrorQueue(
      "TEST:1",
      () => true,
      () => {},
    );
    q.report(lease, report(api(409, "a", "A")));
    q.report(lease, report(api(409, "b", "B")));
    q.report(lease, report(api(409, "b", "B"), "other"));
    expect(q.getSnapshot()).toHaveLength(3);
    q.clear();
    expect(q.getSnapshot()).toHaveLength(0);
  });
  it("routes 401 to existing invalidator, keeps 403 session, ignores local/boundary/stale/cancelled", () => {
    let invalidations = 0;
    const q = new PublicErrorQueue(
      "TEST:1",
      () => true,
      () => invalidations++,
    );
    q.report(lease, { ...report(api(403)), retry: { safeReadOnly: true, run: async () => {} } });
    expect(invalidations).toBe(0);
    expect(q.getSnapshot()[0].canRetry).toBe(false);
    q.report(lease, report(api(401)));
    expect(invalidations).toBe(1);
    expect(q.getSnapshot()).toHaveLength(0);
    for (const ownership of ["local", "boundary"] as const)
      q.report(lease, { ...report(api(500)), ownership });
    q.report(lease, { ...report(api(500)), isCurrent: () => false });
    q.report(lease, report(new DOMException("", "AbortError")));
    expect(q.getSnapshot()).toHaveLength(0);
  });
  it("locks duplicate retry, closes on success, reports failure in same slot even in dedup window", async () => {
    const q = new PublicErrorQueue(
      "TEST:1",
      () => true,
      () => {},
    );
    let calls = 0;
    const first = deferred();
    const input: ErrorReport = {
      ...report(api(500)),
      retry: {
        safeReadOnly: true,
        run: () => {
          calls++;
          return first.promise;
        },
      },
    };
    q.report(lease, input);
    const id = q.getSnapshot()[0].id;
    const pending = q.retry(id);
    void q.retry(id);
    expect(calls).toBe(1);
    expect(q.getSnapshot()[0].retrying).toBe(true);
    first.reject(api(408, "new-trace"));
    await pending;
    expect(q.getSnapshot()).toHaveLength(1);
    expect(q.getSnapshot()[0].category).toBe("timeout");
    expect(q.getSnapshot()[0].retrying).toBe(false);
    q.clear();
    q.report(lease, { ...input, retry: { safeReadOnly: true, run: async () => {} } });
    await q.retry(q.getSnapshot()[0].id);
    expect(q.getSnapshot()).toHaveLength(0);
  });
  it("never executes missing, released or invalid callbacks", async () => {
    let valid = true,
      calls = 0;
    const q = new PublicErrorQueue(
      "TEST:1",
      () => valid,
      () => {},
    );
    q.report(lease, report(api(500)));
    await q.retry(q.getSnapshot()[0].id);
    expect(q.getSnapshot()[0].canRetry).toBe(false);
    q.clear();
    q.report(lease, {
      ...report(api(500)),
      retry: {
        safeReadOnly: true,
        run: async () => {
          calls++;
        },
      },
    });
    const id = q.getSnapshot()[0].id;
    valid = false;
    await q.retry(id);
    expect(calls).toBe(0);
    expect(q.getSnapshot()).toHaveLength(0);
    valid = true;
    q.clear();
    q.report(lease, {
      ...report(api(500)),
      retry: {
        safeReadOnly: true,
        run: async () => {
          calls++;
        },
      },
    });
    const released = q.getSnapshot()[0].id;
    q.release(lease);
    await q.retry(released);
    expect(calls).toBe(0);
  });
  it("aborts an in-flight callback on unmount and prevents late feedback", async () => {
    const q = new PublicErrorQueue(
      "TEST:1",
      () => true,
      () => {},
    );
    const wait = deferred();
    let signal!: AbortSignal;
    let current!: () => boolean;
    q.report(lease, {
      ...report(api(500)),
      retry: {
        safeReadOnly: true,
        run: (s, c) => {
          signal = s;
          current = c;
          return wait.promise;
        },
      },
    });
    const pending = q.retry(q.getSnapshot()[0].id);
    q.release(lease);
    expect(signal.aborted).toBe(true);
    expect(current()).toBe(false);
    wait.reject(api(500));
    await pending;
    expect(q.getSnapshot()).toHaveLength(0);
  });
  it("401 retry invalidates; a 403 retry disables further retry", async () => {
    for (const status of [401, 403]) {
      let invalidations = 0;
      const q = new PublicErrorQueue(
        "TEST:1",
        () => true,
        () => invalidations++,
      );
      q.report(lease, {
        ...report(api(500)),
        retry: {
          safeReadOnly: true,
          run: async () => {
            throw api(status);
          },
        },
      });
      await q.retry(q.getSnapshot()[0].id);
      expect(invalidations).toBe(status === 401 ? 1 : 0);
      if (status === 403) expect(q.getSnapshot()[0].canRetry).toBe(false);
      else expect(q.getSnapshot()).toHaveLength(0);
    }
  });
});

it("forwards existing explicit session invalidation signals without a parallel logout", () => {
  const received: string[] = [];
  const queue = new PublicErrorQueue(
    "TEST:1",
    () => true,
    (reason) => received.push(reason),
  );
  for (const reason of ["EXPIRED", "REVOKED", "DISABLED", "ENVIRONMENT_MISMATCH"] as const)
    queue.report(lease, report(reason));
  expect(received).toEqual(["EXPIRED", "REVOKED", "DISABLED", "ENVIRONMENT_MISMATCH"]);
  expect(queue.getSnapshot()).toHaveLength(0);
});

describe("expired request generation cleanup", () => {
  for (const elapsed of [1000, 5000]) {
    it(`replaces an expired same-key error after ${elapsed}ms without unmounting`, async () => {
      let generation = 1;
      let now = 0;
      let retries = 0;
      const q = new PublicErrorQueue(
        "TEST:1",
        () => true,
        () => {},
        () => now,
      );
      q.report(lease, { ...report(api(500, "old-trace")), isCurrent: () => generation === 1 });
      const oldId = q.getSnapshot()[0].id;
      generation = 2;
      now = elapsed;
      q.report(lease, {
        ...report(api(500, "new-trace")),
        isCurrent: () => generation === 2,
        retry: {
          safeReadOnly: true,
          run: async () => {
            retries++;
          },
        },
      });
      expect(q.getSnapshot()).toHaveLength(1);
      expect(q.getSnapshot()[0].id).not.toBe(oldId);
      expect(q.getSnapshot()[0].traceId).toBe("new-trace");
      expect(q.getSnapshot()[0].canRetry).toBe(true);
      await q.retry(q.getSnapshot()[0].id);
      expect(retries).toBe(1);
      expect(q.getSnapshot()).toHaveLength(0);
    });
  }

  it("aborts an expired in-flight retry and ignores its late failure", async () => {
    let generation = 1;
    const q = new PublicErrorQueue(
      "TEST:1",
      () => true,
      () => {},
    );
    const wait = deferred();
    let signal!: AbortSignal;
    let current!: () => boolean;
    let oldCalls = 0;
    q.report(lease, {
      ...report(api(500, "old-trace")),
      isCurrent: () => generation === 1,
      retry: {
        safeReadOnly: true,
        run: (s, c) => {
          oldCalls++;
          signal = s;
          current = c;
          return wait.promise;
        },
      },
    });
    const oldId = q.getSnapshot()[0].id;
    const pending = q.retry(oldId);
    generation = 2;
    q.report(lease, {
      ...report(api(500, "new-trace")),
      retry: { safeReadOnly: true, run: async () => {} },
    });
    expect(signal.aborted).toBe(true);
    expect(current()).toBe(false);
    await q.retry(oldId);
    expect(oldCalls).toBe(1);
    wait.reject(api(401, "late-trace"));
    await pending;
    expect(q.getSnapshot()).toHaveLength(1);
    expect(q.getSnapshot()[0].traceId).toBe("new-trace");
    expect(q.getSnapshot()[0].canRetry).toBe(true);
  });

  for (const advance of ["dismiss", "release", "retry-success"] as const) {
    it(`skips expired queued entries on ${advance} and preserves valid FIFO`, async () => {
      let queuedCurrent = true;
      let staleRetries = 0;
      const firstLease = { valid: () => true };
      const q = new PublicErrorQueue(
        "TEST:1",
        () => true,
        () => {},
      );
      q.report(firstLease, {
        ...report(api(500), "first"),
        retry: { safeReadOnly: true, run: async () => {} },
      });
      q.report(lease, {
        ...report(api(500), "stale"),
        isCurrent: () => queuedCurrent,
        retry: {
          safeReadOnly: true,
          run: async () => {
            staleRetries++;
          },
        },
      });
      q.report(lease, report(api(500), "third"));
      q.report(lease, report(api(500), "fourth"));
      const firstId = q.getSnapshot()[0].id;
      const staleId = q.getSnapshot()[1].id;
      queuedCurrent = false;
      if (advance === "dismiss") q.dismiss(firstId);
      else if (advance === "release") q.release(firstLease);
      else await q.retry(firstId);
      expect(q.getSnapshot().map((e) => e.operation)).toEqual(["third", "fourth"]);
      await q.retry(staleId);
      expect(staleRetries).toBe(0);
    });
  }
});
