// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  customerNotificationDestination,
  notificationNavigationCounts,
} from "@/lib/notifications/destinations";
import { notificationSummarySchema } from "@/lib/api/notification-schemas";
import {
  useNotificationSummary,
  announceNotificationChange,
} from "@/lib/notifications/use-notification-summary";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import type { SessionState } from "@/lib/api/types";
vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
  SESSION_CHANGED: "session-changed-test",
}));
const id = "b3000000-0000-4000-8000-000000000040";
const group = {
  resourceType: "BOOKING",
  type: "REFUND" as const,
  category: "TRANSACTIONAL" as const,
  count: 130,
};
const summary = { unreadCount: 130, groups: [group] };
const session = (userId: string): SessionState => ({
  id: userId,
  user: { id: userId, email: "test@example.test", role: "CUSTOMER" },
  mfaRequired: false,
  mfaVerifiedAt: null,
  expiresAt: "2027-01-01T00:00:00Z",
  idleExpiresAt: "2027-01-01T00:00:00Z",
});
beforeEach(() => {
  vi.mocked(apiRequest).mockReset();
  vi.stubGlobal("BroadcastChannel", undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("notification destinations", () => {
  it("uses the related booking for a refund update and supports historical casing", () => {
    expect(
      customerNotificationDestination({
        resourceType: "Booking",
        resourceId: id,
        category: "TRANSACTIONAL",
      }),
    ).toEqual({ href: `/dashboard/bookings/${id}`, label: "View booking" });
    expect(notificationNavigationCounts(summary, true)).toEqual({
      "/dashboard/notifications": 130,
      "/dashboard/bookings": 130,
    });
  });
  it("links exact support conversations and reviews", () => {
    for (const [resourceType, path] of [
      ["ENQUIRY", "support/enquiries"],
      ["COMPLAINT", "support/complaints"],
      ["REVIEW", "reviews"],
    ])
      expect(
        customerNotificationDestination({
          resourceType,
          resourceId: id,
          category: "OPERATIONAL",
        })?.href,
      ).toBe(`/dashboard/${path}/${id}`);
  });
  it("never constructs links from untrusted resource paths or missing identifiers", () => {
    for (const resourceId of [
      null,
      "//evil.example",
      "../security",
      `${id}?admin=true`,
      `${id}/other`,
    ])
      expect(
        customerNotificationDestination({
          resourceType: "BOOKING",
          resourceId,
          category: "TRANSACTIONAL",
        }),
      ).toBeNull();
    expect(
      customerNotificationDestination({
        resourceType: "https://evil.example",
        resourceId: id,
        category: "OPERATIONAL",
      }),
    ).toBeNull();
  });
  it("rejects inconsistent and negative counts; includes unknown records only in the bell", () => {
    expect(
      notificationSummarySchema.safeParse({ ...summary, unreadCount: 129 }).success,
    ).toBe(false);
    expect(
      notificationSummarySchema.safeParse({ unreadCount: -1, groups: [] }).success,
    ).toBe(false);
    expect(
      notificationNavigationCounts(
        { unreadCount: 2, groups: [{ ...group, resourceType: "UNKNOWN", count: 2 }] },
        true,
      ),
    ).toEqual({ "/dashboard/notifications": 2 });
    expect(notificationNavigationCounts(summary, false)).toEqual({
      "/admin/notifications": 130,
    });
  });
});
describe("account-scoped notification status", () => {
  it("does not fetch before sign-in and refreshes after a confirmed read change", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      success: true,
      message: "ok",
      meta: { requestId: "test" },
      data: summary,
    });
    const { result, rerender } = renderHook(
      ({ account }: { account: SessionState | null }) => useNotificationSummary(account),
      { initialProps: { account: null as SessionState | null } },
    );
    expect(apiRequest).not.toHaveBeenCalled();
    rerender({ account: session("one") });
    await waitFor(() => expect(result.current?.data?.unreadCount).toBe(130));
    vi.mocked(apiRequest).mockResolvedValue({
      success: true,
      message: "ok",
      meta: { requestId: "test" },
      data: { unreadCount: 0, groups: [] },
    });
    act(() => announceNotificationChange("one"));
    await waitFor(() => expect(result.current?.data?.unreadCount).toBe(0));
  });
  it("clears counts on account change and ignores the previous account's late response", async () => {
    let oldResolve!: (value: Awaited<ReturnType<typeof apiRequest>>) => void;
    vi.mocked(apiRequest)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            oldResolve = resolve;
          }),
      )
      .mockResolvedValueOnce({
        success: true,
        message: "ok",
        meta: { requestId: "test" },
        data: { unreadCount: 0, groups: [] },
      });
    const { result, rerender } = renderHook(
      ({ account }) => useNotificationSummary(account),
      { initialProps: { account: session("one") } },
    );
    rerender({ account: session("two") });
    await waitFor(() => expect(result.current?.data?.unreadCount).toBe(0));
    await act(async () =>
      oldResolve({
        success: true,
        message: "ok",
        meta: { requestId: "test" },
        data: summary,
      }),
    );
    expect(result.current?.data?.unreadCount).toBe(0);
    act(() => window.dispatchEvent(new Event(SESSION_CHANGED)));
    expect(result.current).toBeNull();
  });
  it("does not present a failed unread check as zero or retain stale counts", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        success: true,
        message: "ok",
        meta: { requestId: "test" },
        data: summary,
      })
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useNotificationSummary(session("one")));
    await waitFor(() => expect(result.current?.data?.unreadCount).toBe(130));
    act(() => announceNotificationChange("one"));
    await waitFor(() => expect(result.current?.unavailable).toBe(true));
    expect(result.current?.data).toBeUndefined();
  });
});
