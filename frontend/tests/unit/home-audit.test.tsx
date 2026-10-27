// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HomeHero } from "@/app/components/home-hero";
import { HomeReviewsPreview } from "@/app/components/home-reviews-preview";

const resource = vi.hoisted(() => ({
  data: { items: [] },
  loading: false,
  refreshing: false,
  error: undefined as string | undefined,
  refreshError: undefined as string | undefined,
  refresh: vi.fn(),
}));
vi.mock("@/lib/api/use-resource", () => ({ useResource: () => resource }));
beforeEach(() => {
  resource.error = undefined;
  resource.refreshError = undefined;
  resource.refreshing = false;
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps service, vehicle and Shop journeys with keyboard wraparound and reduced motion", () => {
  render(<HomeHero />);
  expect(screen.getAllByRole("button", { name: /Show slide/ })).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Pause slideshow" })).toBeNull();
  const region = screen.getByRole("region", { name: "Explore Allied AutoTech" });
  fireEvent.keyDown(region, { key: "ArrowRight" });
  expect(
    screen.getByRole("link", { name: "Explore vehicles" }).getAttribute("href"),
  ).toBe("/vehicles");
  expect(
    screen.getByText(/Availability and inspection arrangements are confirmed/),
  ).toBeTruthy();
  fireEvent.keyDown(region, { key: "ArrowRight" });
  expect(screen.getByRole("link", { name: "Visit the Shop" }).getAttribute("href")).toBe(
    "/parts",
  );
  fireEvent.keyDown(region, { key: "ArrowRight" });
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
    "Built on trust",
  );
});

it("offers a compact review invitation only after a successful empty response", () => {
  const view = render(<HomeReviewsPreview initial={{ data: { items: [] } }} />);
  expect(screen.getByRole("heading", { name: "Your experience matters." })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "About customer reviews" }).getAttribute("href"),
  ).toBe("/reviews");
  resource.refreshError = "Unable to refresh customer feedback.";
  view.rerender(<HomeReviewsPreview initial={{ data: { items: [] } }} />);
  expect(screen.getByText("Unable to refresh customer feedback.")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Your experience matters." })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Refresh customer feedback" }));
  expect(resource.refresh).toHaveBeenCalledOnce();
});
