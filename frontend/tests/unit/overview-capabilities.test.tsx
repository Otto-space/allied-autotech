// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { overviewFixture } from "../fixtures/overview";
import { restrictedLaunchPage } from "@/lib/public-launch";
const current = vi.hoisted(() => ({ role: "CUSTOMER" }));
vi.mock("@/app/components/dashboard-shell", () => ({
  useAccountSession: () => ({ user: { role: current.role } }),
}));
vi.mock("@/lib/api/use-overview", () => ({
  useOverview: () => ({ data: overviewFixture(current.role), refresh: vi.fn() }),
}));
import { RoleOverview } from "@/app/components/role-overview";
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  current.role = "CUSTOMER";
});
it("keeps existing customer records readable without advertising restricted destinations", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  const { container } = render(<RoleOverview customerDesign />);
  expect(
    screen.getByRole("link", { name: "Request a service visit" }).getAttribute("href"),
  ).toBe("/services");
  expect(container.textContent).toContain("ORD-TEST-0101");
  expect(container.textContent).toContain("NGN 85,000.00");
  expect(container.textContent).toContain("payment collection are unavailable");
  for (const link of container.querySelectorAll("a"))
    expect(restrictedLaunchPage(link.getAttribute("href")!)).toBe(false);
});
it("preserves full-release historical record links and normal commerce navigation", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "full");
  render(<RoleOverview customerDesign />);
  expect(
    screen.getByRole("link", { name: "View current booking" }).getAttribute("href"),
  ).toMatch(/^\/dashboard\/bookings\//);
  expect(screen.getByRole("link", { name: "View payment" }).getAttribute("href")).toMatch(
    /^\/dashboard\/payments\//,
  );
  expect(screen.getByRole("link", { name: "Book a service" })).toBeTruthy();
});
it("retains permitted operational record navigation even in an enquiries release", () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  current.role = "ADMIN";
  render(<RoleOverview />);
  expect(screen.getByRole("link", { name: /Parts orders/ }).getAttribute("href")).toBe(
    "/admin/orders",
  );
  expect(
    screen.getByRole("link", { name: /Payments collected/ }).getAttribute("href"),
  ).toBe("/admin/payments");
});
