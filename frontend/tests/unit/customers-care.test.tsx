// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyableValue } from "@/app/components/copyable-value";
import { SupportEmailDeliverySummary } from "@/app/components/support-email-delivery";
import { apiRequest } from "@/lib/api/client";
vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const item = {
  id: "51000000-0000-4000-8000-000000000002",
  status: "FAILED" as const,
  reason: "RETRY_EXHAUSTED" as const,
  createdAt: "2026-10-22T09:00:00Z",
  sentAt: null,
  attempts: 3,
  nextRetryAt: null,
  providerStatus: null,
  providerUpdatedAt: null,
  noticeEligible: true,
  noticeDismissed: false,
  noticeRevision: "a".repeat(64),
};
describe("customer copy and delivery presentation", () => {
  it("copies the complete permitted value only after activation and confirms after resolution", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    let resolve!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <CopyableValue
        value="complete.customer@example.test"
        display="complete…"
        label="Copy customer email"
      />,
    );
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Copy customer email" }));
    expect(writeText).toHaveBeenCalledWith("complete.customer@example.test");
    expect(screen.queryByText("Copied")).toBeNull();
    resolve();
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
  });
  it("does not report success when blocked and exposes full text for manual selection", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(Error("blocked")) },
    });
    render(
      <CopyableValue
        value="full.customer@example.test"
        display="full…"
        label="Copy customer email"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Copy unavailable"),
    );
    expect(screen.queryByText("Copied")).toBeNull();
    expect(window.getSelection()?.toString()).toBe("full.customer@example.test");
  });
  it("groups repeated notices, dismisses explicit revisions and keeps truthful failure/history", async () => {
    const other = { ...item, id: "51000000-0000-4000-8000-000000000003" };
    vi.mocked(apiRequest).mockResolvedValue({
      success: true,
      message: "Saved",
      data: {
        items: [
          { ...item, noticeDismissed: true },
          { ...other, noticeDismissed: true },
        ],
      },
      meta: { requestId: "test" },
    } as never);
    const refresh = vi.fn();
    render(
      <SupportEmailDeliverySummary
        page={{ items: [item, other] }}
        loading={false}
        onRefresh={refresh}
        dismissPath="/staff/support/enquiries/test/email-deliveries/dismiss"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Dismiss 2 matching delivery notices" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss visible delivery notices" }),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Visible delivery notices")).toBeNull(),
    );
    expect(apiRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: {
          notices: [
            { id: item.id, revision: item.noticeRevision },
            { id: other.id, revision: other.noticeRevision },
          ],
        },
      }),
    );
    expect(screen.getByText("2 failed email updates")).toBeTruthy();
    expect(screen.getByText(/Email delivery history/)).toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("keeps notices on failed/partial acknowledgement and resurfaces material new revisions", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { items: [item] } } as never);
    const { rerender } = render(
      <SupportEmailDeliverySummary
        page={{ items: [item] }}
        loading={false}
        onRefresh={() => {}}
        dismissPath="/dismiss"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss delivery notice " + item.id }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("could not be confirmed"),
    );
    expect(screen.getByLabelText("Visible delivery notices")).toBeTruthy();
    rerender(
      <SupportEmailDeliverySummary
        page={{ items: [{ ...item, noticeRevision: "b".repeat(64) }] }}
        loading={false}
        onRefresh={() => {}}
        dismissPath="/dismiss"
      />,
    );
    expect(screen.getByLabelText("Visible delivery notices")).toBeTruthy();
  });
});
