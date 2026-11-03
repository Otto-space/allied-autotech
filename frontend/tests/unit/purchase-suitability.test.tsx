// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { orderRecord } from "../fixtures/customer-orders";
import { parseOrder } from "@/lib/api/commerce-schemas";
import { reusablePurchaseSelections } from "@/lib/purchase/suitability";
import { PurchaseSuitability } from "@/app/components/purchase-suitability";
const mocks = vi.hoisted(() => ({ account: vi.fn(), guest: vi.fn() }));
vi.mock("@/lib/api/client", () => ({
  apiRequest: mocks.account,
  SESSION_CHANGED: "test:session-changed",
  ApiError: class extends Error {
    status = 409;
  },
}));
vi.mock("@/lib/purchase/client", () => ({
  purchaseRequest: mocks.guest,
  subscribePurchaseAccess: () => () => undefined,
}));
vi.mock("@/lib/api/use-resource", () => ({ useResource: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/components/feedback", () => ({
  Feedback: ({ message, tone }: { message?: string; tone?: string }) =>
    message ? <p role={tone === "success" ? "status" : "alert"}>{message}</p> : null,
}));
vi.mock("@/app/components/fitment-catalogue-picker", () => ({
  FitmentCataloguePicker: ({
    id,
    value,
    disabled,
  }: {
    id: string;
    value: string;
    disabled: boolean;
  }) => <input id={id} value={value} disabled={disabled} readOnly />,
}));
function pending() {
  const order = parseOrder(orderRecord(3));
  order.purchaseReviews = [];
  order.paymentDueAt = null;
  return order;
}
function reply(current: ReturnType<typeof pending>, lines: unknown) {
  return {
    data: {
      ...current,
      version: 3,
      purchaseReviews: [
        {
          ...orderRecord(3).purchaseReviews[0],
          status: "REQUESTED",
          decidedAt: null,
          expiresAt: null,
          requirements: { lines },
        },
      ],
    },
  };
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("purchase suitability", () => {
  it("reuses configuration from approved matching products without copying price or approval", () => {
    const current = pending(),
      previous = parseOrder(orderRecord(1));
    const reused = reusablePurchaseSelections(current, previous);
    expect(Object.keys(reused)).toEqual(current.items.map((line) => line.id));
    expect(reused[current.items[1].id]).toMatchObject({
      position: "front",
      brakeSystem: "synthetic-fixture-system",
    });
    expect(
      reusablePurchaseSelections(current, { ...previous, purchaseReviews: [] }),
    ).toEqual({});
    expect(reusablePurchaseSelections(current, current)).toEqual({});
    const ambiguous = {
      ...previous,
      items: [...previous.items, { ...previous.items[0], id: current.id }],
    };
    expect(
      reusablePurchaseSelections(current, ambiguous)[current.items[0].id],
    ).toBeUndefined();
    expect(current.purchaseReviews).toEqual([]);
  });
  it.each([false, true])(
    "saves an assistance request using owned access (guest=%s)",
    async (guest) => {
      const current = pending(),
        saved = vi.fn(),
        request = guest ? mocks.guest : mocks.account;
      request.mockImplementation(async (_path, options) =>
        reply(current, options.body.lines),
      );
      render(<PurchaseSuitability order={current} guest={guest} onSaved={saved} />);
      fireEvent.click(
        screen.getByRole("button", { name: "Check details and availability" }),
      );
      await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
      expect(request.mock.calls[0][0]).toBe(
        `${guest ? "/purchase" : "/customers"}/orders/${current.id}/purchase-review`,
      );
      expect(request.mock.calls[0][1].body.lines).toEqual(
        current.items.map((line) => ({ orderItemId: line.id, selection: null })),
      );
      expect(screen.getByRole("status").textContent).toContain(
        "We’ll check suitability and availability",
      );
      expect(guest ? mocks.account : mocks.guest).not.toHaveBeenCalled();
    },
  );
  it("requires an explicit selection before reusing a previous vehicle", async () => {
    const current = pending(),
      previous = parseOrder(orderRecord(1)),
      saved = vi.fn();
    mocks.account.mockImplementation(async (_path, options) =>
      options?.method
        ? reply(current, options.body.lines)
        : { data: { items: [previous] } },
    );
    render(<PurchaseSuitability order={current} onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Find previous purchases" }));
    const reuse = await screen.findByRole("button", {
      name: `Use details from ${previous.orderNumber}`,
    });
    expect((screen.getAllByLabelText("Intended use")[0] as HTMLSelectElement).value).toBe(
      "help",
    );
    fireEvent.click(reuse);
    expect((screen.getAllByLabelText("Intended use")[0] as HTMLSelectElement).value).toBe(
      "vehicle",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Check details and availability" }),
    );
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    const body = mocks.account.mock.calls.find(
      ([, options]) => options?.method === "POST",
    )?.[1].body;
    expect(body.lines[0].selection).toMatchObject({
      vehicleModelId:
        previous.purchaseReviews[0].requirements.lines[0].selection?.vehicleModelId,
      year: 2026,
    });
    expect(body.lines[1].selection.position).toBe("front");
    expect(body).not.toHaveProperty("priceKobo");
  });
  it("recovers a saved request after a lost response without another POST", async () => {
    const current = pending(),
      saved = vi.fn();
    let sent: { lines: unknown };
    mocks.account.mockImplementation(async (_path, options) => {
      if (options?.method === "POST") {
        sent = options.body;
        throw Error("Response lost");
      }
      return reply(current, sent.lines);
    });
    render(<PurchaseSuitability order={current} onSaved={saved} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Check details and availability" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Check saved details" }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(
      mocks.account.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(1);
  });
  it("keeps optional changes collapsed on an already verified order", () => {
    render(<PurchaseSuitability order={parseOrder(orderRecord(3))} onSaved={vi.fn()} />);
    expect(
      screen.getByText("Change vehicle or part details").closest("details")!.open,
    ).toBe(false);
    expect(mocks.account).not.toHaveBeenCalled();
  });
  it("discards private input and ignores a late response when the session changes", async () => {
    let resolve!: (value: unknown) => void;
    const current = pending(),
      saved = vi.fn();
    mocks.account.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render(<PurchaseSuitability order={current} onSaved={saved} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Check details and availability" }),
    );
    fireEvent(window, new Event("test:session-changed"));
    await act(async () => resolve({ data: current }));
    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Your access changed");
  });
});
