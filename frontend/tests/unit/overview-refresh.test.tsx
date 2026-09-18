// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  apiRequest: request,
  ApiError: class extends Error {},
  SESSION_CHANGED: "test-session-changed",
}));
import { useOverview } from "@/lib/api/use-overview";
import { overviewFixture } from "../fixtures/overview";
const path = "/customers/overview?from=2026-09-01&to=2026-09-18";
async function settle() {
  await act(async () => {});
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  request.mockResolvedValue({ data: overviewFixture("CUSTOMER") });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  request.mockReset();
});
it("refreshes after a minute, never polls during an unfinished request and aborts on unmount", async () => {
  const { result, unmount } = renderHook(() => useOverview(path));
  await settle();
  expect(result.current.loading).toBe(false);
  await advance(59_999);
  expect(request).toHaveBeenCalledTimes(1);
  request.mockImplementation(() => new Promise(() => {}));
  await advance(1);
  expect(request).toHaveBeenCalledTimes(2);
  await advance(600_000);
  expect(request).toHaveBeenCalledTimes(2);
  const signal: AbortSignal = request.mock.calls[1][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
});
it("backs off repeated failures to two, four and five minutes then resets for a new date range", async () => {
  request.mockRejectedValue(new Error("unavailable"));
  const { rerender } = renderHook(({ route }) => useOverview(route), {
    initialProps: { route: path },
  });
  await settle();
  for (const [index, delay] of [120_000, 240_000, 300_000].entries()) {
    await advance(delay - 1);
    expect(request).toHaveBeenCalledTimes(index + 1);
    await advance(1);
    expect(request).toHaveBeenCalledTimes(index + 2);
  }
  rerender({ route: `${path}&changed=true` });
  await settle();
  expect(request).toHaveBeenCalledTimes(5);
  await advance(119_999);
  expect(request).toHaveBeenCalledTimes(5);
  request.mockResolvedValue({ data: overviewFixture("CUSTOMER") });
  await advance(1);
  expect(request).toHaveBeenCalledTimes(6);
  await advance(60_000);
  expect(request).toHaveBeenCalledTimes(7);
});
it("pauses hidden or offline polling and refreshes when the visible connection returns", async () => {
  renderHook(() => useOverview(path));
  await settle();
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  await advance(180_000);
  expect(request).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue("visible");
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(request).toHaveBeenCalledTimes(2);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  await advance(180_000);
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(request).toHaveBeenCalledTimes(3);
});
