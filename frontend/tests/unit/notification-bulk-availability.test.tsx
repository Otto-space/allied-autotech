// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  unreadCount: 0,
  failed: false,
  loading: false,
  refresh: vi.fn(),
  run: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/lib/api/use-resource", () => ({
  useResource: (path: string | null) => ({
    data: !path
      ? undefined
      : path.endsWith("/summary")
        ? { unreadCount: fixture.unreadCount, groups: [] }
        : { items: [], hasMore: false },
    loading: path?.endsWith("/summary") && fixture.loading,
    error: path?.endsWith("/summary") && fixture.failed ? "Unavailable" : undefined,
    refresh: fixture.refresh,
    revalidate: fixture.refresh,
  }),
}));
vi.mock("@/lib/notifications/use-notification-write", () => ({
  useNotificationWrite: () => ({
    disabled: false,
    run: fixture.run,
    refresh: fixture.refresh,
  }),
}));
vi.mock("@/app/components/mutation-review", () => ({
  MutationReview: ({ proposal }: { proposal: { title: string } }) => (
    <div role="dialog">{proposal.title}</div>
  ),
}));
import { AccountNotificationInbox } from "@/app/components/account-notifications";
beforeEach(() => {
  fixture.unreadCount = 0;
  fixture.failed = false;
  fixture.loading = false;
  vi.clearAllMocks();
});
afterEach(cleanup);
describe("whole-inbox bulk read availability", () => {
  it("disables a redundant bulk mutation when the authoritative count is zero", () => {
    render(<AccountNotificationInbox userId="fixture-customer" />);
    const button = screen.getByRole("button", {
      name: "Mark all read",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fixture.run).not.toHaveBeenCalled();
  });
  it("allows review for unread items outside an empty filtered page without sending yet", () => {
    fixture.unreadCount = 3;
    render(<AccountNotificationInbox userId="fixture-customer" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(screen.getByRole("dialog").textContent).toContain(
      "Mark all notifications as read?",
    );
    expect(fixture.run).not.toHaveBeenCalled();
  });
  it.each(["failed", "loading"] as const)(
    "does not treat an %s summary as known unread state",
    (state) => {
      fixture.unreadCount = 3;
      fixture[state] = true;
      render(<AccountNotificationInbox userId="fixture-customer" />);
      expect(
        (screen.getByRole("button", { name: "Mark all read" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    },
  );
  it("refreshes the unread summary after an explicit retry", () => {
    fixture.failed = true;
    render(<AccountNotificationInbox userId="fixture-customer" />);
    fireEvent.click(screen.getByRole("button", { name: "Retry unread total" }));
    expect(fixture.refresh).toHaveBeenCalledOnce();
  });
});
