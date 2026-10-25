// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationRecordContext } from "@/app/components/notification-record-context";
import { apiRequest } from "@/lib/api/client";
const fixture = vi.hoisted(() => ({ records: {} as Record<string, unknown> }));
vi.mock("@/app/components/dashboard-shell", () => ({
  useAccountSession: () => ({ id: "session", user: { id: "actor", role: "CUSTOMER" } }),
}));
vi.mock("@/lib/api/use-resource", () => ({ useResource: () => fixture.records }));
vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
  SESSION_CHANGED: "fixture-session-changed",
}));
vi.mock("@/lib/notifications/use-notification-summary", () => ({
  announceNotificationChange: vi.fn(),
}));
const id = "b3000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockResolvedValue({
      success: true,
      message: "Fixture",
      meta: { requestId: "fixture" },
      data: { updated: 1 },
    });
  fixture.records = {
    loading: false,
    refreshing: false,
    settledRevision: 1,
    revalidate: vi.fn(),
    data: {
      items: [
        {
          id,
          title: "Synthetic update",
          message: "Review this record",
          resourceType: "BOOKING",
          resourceId: "record",
          supportMessageId: null,
        },
      ],
      hasMore: false,
    },
  };
});
afterEach(cleanup);
describe("explicit source notification read contract", () => {
  it("never marks a record read merely on render, scrolling or hovering", async () => {
    render(<NotificationRecordContext resourceType="BOOKING" resourceId="record" />);
    fireEvent.scroll(window);
    fireEvent.mouseOver(screen.getByText("Synthetic update"));
    await Promise.resolve();
    expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Mark displayed updates as read" }),
    );
    await screen.findByText(/Displayed updates marked as read/);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith(
      "/customers/notifications/read-context",
      expect.objectContaining({
        method: "POST",
        csrf: true,
        body: { resourceType: "BOOKING", resourceId: "record", notificationIds: [id] },
      }),
    );
    fireEvent.scroll(window);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
  it("a failure keeps the record usable and requires an explicit retry", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(Error("unavailable"));
    render(<NotificationRecordContext resourceType="BOOKING" resourceId="record" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Mark displayed updates as read" }),
    );
    await screen.findByText(/read status could not be saved/);
    fireEvent.scroll(window);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry read update" }));
    await screen.findByText(/Displayed updates marked as read/);
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
  it("a later authoritative revision can make the notification unread again", async () => {
    const view = render(
      <NotificationRecordContext resourceType="BOOKING" resourceId="record" />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Mark displayed updates as read" }),
    );
    await screen.findByText(/Displayed updates marked as read/);
    fixture.records = { ...fixture.records, settledRevision: 2 };
    view.rerender(
      <NotificationRecordContext resourceType="BOOKING" resourceId="record" />,
    );
    expect(
      screen.getByRole("button", { name: "Mark displayed updates as read" }),
    ).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
  it("prevents duplicate clicks while a read is pending", async () => {
    let resolve!: (response: Awaited<ReturnType<typeof apiRequest>>) => void;
    vi.mocked(apiRequest).mockImplementation(
      () =>
        new Promise((finish) => {
          resolve = finish;
        }),
    );
    render(<NotificationRecordContext resourceType="BOOKING" resourceId="record" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Mark displayed updates as read" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Saving read status…" }));
    expect(apiRequest).toHaveBeenCalledTimes(1);
    resolve({
      success: true,
      message: "Fixture",
      meta: { requestId: "fixture" },
      data: { updated: 1 },
    });
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });
});
