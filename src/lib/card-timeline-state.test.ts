import { describe, expect, it } from "bun:test";
import {
  CARD_TIMELINE_MAX_PAGES,
  type WalletCardTimelineEvent,
  type WalletCardTimelinePage,
} from "./backend-api";
import {
  CARD_TIMELINE_PAGINATION_ERROR,
  cardTimelineReducer,
  cardTimelineRequestKey,
  cardTimelineViewForScope,
  initialCardTimelineState,
} from "./card-timeline-state";

const cursor = (value: number) =>
  `${Buffer.from(`cursor-${value}`).toString("base64url")}.${Buffer.alloc(32, value).toString("base64url")}`;

const event = (id: number, day = 31): WalletCardTimelineEvent => ({
  id: `timeline_event_${id}`,
  type: "STATUS_CHANGED",
  fromStatus: "PENDING",
  toStatus: "ACTIVE",
  occurredAt: `2026-07-${String(day).padStart(2, "0")}T00:00:00.000Z`,
});

const page = (
  events: readonly WalletCardTimelineEvent[],
  nextCursor: string | null,
): WalletCardTimelinePage => ({ events, nextCursor });

function loadedState() {
  const requestKey = cardTimelineRequestKey("scope-a", null, 1);
  const loading = cardTimelineReducer(initialCardTimelineState, {
    type: "reset",
    scopeKey: "scope-a",
    requestKey,
    loading: true,
  });
  return cardTimelineReducer(loading, {
    type: "page",
    requestKey,
    requestCursor: null,
    page: page([event(1)], cursor(1)),
    append: false,
  });
}

describe("Card timeline state isolation", () => {
  it("hides the entire verified snapshot immediately for a different scope", () => {
    const loaded = loadedState();
    expect(loaded.events).toHaveLength(1);
    const changed = cardTimelineViewForScope(loaded, "scope-b");
    expect(changed.events).toEqual([]);
    expect(changed.nextCursor).toBeNull();
    expect(changed.scopeReady).toBeFalse();
  });

  it("ignores stale success, failure and finally completions", () => {
    const loaded = loadedState();
    const staleKey = cardTimelineRequestKey("scope-a", null, 999);
    expect(
      cardTimelineReducer(loaded, {
        type: "page",
        requestKey: staleKey,
        requestCursor: null,
        page: page([event(9)], null),
        append: false,
      }),
    ).toBe(loaded);
    expect(
      cardTimelineReducer(loaded, {
        type: "failed",
        requestKey: staleKey,
        message: "stale private failure",
        append: false,
      }),
    ).toBe(loaded);
    expect(cardTimelineReducer(loaded, { type: "settled", requestKey: staleKey })).toBe(loaded);
  });

  it("keeps the last verified snapshot through explicit refresh failure and swaps atomically", () => {
    const loaded = loadedState();
    const requestKey = cardTimelineRequestKey("scope-a", null, 2);
    const refreshing = cardTimelineReducer(loaded, {
      type: "refreshing",
      scopeKey: "scope-a",
      requestKey,
    });
    expect(refreshing.events).toEqual(loaded.events);
    expect(refreshing.nextCursor).toBe(loaded.nextCursor);
    const failed = cardTimelineReducer(refreshing, {
      type: "refresh-failed",
      requestKey,
      message: "Card lifecycle timeline refresh failed",
    });
    expect(failed.events).toEqual(loaded.events);
    expect(failed.nextCursor).toBe(loaded.nextCursor);

    const refreshed = cardTimelineReducer(refreshing, {
      type: "refreshed",
      requestKey,
      page: page([event(2)], cursor(2)),
    });
    expect(refreshed.events.map(({ id }) => id)).toEqual(["timeline_event_2"]);
    expect(refreshed.nextCursor).toBe(cursor(2));
  });

  it("clears every verified event and cursor for a current authorization failure", () => {
    const loaded = loadedState();
    const requestKey = cardTimelineRequestKey("scope-a", null, 2);
    const refreshing = cardTimelineReducer(loaded, {
      type: "refreshing",
      scopeKey: "scope-a",
      requestKey,
    });
    const cleared = cardTimelineReducer(refreshing, {
      type: "refresh-failed",
      requestKey,
      message: "Card lifecycle timeline refresh failed",
      clearSnapshot: true,
    });
    expect(cleared.events).toEqual([]);
    expect(cleared.nextCursor).toBeNull();
    expect(cleared.seenCursors).toEqual([]);
    expect(cleared.refreshError).toBe("Card lifecycle timeline refresh failed");
  });

  it("closes pagination on duplicate, rollback, replay and reverse-order continuation", () => {
    for (const nextPage of [
      page([event(1)], cursor(2)),
      page([event(2)], cursor(1)),
      page([event(2)], cursor(1)),
      page([{ ...event(2), occurredAt: "2026-08-01T00:00:00.000Z" }], cursor(2)),
    ]) {
      const loaded = loadedState();
      const requestKey = cardTimelineRequestKey("scope-a", cursor(1), 2);
      const reading = cardTimelineReducer(loaded, {
        type: "loading-more",
        requestKey,
        requestCursor: cursor(1),
      });
      const result = cardTimelineReducer(reading, {
        type: "page",
        requestKey,
        requestCursor: cursor(1),
        page: nextPage,
        append: true,
      });
      expect(result.nextCursor).toBeNull();
      expect(result.error).toBe(CARD_TIMELINE_PAGINATION_ERROR);
      expect(result.events).toEqual(loaded.events);
    }
  });

  it("stops at the bounded tenth page", () => {
    let state = loadedState();
    for (let index = 2; index <= CARD_TIMELINE_MAX_PAGES; index += 1) {
      const requestCursor = cursor(index - 1);
      const requestKey = cardTimelineRequestKey("scope-a", requestCursor, index);
      state = cardTimelineReducer(state, {
        type: "loading-more",
        requestKey,
        requestCursor,
      });
      state = cardTimelineReducer(state, {
        type: "page",
        requestKey,
        requestCursor,
        page: page([event(index, 32 - index)], cursor(index)),
        append: true,
      });
    }
    expect(state.pageCount).toBe(CARD_TIMELINE_MAX_PAGES);
    expect(state.nextCursor).toBeNull();
  });
});
