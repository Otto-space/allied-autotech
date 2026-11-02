// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { publicLaunchMode, type PublicLaunchMode } from "@/lib/public-launch";
import { capabilityView } from "@/lib/public-capabilities";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
import { PublicCapabilitiesProvider } from "@/app/components/public-capabilities";
import type { ReactNode } from "react";
const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const release = () =>
  capabilityView(
    publicCapabilitiesFixture(
      (process.env.NEXT_PUBLIC_PUBLIC_LAUNCH_MODE || "full") as PublicLaunchMode,
    ),
  );
const restrictedLaunchPage = (path: string) => release().restrictedLaunchPage(path);
const browseEnquiriesOnly = () => release().browseEnquiriesOnly();
const renderCurrent = (node: ReactNode) =>
  render(
    <PublicCapabilitiesProvider initial={release().snapshot}>
      {node}
    </PublicCapabilitiesProvider>,
  );
const dashboardNavigation = (...args: Parameters<typeof navigation>) =>
  navigation(args[0], args[1], release());
import { ProductActions } from "@/app/components/product-actions";
import { VehicleActions } from "@/app/components/vehicle-actions";
import { dashboardNavigation as navigation } from "@/lib/dashboard-navigation";
import { PublicEnquiryForm } from "@/app/components/public-enquiry-form";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
it("closes customer entry points in catalogue mode while retaining staff access", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "catalogue");
  expect(publicLaunchMode()).toBe("catalogue");
  for (const path of [
    "/register",
    "/dashboard",
    "/dashboard/support",
    "/payments/complete",
  ])
    expect(restrictedLaunchPage(path)).toBe(true);
  for (const path of ["/login", "/mfa", "/admin", "/services", "/contact", "/privacy"])
    expect(restrictedLaunchPage(path)).toBe(false);
});
it("offers external contact without mounting an enquiry form in catalogue mode", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "catalogue");
  const { container } = renderCurrent(<PublicEnquiryForm />);
  expect(container.querySelector("form")).toBeNull();
  expect(container.querySelector("input,textarea,select")).toBeNull();
  expect(
    screen.getByRole("link", { name: "Enquire by email" }).getAttribute("href"),
  ).toContain("mailto:support@alliedautotech.com");
});
it("validates mode explicitly and preserves existing full-mode default", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "");
  expect(publicLaunchMode()).toBe("full");
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  expect(browseEnquiriesOnly()).toBe(true);
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "typo");
  expect(() => publicLaunchMode()).toThrow();
});
it.each(["cart"])("restricts direct %s pages", (name) => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
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
it("keeps existing orders visible while disabling new checkout in limited releases", () => {
  for (const mode of ["browse_enquiries", "catalogue"]) {
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", mode);
    const shop = dashboardNavigation("CUSTOMER").find((group) => group.id === "shop");
    if (mode === "catalogue") expect(shop).toBeUndefined();
    else {
      expect(shop?.label).toBe("Orders & saved items");
      expect(shop?.links.map((link) => link.href)).toEqual([
        "/dashboard/orders",
        "/dashboard/saved",
      ]);
    }
  }
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "full");
  const shop = dashboardNavigation("CUSTOMER").find((group) => group.id === "shop");
  expect(shop?.label).toBe("Orders & saved items");
  expect(shop?.links.map((link) => link.href)).toEqual([
    "/dashboard/orders",
    "/dashboard/cart",
    "/dashboard/saved",
  ]);
});
it("renders product enquiries instead of a cart or purchase form", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  const { container } = renderCurrent(
    <ProductActions productId="test-product" available />,
  );
  expect(screen.getByRole("link", { name: "Send an enquiry" }).getAttribute("href")).toBe(
    "/contact#enquiry",
  );
  expect(screen.queryByRole("button", { name: /add to cart/i })).toBeNull();
  expect(container.querySelector("form")).toBeNull();
});
it("preserves vehicle content while replacing reservation and inspection actions", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  renderCurrent(
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

it("preserves historical transaction destinations while new cart checkout stays gated", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  for (const path of [
    "orders",
    "bookings",
    "payments",
    "invoices",
    "inspections",
    "vehicle-transactions",
  ]) {
    expect(restrictedLaunchPage(`/dashboard/${path}`)).toBe(false);
    expect(restrictedLaunchPage(`/dashboard/${path}/record`)).toBe(false);
  }
  expect(restrictedLaunchPage("/dashboard/cart")).toBe(true);
});

it("keeps checkout reachable only in full mode while preserving historical records", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "full");
  expect(restrictedLaunchPage("/dashboard/cart")).toBe(false);
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  expect(restrictedLaunchPage("/dashboard/cart")).toBe(true);
  for (const route of [
    "orders",
    "bookings",
    "payments",
    "invoices",
    "inspections",
    "vehicle-transactions",
  ]) {
    expect(restrictedLaunchPage(`/dashboard/${route}/owned-record`)).toBe(false);
  }
});
