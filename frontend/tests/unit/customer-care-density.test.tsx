// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CustomerCareSummary } from "@/app/components/customer-care-summary";
import { overviewFixture } from "../fixtures/overview";

const empty = overviewFixture("CUSTOMER", undefined, true).care!;
const full = overviewFixture("CUSTOMER").care!;
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

it("offers a compact empty starting point without fabricated record cards or duplicate service actions", () => {
  const { container } = render(<CustomerCareSummary care={empty} />);
  expect(screen.getByRole("heading", { name: "No service in progress" })).toBeTruthy();
  expect(
    container.querySelectorAll(
      ".care-review,.customer-care-next,.customer-care-secondary",
    ),
  ).toHaveLength(0);
  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Manage garage",
    "Get support",
  ]);
});

it.each([
  "quote",
  "payment",
  "order",
  "inspection",
  "notification",
  "nextBooking",
] as const)("keeps an isolated %s visible without other empty records", (key) => {
  const care = { ...empty, [key]: full[key] };
  const { container } = render(<CustomerCareSummary care={care} />);
  expect(screen.queryByText("No service in progress")).toBeNull();
  const expected = {
    quote: "Issued quotation",
    payment: "Payment request",
    order: "Latest order",
    inspection: "Inspection",
    notification: "Latest update",
    nextBooking: "Next booking",
  }[key];
  expect(screen.getByRole("heading", { name: expected })).toBeTruthy();
  expect(container.querySelector(".care-service")).toBeNull();
  expect(screen.queryByText(/No open|No orders|No upcoming|No updates/)).toBeNull();
});

it("retains the garage vehicle without implying service work", () => {
  const { container } = render(
    <CustomerCareSummary
      care={{ ...empty, vehicle: full.vehicle, vehicleSource: "RECENT" }}
    />,
  );
  expect(screen.getByRole("heading", { name: "Your vehicle" })).toBeTruthy();
  expect(screen.getByText("No service in progress")).toBeTruthy();
  expect(screen.getByRole("link", { name: "View vehicle" }).getAttribute("href")).toBe(
    `/dashboard/vehicles/${full.vehicle!.id}`,
  );
  expect(container.querySelector(".care-service")).toBeNull();
});

it.each(["full", "browse_enquiries"])(
  "preserves recorded statuses and history links in %s mode",
  (mode) => {
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", mode);
    const { container } = render(<CustomerCareSummary care={full} />);
    expect(container.querySelectorAll(".care-timeline li")).toHaveLength(3);
    expect(screen.getByText("Requested time", { exact: true })).toBeTruthy();
    expect(screen.getByText("Awaiting workshop confirmation.")).toBeTruthy();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByText("QUO-QA-101")).toBeTruthy();
    for (const name of [
      "View current booking",
      "View quotation",
      "View payment",
      "View order",
    ])
      expect(Boolean(screen.queryByRole("link", { name, exact: true }))).toBe(true);
    expect(screen.getByRole("link", { name: "View vehicle" })).toBeTruthy();
  },
);

it("respects an explicitly selected garage default instead of the latest addition", () => {
  const defaultVehicle = {
    ...full.vehicle!,
    id: "b9000000-0000-4000-8000-000000000301",
    model: "Selected default",
  };
  const care = {
    ...empty,
    vehicle: full.vehicle,
    vehicleSource: "RECENT" as const,
    defaultVehicle,
  };
  render(<CustomerCareSummary care={care} />);
  expect(screen.getByText("Default vehicle")).toBeTruthy();
  expect(screen.getByText(/Selected default/)).toBeTruthy();
  expect(screen.queryByText("Recently added vehicle")).toBeNull();
  expect(screen.getByRole("link", { name: "View vehicle" }).getAttribute("href")).toBe(
    `/dashboard/vehicles/${defaultVehicle.id}`,
  );
});

it("keeps the actual booked vehicle ahead of a different garage default", () => {
  const care = { ...full, defaultVehicle: { ...full.vehicle!, model: "Other default" } };
  render(<CustomerCareSummary care={care} />);
  expect(screen.getByText("Booked vehicle")).toBeTruthy();
  expect(screen.queryByText(/Other default/)).toBeNull();
});

it("keeps open enquiries, issued invoice records and collection readiness ahead of history", () => {
  const care = {
    ...empty,
    enquiry: {
      id: "b9000000-0000-4000-8000-000000000501",
      subject: "My repair question",
      status: "IN_PROGRESS" as const,
      updatedAt: "2026-11-03T12:00:00Z",
    },
    invoice: {
      id: "b9000000-0000-4000-8000-000000000502",
      invoiceNumber: "INV-OWN-1",
      currency: "NGN",
      totalKobo: "9007199254740993",
      issuedAt: "2026-11-03T12:00:00Z",
    },
    collectionOrder: {
      ...full.order!,
      status: "READY" as const,
      fulfillmentMethod: "COLLECTION" as const,
    },
    order: {
      ...full.order!,
      status: "READY" as const,
      fulfillmentMethod: "COLLECTION" as const,
    },
  };
  const { container } = render(<CustomerCareSummary care={care} />);
  expect(screen.getByRole("heading", { name: "Open enquiry" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Issued invoice" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Ready for collection" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "View enquiry" }).getAttribute("href")).toBe(
    `/dashboard/support/enquiries/${care.enquiry.id}`,
  );
  expect(screen.getByRole("link", { name: "View invoice" }).getAttribute("href")).toBe(
    `/dashboard/invoices/${care.invoice.id}`,
  );
  expect(screen.queryByRole("heading", { name: "Latest order" })).toBeNull();
  expect(container.textContent).not.toMatch(/overdue|pay now|balance due/i);
  expect(screen.queryByText("No service in progress")).toBeNull();
});
