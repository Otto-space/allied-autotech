// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewCarousel } from "@/app/components/review-carousel";
import type { PublicReview } from "@/lib/api/review-schemas";

const items: PublicReview[] = [1, 2].map((n) => ({
  id: `a7100000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  targetType: "BUSINESS",
  rating: n === 1 ? 3 : 5,
  title: `Feedback ${n}`,
  comment: `Synthetic comment ${n}`,
  createdAt: "2026-09-18T10:03:00Z",
  product: null,
  service: null,
  reviewer: { displayName: n === 1 ? "Ada Okafor" : "Emeka Obi", photoUrl: null },
}));
let reduced = false;
let intersection: IntersectionObserverCallback;

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersection = callback;
      }
      observe() {
        intersection(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const tick = async () =>
  act(async () => {
    vi.advanceTimersByTime(8001);
  });

describe("review carousel", () => {
  it("displays one accessible review at a time with the actual stars and name", () => {
    render(<ReviewCarousel items={items} />);
    expect(
      screen
        .getByText("Ada Okafor")
        .closest("[aria-roledescription='slide']")
        ?.getAttribute("aria-hidden"),
    ).toBe("false");
    expect(screen.getByLabelText("3 out of 5 stars")).toBeTruthy();
    expect(
      screen
        .getByText("Emeka Obi")
        .closest("[aria-roledescription='slide']")
        ?.hasAttribute("inert"),
    ).toBe(true);
  });
  it("rotates only while visible and pauses on hover", async () => {
    render(<ReviewCarousel items={items} />);
    const carousel = screen.getByRole("region");
    fireEvent.mouseEnter(carousel);
    await tick();
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("1 of 2");
    fireEvent.mouseLeave(carousel);
    await tick();
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("2 of 2");
    await act(async () =>
      intersection(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    await tick();
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("2 of 2");
  });
  it("keeps an explicit pause paused and offers a working play control", async () => {
    render(<ReviewCarousel items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause reviews" }));
    await tick();
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("1 of 2");
    fireEvent.click(screen.getByRole("button", { name: "Play reviews" }));
    await tick();
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("2 of 2");
  });
  it("supports keyboard navigation and stops automatic movement after interaction", async () => {
    render(<ReviewCarousel items={items} />);
    fireEvent.focus(screen.getByRole("button", { name: "Next review" }));
    fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowRight" });
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("2 of 2");
    await tick();
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("2 of 2");
  });
  it("honours reduced motion while retaining manual controls", async () => {
    reduced = true;
    render(<ReviewCarousel items={items} />);
    expect(screen.queryByRole("button", { name: "Pause reviews" })).toBeNull();
    await tick();
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("1 of 2");
    fireEvent.click(screen.getByRole("button", { name: "Next review" }));
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("2 of 2");
  });
  it("keeps the selected review through refreshes and falls back when it is removed", () => {
    const { rerender } = render(<ReviewCarousel items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "Next review" }));
    rerender(<ReviewCarousel items={[...items].reverse()} />);
    expect(screen.getByRole("group").textContent).toContain("Emeka Obi");
    rerender(<ReviewCarousel items={[items[0]]} />);
    expect(screen.getByRole("group").textContent).toContain("Ada Okafor");
    expect(screen.queryByRole("button", { name: "Next review" })).toBeNull();
  });
  it("falls back to initials when a real portrait fails to load", () => {
    render(
      <ReviewCarousel
        items={[
          {
            ...items[0],
            reviewer: {
              displayName: "Ada Okafor",
              photoUrl: `/api/v1/public/support/reviews/${items[0].id}/photo`,
            },
          },
        ]}
      />,
    );
    const image = document.querySelector(".reviewer-avatar img")!;
    fireEvent.error(image);
    expect(document.querySelector(".reviewer-avatar")?.textContent).toBe("AO");
    expect(document.querySelector(".reviewer-avatar img")).toBeNull();
  });
});
