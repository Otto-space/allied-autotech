// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { apiRequest, invalidateWorkforceAccess } from "@/lib/api/client";
import {
  announceWorkforceRefresh,
  discardWorkforceReads,
  isExternalWorkforceRefresh,
  workforceReadGuard,
  WORKFORCE_RECHECK,
} from "@/lib/workforce-invalidation";
import { draftKey } from "@/lib/forms/drafts";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useWorkforceRefresh } from "@/app/components/workforce-workspace";
import { parseWorkforceAccess } from "@/lib/api/workforce-schemas";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
const response = () =>
  new Response(
    JSON.stringify({
      success: true,
      data: { id: "synthetic" },
      message: "Fixture",
      meta: { requestId: "test" },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
it("discards independent-work reads along with responsibility reads", () => {
  const paths = [
    "/staff/profile",
    "/staff/refunds?limit=25",
    "/staff/disputes/example",
    "/staff/privacy-requests",
    "/staff/retention-holds",
    "/staff/finance-policy/current",
  ];
  const reads = paths.map((path) => workforceReadGuard(path)!);
  expect(reads.every(Boolean)).toBe(true);
  discardWorkforceReads();
  expect(reads.every((read) => read.signal.aborted)).toBe(true);
  expect(workforceReadGuard("/public/products")).toBeUndefined();
});
it("aborts stale protected GETs and rejects a late body even when transport ignores abort", async () => {
  let release!: (value: Response) => void;
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue(response());
  vi.stubGlobal("fetch", fetcher);
  const old = apiRequest("/staff/workforce/enquiries");
  const outcome = old.then(
    () => "unexpected",
    (error) => error,
  );
  const signal = fetcher.mock.calls[0][1].signal;
  discardWorkforceReads();
  expect(signal.aborted).toBe(true);
  release(response());
  expect((await outcome).name).toBe("AbortError");
  expect((await apiRequest("/staff/workforce/enquiries")).data).toEqual({
    id: "synthetic",
  });
});
it("does not abort a submitted mutation, the access recheck or unrelated public reads", async () => {
  const signals: AbortSignal[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((_url, options) => {
      signals.push(options.signal);
      return Promise.resolve(response());
    }),
  );
  const requests = [
    apiRequest("/staff/workforce/jobs/test/work", { method: "PATCH", body: {} }),
    apiRequest("/staff/workforce/access"),
    apiRequest("/public/products"),
  ];
  discardWorkforceReads();
  expect(signals.every((signal) => !signal.aborted)).toBe(true);
  await Promise.all(requests);
});
it("clears only the changed operator's protected work drafts and preserves minimal uncertain markers", () => {
  const user = "synthetic-user",
    protectedDraft = draftKey(user + ":STAFF", "/admin/workforce/enquiries", "reply");
  const personal = draftKey(user + ":STAFF", "/admin/security", "password"),
    other = draftKey("other:STAFF", "/admin/workforce/jobs", "work"),
    publicDraft = draftKey(user + ":STAFF", "/parts", "enquiry");
  sessionStorage.setItem("aat:form-draft:v1:malformed-json", "Unrelated invalid key");
  for (const key of [protectedDraft, personal, other, publicDraft])
    sessionStorage.setItem(key, JSON.stringify({ text: "Synthetic draft" }));
  const before = workforceReadGuard("/staff/workforce/jobs")!;
  invalidateWorkforceAccess(user);
  expect(sessionStorage.getItem(protectedDraft)).toBeNull();
  for (const key of [personal, other, publicDraft])
    expect(sessionStorage.getItem(key)).not.toBeNull();
  expect(before.signal.aborted).toBe(true);
  expect(workforceReadGuard("/staff/workforce/jobs")!.generation).toBeGreaterThan(
    before.generation,
  );
});
it("rechecks a scheduled server boundary despite device-clock skew, polls and cleans up", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
  const access = parseWorkforceAccess({
    managed: true,
    userId: "a7000000-0000-4000-8000-000000000001",
    staffId: null,
    position: null,
    department: null,
    version: 0,
    assignments: [],
    permissions: [],
    canManageAssignments: false,
    canInviteAdmins: false,
    serverTime: "2026-10-26T10:00:00Z",
    nextChangeAt: "2026-10-26T10:00:10Z",
    accessRevision: "a".repeat(64),
    capabilityScopes: [],
  });
  const refresh = vi.fn();
  const hook = renderHook(() => useWorkforceRefresh(refresh, access));
  act(() => vi.advanceTimersByTime(10049));
  expect(refresh).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(19950));
  expect(refresh).toHaveBeenCalledTimes(2);
  act(() => window.dispatchEvent(new Event("focus")));
  expect(refresh).toHaveBeenCalledTimes(3);
  hook.unmount();
  act(() => vi.advanceTimersByTime(60000));
  expect(refresh).toHaveBeenCalledTimes(3);
});
it("broadcasts only a recheck hint, excludes its own echo and tolerates unavailable transport", () => {
  const messages: unknown[] = [];
  class Channel {
    postMessage(value: unknown) {
      messages.push(value);
    }
    close() {}
  }
  vi.stubGlobal("BroadcastChannel", Channel);
  const listener = vi.fn();
  window.addEventListener(WORKFORCE_RECHECK, listener);
  try {
    announceWorkforceRefresh();
    expect(listener).toHaveBeenCalledOnce();
    expect(Object.keys(messages[0] as object).sort()).toEqual(["source", "type"]);
    expect(isExternalWorkforceRefresh(messages[0])).toBe(false);
    expect(
      isExternalWorkforceRefresh({ type: "recheck", source: "different-document" }),
    ).toBe(true);
    expect(
      isExternalWorkforceRefresh({ role: "SUPER_ADMIN", permissions: ["FINANCE_READ"] }),
    ).toBe(false);
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        constructor() {
          throw Error("Transport unavailable");
        }
      },
    );
    expect(() => announceWorkforceRefresh()).not.toThrow();
  } finally {
    window.removeEventListener(WORKFORCE_RECHECK, listener);
  }
});
