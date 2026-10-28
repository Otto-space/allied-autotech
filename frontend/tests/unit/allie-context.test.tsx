// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ path: "/", hasHome: true }));
vi.mock("next/navigation", () => ({ usePathname: () => fixture.path }));
vi.mock("@/lib/learning/read", () => ({
  useLearningCatalogue: () => ({
    loading: false,
    data: {
      accessKey: "public-fixture",
      audience: "public",
      contentVersion: 1,
      flags: { guides: true, practice: true, ai: false },
      guides: [],
      scenarios: [],
      articles: fixture.hasHome
        ? [
            {
              id: "home-next-step",
              title: "Choose your next step",
              page: "home",
              summary:
                "Start with Services for vehicle care, Shop for products, or Vehicles for enquiries.",
              steps: ["Choose Services to describe the work you need help with."],
              href: "/services",
              keywords: "homepage",
              version: 1,
              status: "published",
              prerequisites: "Use the available actions.",
              outcome: "Choose a journey.",
              recovery: "Contact the team.",
              source: "Public fixture",
              reviewedAt: "2026-10-27",
            },
          ]
        : [],
    },
  }),
}));
import { AlliePanel } from "@/app/components/learning/allie-panel";
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fixture.path = "/";
  fixture.hasHome = true;
});
afterEach(cleanup);
describe("reviewed route context", () => {
  it("explains the homepage immediately and offers a real service journey", () => {
    render(<AlliePanel onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Explain this page" }));
    expect(screen.getByText(/Start with Services for vehicle care/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Services", exact: true }).getAttribute("href"),
    ).toBe("/services");
    fireEvent.click(screen.getByRole("button", { name: "Choose your next step" }));
    expect(
      screen.getByText("Choose Services to describe the work you need help with."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read answer" }).getAttribute("href")).toBe(
      "/learn?article=home-next-step",
    );
    expect(screen.queryByText(/specific reviewed explanation/)).toBeNull();
  });
  it("does not offer unsupported context against an older or incomplete catalogue", () => {
    fixture.hasHome = false;
    render(<AlliePanel onNavigate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Explain this page" })).toBeNull();
    expect(
      screen.getByRole("textbox", { name: "What do you need help with?" }),
    ).toBeTruthy();
  });
  it("does not reuse homepage guidance as an explanation of another page", () => {
    fixture.path = "/privacy";
    render(<AlliePanel onNavigate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Explain this page" })).toBeNull();
  });
});
