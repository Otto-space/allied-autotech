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
  "preserves recorded statuses and launch restrictions in %s mode",
  (mode) => {
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", mode);
    const { container } = render(<CustomerCareSummary care={full} />);
    expect(container.querySelectorAll(".care-timeline li")).toHaveLength(3);
    expect(screen.getByText("Requested time; awaiting confirmation.")).toBeTruthy();
    expect(screen.getByText("QUO-QA-101")).toBeTruthy();
    for (const name of [
      "View current booking",
      "View quotation",
      "View payment",
      "View order",
    ])
      expect(Boolean(screen.queryByRole("link", { name, exact: true }))).toBe(
        mode === "full",
      );
    expect(screen.getByRole("link", { name: "View vehicle" })).toBeTruthy();
  },
);
