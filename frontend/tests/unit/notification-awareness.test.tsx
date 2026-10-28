// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  customerNotificationDestination,
  notificationNavigationCounts,
} from "@/lib/notifications/destinations";
import {
  notificationSummarySchema,
  notificationDestinationSchema,
} from "@/lib/api/notification-schemas";
import {
  useNotificationSummary,
  announceNotificationChange,
  subscribeNotificationChanges,
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
  vi.unstubAllEnvs();
});
describe("notification destinations", () => {
  it.each(["full", "browse_enquiries"])(
    "respects %s release destinations without reviving unavailable records",
    (mode) => {
      vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", mode);
      const record = {
        resourceType: "BOOKING",
        resourceId: id,
        category: "TRANSACTIONAL" as const,
      };
      const destination = {
        section: "/dashboard/bookings",
        href: `/dashboard/bookings/${id}`,
        label: "View booking",
      };
      const expected =
        mode === "full"
          ? { href: destination.href, label: destination.label }
          : { href: "/contact", label: "Contact about this update" };
      expect(customerNotificationDestination(record)).toEqual(expected);
      expect(customerNotificationDestination({ ...record, destination })).toEqual(
        mode === "full" ? destination : expected,
      );
      expect(
        customerNotificationDestination({ ...record, destination: null }),
      ).toBeNull();
      expect(
        customerNotificationDestination({
          resourceType: "REVIEW",
          resourceId: id,
          category: "OPERATIONAL",
        })?.href,
      ).toBe(`/dashboard/reviews/${id}`);
    },
  );
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
  it("uses authoritative current target counts and does not revive a revoked destination", () => {
    const scoped = {
      ...summary,
      destinations: [
        {
          section: "/dashboard/bookings",
          count: 1,
          recordCount: 1,
          href: `/dashboard/notifications?notification=${id}`,
        },
      ],
    };
    expect(notificationNavigationCounts(scoped, true)).toEqual({
      "/dashboard/notifications": 130,
      "/dashboard/bookings": 1,
    });
    expect(
      customerNotificationDestination({
        resourceType: "BOOKING",
        resourceId: id,
        category: "TRANSACTIONAL",
        destination: null,
      }),
    ).toBeNull();
    expect(
      notificationSummarySchema.safeParse({
        ...scoped,
        destinations: [{ ...scoped.destinations[0], recordCount: 2 }],
      }).success,
    ).toBe(false);
    for (const href of [
      "https://example.test/path",
      "//example.test/path",
      "/admin/../%2f%2fexample.test",
      "/admin/\\example.test",
    ])
      expect(
        notificationDestinationSchema.safeParse({
          section: "/dashboard/bookings",
          href,
          label: "View",
        }).success,
      ).toBe(false);
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
  it("refreshes an opted-in whole-inbox count on summary-only changes without refreshing the list", () => {
    const list = vi.fn(),
      count = vi.fn();
    const stopList = subscribeNotificationChanges("one", list);
    const stopCount = subscribeNotificationChanges("one", count, true);
    announceNotificationChange("other", false);
    expect(count).not.toHaveBeenCalled();
    announceNotificationChange("one", false);
    expect(count).toHaveBeenCalledOnce();
    expect(list).not.toHaveBeenCalled();
    stopList();
    stopCount();
  });
  it("summary-only refresh does not replace an intentional foreground inbox refresh", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeNotificationChanges("one", listener);
    announceNotificationChange("one", false);
    expect(listener).not.toHaveBeenCalled();
    announceNotificationChange("other");
    expect(listener).not.toHaveBeenCalled();
    announceNotificationChange("one");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
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
