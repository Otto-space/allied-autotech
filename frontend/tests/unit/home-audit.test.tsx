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

it("keeps one stable offer and the two distinct hero destinations", () => {
  render(<HomeHero />);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "Diagnostics, repairs and automotive essentials.",
  );
  expect(
    screen.getByRole("link", { name: "Explore services" }).getAttribute("href"),
  ).toBe("/services");
  expect(
    screen.getByRole("link", { name: "Contact the team" }).getAttribute("href"),
  ).toBe("/contact#enquiry");
  expect(screen.queryByRole("button")).toBeNull();
});

it("omits verified empty reviews but exposes a failed refresh and recovery action", () => {
  const view = render(<HomeReviewsPreview initial={{ data: { items: [] } }} />);
  expect(view.container.innerHTML).toBe("");
  resource.refreshError = "Unable to refresh customer feedback.";
  view.rerender(<HomeReviewsPreview initial={{ data: { items: [] } }} />);
  expect(screen.getByText("Unable to refresh customer feedback.")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Your experience matters." })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Refresh customer feedback" }));
  expect(resource.refresh).toHaveBeenCalledOnce();
});
