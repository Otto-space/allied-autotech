// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { staffOrderRecord } from "../fixtures/work-order-detail";
import { orderRecord } from "../fixtures/customer-orders";
import { PurchaseReviewDecision } from "@/app/components/purchase-review-decision";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api/client", () => ({
  apiRequest: mocks.request,
  SESSION_CHANGED: "test:session-changed",
  ApiError: class extends Error {},
}));
vi.mock("@/lib/api/use-resource", () => ({ useResource: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/components/feedback", () => ({
  Feedback: ({ message }: { message?: string }) =>
    message ? <p role="alert">{message}</p> : null,
}));
vi.mock("@/app/components/mutation-review", () => ({
  MutationReview: ({
    proposal,
    onSuccess,
  }: {
    proposal: { submit: () => Promise<unknown> };
    onSuccess: () => void;
  }) => (
    <button onClick={() => void proposal.submit().then(onSuccess)}>
      Confirm fixture decision
    </button>
  ),
}));
function fixture() {
  const order = staffOrderRecord();
  order.status = "PENDING";
  order.paidAt = null;
  order.allowedTransitions = ["CANCELLED"];
  order.purchaseReviews = [
    {
      ...orderRecord(3).purchaseReviews[0],
      status: "REQUESTED",
      decidedAt: null,
      expiresAt: null,
      requirements: {
        lines: order.items.map((item) => ({ orderItemId: item.id, selection: null })),
      },
    },
  ];
  return order;
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("staff purchase exception decisions", () => {
  it.each(["APPROVED", "DECLINED"])(
    "binds %s to the current offer and never records payment",
    async (decision) => {
      const order = fixture(),
        saved = vi.fn(),
        busy = vi.fn();
      mocks.request.mockImplementation(async (_path, options) => ({
        data: options?.method
          ? {
              ...order,
              version: order.version + 1,
              purchaseReviews: [
                {
                  ...order.purchaseReviews[0],
                  status: decision,
                  decidedAt: new Date().toISOString(),
                  expiresAt: decision === "APPROVED" ? "2099-10-08T09:30:00Z" : null,
                },
              ],
            }
          : order,
      }));
      render(
        <PurchaseReviewDecision
          order={order}
          disabled={false}
          onSaved={saved}
          onBusyChange={busy}
        />,
      );
      fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: decision } });
      fireEvent.change(screen.getByLabelText("Reason and next step"), {
        target: { value: "Synthetic evidence reviewed for this isolated UI test" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Review decision" }));
      expect(mocks.request).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Confirm fixture decision" }));
      await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
      const [path, options] = mocks.request.mock.calls.find(
        ([, options]) => options?.method === "POST",
      )!;
      expect(path).toBe(`/admin/orders/${order.id}/purchase-review/decision`);
      expect(options.body).toMatchObject({
        expectedVersion: order.version,
        expectedRevision: order.purchaseReviews[0].revision,
        decision,
      });
      expect(options.body.availability).toEqual(
        decision === "DECLINED"
          ? []
          : order.items.map((item) => ({
              orderItemId: item.id,
              evidence: { kind: "BRANCH_STOCK" },
            })),
      );
      expect(options.body).not.toHaveProperty("paidAt");
      expect(busy.mock.calls.map(([value]) => value)).toEqual([true, false]);
    },
  );
  it("recovers an already recorded decision without another mutation", async () => {
    const order = fixture(),
      saved = vi.fn();
    mocks.request.mockResolvedValue({
      data: {
        ...order,
        version: order.version + 1,
        purchaseReviews: [
          {
            ...order.purchaseReviews[0],
            status: "DECLINED",
            decidedAt: new Date().toISOString(),
          },
        ],
      },
    });
    render(
      <PurchaseReviewDecision
        order={order}
        disabled={false}
        onSaved={saved}
        onBusyChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "DECLINED" } });
    fireEvent.change(screen.getByLabelText("Reason and next step"), {
      target: { value: "Synthetic offer cannot currently be confirmed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm fixture decision" }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request.mock.calls[0][1]).not.toHaveProperty("method");
  });
  it("keeps the review form unavailable on a paid order", () => {
    const order = fixture();
    order.paidAt = new Date().toISOString();
    render(
      <PurchaseReviewDecision
        order={order}
        disabled={false}
        onSaved={vi.fn()}
        onBusyChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Review decision" })).toBeNull();
  });
});
