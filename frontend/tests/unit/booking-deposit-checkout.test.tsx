// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CustomerBookingDetail } from "@/lib/api/customer-booking-detail-schema";
import { BookingDepositCheckout } from "@/app/components/booking-deposit-checkout";

const mocks = vi.hoisted(() => ({
  enabled: true,
  request: vi.fn(),
  key: vi.fn(() => "safe-idempotency-1234"),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/app/components/public-capabilities", () => ({
  usePublicCapabilities: () => ({ bookingDepositsEnabled: mocks.enabled }),
}));
vi.mock("@/lib/api/client", () => ({
  apiRequest: mocks.request,
  newIdempotencyKey: mocks.key,
  SESSION_CHANGED: "aat:session-changed",
}));

const booking = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "CONFIRMED",
  confirmedAt: "2026-11-23T10:00:00Z",
  scheduledAt: "2026-11-30T10:00:00Z",
  depositPaidAt: null,
  depositPayment: null,
  quotes: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      quoteNumber: "QA-QUOTE-123",
      version: 2,
      status: "ACCEPTED",
      originalInvoice: null,
      totalKobo: "10000000",
    },
  ],
} as unknown as CustomerBookingDetail;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.enabled = true;
});

describe("approved booking deposit checkout", () => {
  it("shows the exact 20% and keeps the request disabled until customer agreement", () => {
    render(<BookingDepositCheckout booking={booking} fresh onRefresh={vi.fn()} />);
    expect(screen.getByText("₦20,000.00")).toBeTruthy();
    expect(screen.getByText("₦80,000.00")).toBeTruthy();
    const button = screen.getByRole("button", { name: /Prepare 20% deposit checkout/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("submits an explicit accepted quote and links only to the returned payment", async () => {
    mocks.request.mockResolvedValue({
      data: { payment: { id: "00000000-0000-4000-8000-000000000003" } },
    });
    render(<BookingDepositCheckout booking={booking} fresh onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Prepare 20% deposit checkout/ }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    expect(mocks.request.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      csrf: true,
      idempotencyKey: "safe-idempotency-1234",
      body: {
        acceptedQuoteId: booking.quotes[0]?.id,
        acceptedQuoteVersion: 2,
        acceptDepositTerms: true,
      },
    });
    expect(
      await screen.findByRole("link", { name: /Continue to Paystack checkout/ }),
    ).toHaveProperty(
      "href",
      expect.stringContaining("/dashboard/payments/00000000-0000-4000-8000-000000000003"),
    );
  });

  it("explains accepted quotation when checkout is disabled without offering payment", () => {
    mocks.enabled = false;
    const view = render(
      <BookingDepositCheckout booking={booking} fresh onRefresh={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: "Quotation accepted" })).toBeTruthy();
    expect(screen.getByText(/No deposit has been requested or charged/)).toBeTruthy();
    expect(view.queryByRole("checkbox")).toBeNull();
    expect(view.queryByRole("button", { name: /deposit checkout/i })).toBeNull();
    mocks.enabled = true;
    view.rerender(
      <BookingDepositCheckout
        booking={{ ...booking, status: "REQUESTED" }}
        fresh
        onRefresh={vi.fn()}
      />,
    );
    expect(view.queryByRole("checkbox")).toBeNull();
  });
});
