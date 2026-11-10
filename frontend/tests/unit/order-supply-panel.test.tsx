// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { OrderSupplyConcerns } from "../../app/components/order-supply-concerns";
import { ApiError, SESSION_CHANGED } from "../../lib/api/client";
import {
  supplyOrder,
  supplySummary,
  supplyChoiceRecord,
  supplyId,
} from "../fixtures/order-supply-concerns";
import { paymentRow } from "../fixtures/work-payments";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  guest: vi.fn(),
  listeners: new Set<() => void>(),
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/api/client")>()),
  apiRequest: mocks.account,
}));
vi.mock("../../lib/purchase/client", () => ({
  purchaseRequest: mocks.guest,
  subscribePurchaseAccess: (callback: () => void) => {
    mocks.listeners.add(callback);
    return () => mocks.listeners.delete(callback);
  },
}));
let root: Root | undefined, container: HTMLDivElement;
const saved = vi.fn(),
  owner = supplyId(99);
function buttons(name: string) {
  const button = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === name,
  );
  if (!button) throw Error(`Missing ${name}`);
  return button;
}
async function click(name: string) {
  await act(async () => buttons(name).click());
}
async function submit(form: HTMLFormElement) {
  await act(async () =>
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
function fill(form: Element, name: string, value: string) {
  const field = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
  field.value = value;
}
function check(form: Element) {
  const field = form.querySelector('[name="confirmed"]') as HTMLInputElement;
  field.checked = true;
}
async function mount(props: Partial<Parameters<typeof OrderSupplyConcerns>[0]> = {}) {
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <OrderSupplyConcerns
        order={supplyOrder()}
        audience="customer"
        onSaved={saved}
        {...props}
      />,
    ),
  );
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: true,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return true;
    },
  }));
  container = document.createElement("div");
  document.body.append(container);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  saved.mockReset();
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  container.remove();
  mocks.account.mockReset();
  mocks.guest.mockReset();
  mocks.listeners.clear();
  vi.unstubAllGlobals();
});
describe("owned supply review interface", () => {
  it("does not make unsupported reads on an older backend", async () => {
    const order = supplyOrder();
    delete (order as { supplyConcernCapabilityVersion?: 1 })
      .supplyConcernCapabilityVersion;
    await mount({ order });
    expect(container.textContent).toBe("");
    expect(mocks.account).not.toHaveBeenCalled();
  });
  it("keeps once-submitted customer choice bound through an uncertain response and reuses the original request", async () => {
    const order = supplyOrder(),
      summary = supplySummary(order);
    let writes = 0;
    mocks.account.mockImplementation(
      async (
        _path: string,
        options?: { method?: string; body?: Record<string, unknown> },
      ) => {
        if (options?.method === "POST") {
          writes++;
          const body = options.body!;
          summary.items[0].supplyRemedyChoices = [
            {
              ...supplyChoiceRecord(),
              choice: body.choice as "REFUND_REVIEW",
              customerNote: String(body.customerNote ?? ""),
              orderVersion: Number(body.expectedVersion),
            },
          ];
          summary.orderVersion++;
          throw Error("Synthetic lost response after commit");
        }
        return { data: structuredClone(summary) };
      },
    );
    await mount({ order });
    const form = container.querySelector("form")!;
    fill(form, "choice", "REFUND_REVIEW");
    check(form);
    await submit(form);
    expect(container.querySelector("dialog")?.textContent).toContain(
      "Request refund review",
    );
    await click("Confirm request");
    expect(container.textContent).toContain("outcome is uncertain");
    await click("Retry same request");
    expect(writes).toBe(1);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Latest request");
    expect(container.textContent).not.toContain("refund paid");
  });
  it("uses guest purchase access and clears private forms on access change", async () => {
    const summary = supplySummary();
    mocks.guest.mockResolvedValue({ data: summary });
    await mount({ audience: "guest" });
    expect(container.textContent).toContain("Synthetic supplier");
    expect(mocks.account).not.toHaveBeenCalled();
    await act(async () => mocks.listeners.forEach((listener) => listener()));
    expect(container.textContent).toContain("Your access changed");
    expect(container.textContent).not.toContain("Synthetic supplier");
    expect(container.querySelector("form")).toBeNull();
  });
  it("discards a late read after account changes without exposing the old case", async () => {
    let resolve: ((value: unknown) => void) | undefined;
    mocks.account.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await mount();
    await act(async () => window.dispatchEvent(new Event(SESSION_CHANGED)));
    await act(async () => resolve!({ data: supplySummary() }));
    expect(container.textContent).toContain("Your access changed");
    expect(container.textContent).not.toContain("Synthetic supplier");
  });
  it("requires fresh owned detail and keeps a load failure distinct from no concerns", async () => {
    const summary = supplySummary();
    summary.orderVersion++;
    mocks.account.mockResolvedValue({ data: summary });
    await mount();
    expect(buttons("Review remedy request").matches(":disabled")).toBe(true);
    expect(container.textContent).toContain("This order changed");
    mocks.account.mockRejectedValue(
      new ApiError(503, { error: { code: "SERVICE_UNAVAILABLE" } }),
    );
    await click("Refresh supply details");
    expect(container.textContent).toContain("could not be confirmed");
    expect(container.textContent).not.toContain("No supply concern");
    expect(buttons("Review remedy request").matches(":disabled")).toBe(true);
  });
  it("keeps staff read-only and does not disclose an internal note to customers", async () => {
    const summary = supplySummary();
    summary.items[0].reason = "Private operator note never shown to this customer";
    mocks.account.mockResolvedValue({ data: summary });
    await mount({ audience: "staff" });
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).not.toContain(summary.items[0].reason!);
  });
  it.each(["REFUND_REVIEW", "SUITABLE_ALTERNATIVE_REVIEW"] as const)(
    "prepares a captured-payment refund for %s with exact affected gross and independent approval",
    async (choiceKind) => {
      const order = supplyOrder(),
        summary = supplySummary(order);
      order.version = 2;
      summary.orderVersion = 2;
      summary.items[0].supplyRemedyChoices = [supplyChoiceRecord()];
      summary.items[0].supplyRemedyChoices[0].choice = choiceKind;
      if (choiceKind === "SUITABLE_ALTERNATIVE_REVIEW")
        summary.items[0].supplyRemedyChoices[0].alternatives = [
          {
            id: supplyId(50),
            status: "ACCEPTED",
            productName: "Synthetic alternative",
            quantity: 2,
            totalKobo: "430",
            currency: "NGN",
            expiresAt: "2026-11-17T09:00:00Z",
            orderId: supplyId(51),
            orderStatus: "PENDING",
          },
        ];
      const payment = paymentRow(0, true);
      payment.id = order.paymentReferences[0].id;
      payment.orderId = order.id;
      payment.invoiceId = null;
      payment.bookingId = null;
      payment.purpose = "ORDER_PAYMENT";
      payment.amountKobo = "320";
      payment.attempts[0].amountKobo = "320";
      let sent: Record<string, unknown> | undefined;
      mocks.account.mockImplementation(
        async (
          path: string,
          options?: { method?: string; body?: Record<string, unknown> },
        ) => {
          if (path.startsWith("/staff/payments/") && options?.method !== "POST")
            return { data: payment };
          if (options?.method === "POST") {
            sent = options.body;
            summary.items[0].supplyRemedyChoices[0].refunds = [
              {
                id: supplyId(77),
                amountKobo: "107",
                currency: "NGN",
                status: "REQUESTED",
                requestedAt: "2026-11-10T09:00:00Z",
                processedAt: null,
              },
            ];
            return {
              data: {
                replayed: false,
                refund: {
                  id: supplyId(77),
                  refundNumber: "REF-SYNTHETIC",
                  paymentAttemptId: payment.attempts[0].id,
                  supplyRemedyChoiceId: supplyId(5),
                  requestedByUserId: owner,
                  approvedByUserId: null,
                  amountKobo: "107",
                  currency: "NGN",
                  status: "REQUESTED",
                  reason: sent!.reason,
                  providerStatus: null,
                  failureCode: null,
                  requestedAt: "2026-11-10T09:00:00Z",
                  approvedAt: null,
                  processedAt: null,
                  failedAt: null,
                  updatedAt: "2026-11-10T09:00:00Z",
                },
              },
            };
          }
          return { data: structuredClone(summary) };
        },
      );
      await mount({ order, audience: "staff", administrator: true, actorUserId: owner });
      const select = [...container.querySelectorAll("select")].find((field) =>
        field.parentElement?.textContent?.includes("Actual original payment"),
      )!;
      await act(async () => {
        select.value = payment.id;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      const form = select.closest("form")!;
      fill(form, "attempt", payment.attempts[0].id);
      fill(form, "reason", "Synthetic exact affected gross and capture reviewed");
      check(form);
      await submit(form);
      expect(container.querySelector("dialog")?.textContent).toContain(
        "A separate authorised operator",
      );
      await click("Confirm request");
      expect(sent).toMatchObject({
        amountKobo: "107",
        supplyRemedyChoiceId: supplyId(5),
        paymentAttemptId: payment.attempts[0].id,
      });
      expect(saved).toHaveBeenCalledOnce();
      expect(container.textContent).toContain("awaiting independent approval");
    },
  );
});
