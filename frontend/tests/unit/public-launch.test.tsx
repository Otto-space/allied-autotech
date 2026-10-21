// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  browseEnquiriesOnly,
  publicLaunchMode,
  restrictedLaunchPage,
} from "@/lib/public-launch";
import { ProductActions } from "@/app/components/product-actions";
import { VehicleActions } from "@/app/components/vehicle-actions";
import { dashboardNavigation } from "@/lib/dashboard-navigation";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
it("validates mode explicitly and preserves existing full-mode default", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "");
  expect(publicLaunchMode()).toBe("full");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  expect(browseEnquiriesOnly()).toBe(true);
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "typo");
  expect(() => publicLaunchMode()).toThrow();
});
it.each([
  "cart",
  "orders",
  "bookings",
  "payments",
  "vehicle-transactions",
  "inspections",
  "invoices",
])("restricts direct %s pages", (name) => {
  expect(restrictedLaunchPage(`/dashboard/${name}`)).toBe(true);
  expect(restrictedLaunchPage(`/dashboard/${name}/record`)).toBe(true);
  expect(restrictedLaunchPage(`/admin/${name}`)).toBe(false);
});
it("keeps catalogue and customer-care pages reachable", () => {
  for (const path of [
    "/",
    "/services",
    "/parts",
    "/vehicles",
    "/contact",
    "/login",
    "/admin",
    "/dashboard/support",
  ])
    expect(restrictedLaunchPage(path)).toBe(false);
});
it("hides unavailable customer destinations while preserving staff navigation", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  const customer = dashboardNavigation("CUSTOMER").flatMap((group) => group.links);
  expect(customer.some((link) => restrictedLaunchPage(link.href))).toBe(false);
  expect(customer.some((link) => link.href === "/dashboard/support")).toBe(true);
  expect(
    dashboardNavigation("SUPER_ADMIN")
      .flatMap((group) => group.links)
      .some((link) => link.href === "/admin/orders"),
  ).toBe(true);
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "full");
  expect(
    dashboardNavigation("CUSTOMER")
      .flatMap((group) => group.links)
      .some((link) => link.href === "/dashboard/cart"),
  ).toBe(true);
});
it("renders product enquiries instead of a cart or purchase form", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  const { container } = render(<ProductActions productId="test-product" available />);
  expect(screen.getByRole("link", { name: "Send an enquiry" }).getAttribute("href")).toBe(
    "/contact#enquiry",
  );
  expect(screen.queryByRole("button", { name: /add to cart/i })).toBeNull();
  expect(container.querySelector("form")).toBeNull();
});
it("preserves vehicle content while replacing reservation and inspection actions", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  render(
    <VehicleActions
      listingId="test-listing"
      listingTitle="Owner vehicle"
      branchName="Workshop"
      gallery={<p>Gallery</p>}
      summary={<p>Vehicle price</p>}
    >
      <p>Features</p>
    </VehicleActions>,
  );
  expect(screen.getByText("Gallery")).toBeTruthy();
  expect(screen.getByText("Vehicle price")).toBeTruthy();
  expect(screen.getByText("Features")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /inspection|reserve/i })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Ask on WhatsApp" }).getAttribute("href"),
  ).toContain("Owner%20vehicle");
});
