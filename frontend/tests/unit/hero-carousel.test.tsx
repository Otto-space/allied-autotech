// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HomeHero } from "@/app/components/home-hero";
import { HERO_INTERVAL_MS, heroReducer, initialHeroState } from "@/lib/hero-carousel";

let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("holds the current slide while loading, skips failed images, and terminates when all fail", () => {
  let state = heroReducer(initialHeroState, { type: "ready", index: 0 });
  state = heroReducer(state, { type: "go", direction: 1, manual: true });
  expect(state.current).toBe(0);
  expect(state.pending?.index).toBe(1);
  state = heroReducer(state, { type: "failed", index: 1 });
  expect(state.current).toBe(0);
  expect(state.pending?.index).toBe(2);
  state = heroReducer(state, { type: "ready", index: 2 });
  expect(state.current).toBe(2);
  expect(state.announcement).toBe(2);
  state = heroReducer(state, { type: "failed", index: 2 });
  expect(state.current).toBe(0);
  state = heroReducer(state, { type: "failed", index: 0 });
  expect(state.pending).toBeNull();
  expect(state.failed.every(Boolean)).toBe(true);
});
it("cancels a pending automatic transition on pause without discarding an explicit manual choice", () => {
  let state = heroReducer(initialHeroState, { type: "ready", index: 0 });
  state = heroReducer(state, { type: "go", direction: 1, manual: false });
  state = heroReducer(state, { type: "cancel-auto" });
  state = heroReducer(state, { type: "ready", index: 1 });
  expect(state.current).toBe(0);
  expect(state.pending).toBeNull();
  state = heroReducer(state, { type: "go", index: 2, direction: 1, manual: true });
  state = heroReducer(state, { type: "cancel-auto" });
  state = heroReducer(state, { type: "ready", index: 2 });
  expect(state.current).toBe(2);
});
it("loops beyond three cycles with one timer in StrictMode and clears it on unmount", async () => {
  const view = render(
    <StrictMode>
      <HomeHero />
    </StrictMode>,
  );
  // JSDOM cannot decode images; browser tests cover real network/decode behaviour.
  const images = view.container.querySelectorAll("img");
  for (const img of images)
    Object.defineProperty(img, "decode", {
      value: () => Promise.resolve(),
      configurable: true,
    });
  await act(async () => {
    for (const img of images) fireEvent.load(img);
    await Promise.resolve();
  });
  for (let i = 1; i <= 12; i++) {
    await act(async () => {
      vi.advanceTimersByTime(HERO_INTERVAL_MS);
    });
    expect(view.container.querySelector("section")?.getAttribute("data-slide")).toBe(
      String((i % 3) + 1),
    );
  }
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps laptop hover rotating and preserves a manual/focus pause until explicit Play", () => {
  const view = render(<HomeHero />);
  const root = view.container.querySelector("section")!;
  fireEvent.mouseEnter(root);
  expect(root.getAttribute("data-rotating")).toBe("true");
  fireEvent.mouseLeave(root);
  expect(root.getAttribute("data-rotating")).toBe("true");
  fireEvent.pointerDown(screen.getByRole("button", { name: "Pause slideshow" }));
  fireEvent.focus(screen.getByRole("button", { name: "Pause slideshow" }));
  fireEvent.click(screen.getByRole("button", { name: "Play slideshow" }));
  fireEvent.mouseEnter(root);
  fireEvent.mouseLeave(root);
  expect(root.getAttribute("data-rotating")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Play slideshow" }));
  expect(root.getAttribute("data-rotating")).toBe("true");
  fireEvent.focus(screen.getByRole("link", { name: "View diagnostics" }));
  fireEvent.blur(screen.getByRole("link", { name: "View diagnostics" }));
  expect(root.getAttribute("data-rotating")).toBe("false");
});
it("starts reduced motion paused while retaining controls and one heading", () => {
  reduced = true;
  const view = render(<HomeHero />);
  expect(view.container.querySelector("section")?.getAttribute("data-rotating")).toBe(
    "false",
  );
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Next slide" })).toBeTruthy();
});
it("stops unavailable motion controls when every photo fails while preserving the discovery link", () => {
  const view = render(<HomeHero />);
  for (const img of view.container.querySelectorAll("img")) fireEvent.error(img);
  expect(view.container.querySelector("section")?.getAttribute("data-rotating")).toBe(
    "false",
  );
  for (const button of screen.getAllByRole("button"))
    expect(button.hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByRole("link", { name: "View diagnostics" }).getAttribute("href"),
  ).toBe("/services?search=diagnostics");
});
