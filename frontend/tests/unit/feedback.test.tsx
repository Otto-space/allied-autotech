// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Feedback } from "@/app/components/feedback";
import { ToastRegion } from "@/app/components/toast-region";
import { clearNotices, noticeSnapshot, notify } from "@/lib/notifications";
import { invalidateSession } from "@/lib/api/client";

const scroll = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 100,
    bottom: 150,
    left: 0,
    right: 100,
    width: 100,
    height: 50,
    x: 0,
    y: 100,
    toJSON: () => ({}),
  });
  HTMLElement.prototype.scrollIntoView = scroll;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});
afterEach(() => {
  cleanup();
  clearNotices();
  scroll.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("keeps an already visible message and keyboard focus in place", () => {
  render(
    <>
      <button>Save</button>
      <Feedback message="Please choose another appointment." />
    </>,
  );
  screen.getByRole("button").focus();
  expect(scroll).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByRole("button"));
  expect(screen.getByRole("alert").textContent).toContain("another appointment");
});

it("scrolls offscreen feedback into view without animation when reduced motion is requested", () => {
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
    top: 1200,
    bottom: 1250,
    left: 0,
    right: 100,
    width: 100,
    height: 50,
    x: 0,
    y: 1200,
    toJSON: () => ({}),
  });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  render(<Feedback message="Your request was received." tone="success" />);
  expect(scroll).toHaveBeenCalledWith({ behavior: "instant", block: "center" });
});

it("does not toast read errors and deduplicates explicit action feedback", () => {
  render(
    <>
      <ToastRegion />
      <Feedback message="Products unavailable." />
      <Feedback
        message="Changes saved on the server."
        tone="success"
        toast="Saved successfully."
      />
    </>,
  );
  expect(noticeSnapshot()).toHaveLength(1);
  act(() => notify("Saved successfully.", { tone: "success" }));
  expect(noticeSnapshot()).toHaveLength(1);
  expect(screen.getAllByText("Saved successfully.")).toHaveLength(1);
});

it("pauses dismissal while hovered and focused, then uses the remaining time", () => {
  render(<ToastRegion />);
  act(() => notify("Profile updated.", { tone: "success", duration: 8000 }));
  act(() => vi.advanceTimersByTime(3000));
  const toast = screen.getByText("Profile updated.").closest(".toast")!;
  fireEvent.mouseEnter(toast);
  act(() => vi.advanceTimersByTime(9000));
  expect(noticeSnapshot()).toHaveLength(1);
  fireEvent.focus(screen.getByRole("button", { name: "Dismiss notification" }));
  fireEvent.mouseLeave(toast);
  act(() => vi.advanceTimersByTime(9000));
  expect(noticeSnapshot()).toHaveLength(1);
  fireEvent.blur(screen.getByRole("button"), { relatedTarget: document.body });
  act(() => vi.advanceTimersByTime(4999));
  expect(noticeSnapshot()).toHaveLength(1);
  act(() => vi.advanceTimersByTime(1));
  expect(noticeSnapshot()).toHaveLength(0);
});

it("keeps errors until dismissal and clears all account feedback on session changes", () => {
  render(<ToastRegion />);
  act(() => notify("Review the inline error.", { tone: "error" }));
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByRole("alert").textContent).toContain("Review the inline error.");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  expect(noticeSnapshot()).toHaveLength(0);
  act(() => notify("Private operation saved.", { tone: "success" }));
  act(() => invalidateSession());
  expect(noticeSnapshot()).toHaveLength(0);
});

it("limits stacked notices and refuses external action destinations", () => {
  render(<ToastRegion />);
  act(() => {
    for (let index = 0; index < 4; index++)
      notify(`Update ${index}`, {
        tone: "info",
        action: { label: "Review", href: "//untrusted.example" },
      });
  });
  expect(noticeSnapshot()).toHaveLength(3);
  expect(screen.queryByRole("link")).toBeNull();
});
