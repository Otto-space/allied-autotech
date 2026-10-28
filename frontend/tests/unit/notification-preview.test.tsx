// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NotificationPreview } from "@/app/components/notification-preview";
import { apiRequest } from "@/lib/api/client";
vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }));
const item = {
  id: "b3000000-0000-4000-8000-000000000001",
  type: "SYSTEM",
  category: "SECURITY",
  title: "Your password changed",
  message: "Review account security",
  resourceId: null,
  resourceType: null,
  readAt: null,
  expiresAt: null,
  createdAt: "2026-10-25T10:00:00Z",
};
beforeEach(() => {
  vi.mocked(apiRequest).mockReset();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);
describe("notification bell preview", () => {
  it("fetches only on opening, keeps the real global count and uses the correct role inbox without marking anything read", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      success: true,
      message: "Fixture",
      meta: { requestId: "fixture" },
      data: { items: [item] },
    });
    render(<NotificationPreview customer={false} count={143} />);
    expect(apiRequest).not.toHaveBeenCalled();
    const bell = screen.getByRole("button", { name: "Open notifications, 143 unread" });
    fireEvent.click(bell);
    expect(await screen.findByText("Your password changed")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Unread.*Your password changed/ })
        .getAttribute("href"),
    ).toBe(`/admin/notifications?notification=${item.id}`);
    expect(
      screen.getByRole("link", { name: "View all notifications" }).getAttribute("href"),
    ).toBe("/admin/notifications");
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toBe(
      "/staff/notifications?limit=5&unreadOnly=true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close notification preview" }));
    await waitFor(() => expect(document.activeElement).toBe(bell));
  });
  it("falls back to recent updates when another tab already read the opening unread items", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        success: true,
        message: "Fixture",
        meta: { requestId: "fixture" },
        data: { items: [] },
      })
      .mockResolvedValueOnce({
        success: true,
        message: "Fixture",
        meta: { requestId: "fixture" },
        data: { items: [{ ...item, readAt: "2026-10-25T10:05:00Z" }] },
      });
    render(<NotificationPreview customer count={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Open notifications, 1 unread" }));
    expect(await screen.findByText(item.title)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Read.*Your password changed/ }),
    ).toBeTruthy();
    expect(vi.mocked(apiRequest).mock.calls.map(([url]) => url)).toEqual([
      "/customers/notifications?limit=5&unreadOnly=true",
      "/customers/notifications?limit=5",
    ]);
  });
  it("offers recovery from a failed request and distinguishes empty from failure", async () => {
    vi.mocked(apiRequest)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        success: true,
        message: "Fixture",
        meta: { requestId: "fixture" },
        data: { items: [] },
      });
    render(<NotificationPreview customer count={0} unavailable />);
    fireEvent.click(screen.getByRole("button", { name: /unread status unavailable/ }));
    expect(await screen.findByText("Recent updates could not be loaded.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/You’re up to date/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "View all notifications" }).getAttribute("href"),
    ).toBe("/dashboard/notifications");
  });
  it("does not expose a late response after dismissal", async () => {
    let finish!: (result: Awaited<ReturnType<typeof apiRequest>>) => void;
    vi.mocked(apiRequest).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<NotificationPreview customer count={1} />);
    fireEvent.click(screen.getByRole("button", { name: /Open notifications/ }));
    fireEvent.click(screen.getByRole("button", { name: /Close notification preview/ }));
    finish({
      success: true,
      message: "Fixture",
      meta: { requestId: "fixture" },
      data: { items: [item] },
    });
    await waitFor(() => expect(screen.queryByText(item.title)).toBeNull());
  });
});
