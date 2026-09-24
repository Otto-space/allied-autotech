// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  apiRequest: request,
  ApiError: class extends Error {},
  SESSION_CHANGED: "test-session-changed",
}));
import { useResource } from "@/lib/api/use-resource";
const parse = (value: unknown) => {
  if (typeof value !== "string") throw new Error("Invalid response");
  return value;
};
afterEach(() => {
  cleanup();
  request.mockReset();
});
it("renders a server seed without repeating its fetch, then explicitly refreshes", async () => {
  request.mockResolvedValue({ data: "fresh" });
  const { result } = renderHook(() =>
    useResource("/public/items", parse, "seed", { revalidateOnMount: false }),
  );
  expect(result.current.data).toBe("seed");
  expect(result.current.loading).toBe(false);
  expect(request).not.toHaveBeenCalled();
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.data).toBe("fresh"));
  expect(request).toHaveBeenCalledTimes(1);
});
it("filters discard the prior page immediately and returning to the seed path fetches again", async () => {
  request.mockResolvedValue({ data: "filtered" });
  const { result, rerender } = renderHook(
    ({ path }) => useResource(path, parse, "seed", { revalidateOnMount: false }),
    { initialProps: { path: "/public/items" } },
  );
  rerender({ path: "/public/items?filter=yes" });
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.data).toBe("filtered"));
  request.mockResolvedValue({ data: "new first page" });
  rerender({ path: "/public/items" });
  await waitFor(() => expect(result.current.data).toBe("new first page"));
  expect(request).toHaveBeenCalledTimes(2);
});
it("retains default revalidation for existing callers", async () => {
  request.mockResolvedValue({ data: "fresh private state" });
  const { result } = renderHook(() =>
    useResource("/customers/records", parse, "initial"),
  );
  await waitFor(() => expect(result.current.data).toBe("fresh private state"));
  expect(request).toHaveBeenCalledTimes(1);
});
it("server failure can recover in the browser without claiming an empty list", async () => {
  request.mockResolvedValue({ data: "recovered" });
  const { result } = renderHook(() =>
    useResource("/public/items", parse, undefined, {
      initialError: "Temporarily unavailable",
      revalidateOnMount: false,
    }),
  );
  expect(result.current.error).toBe("Temporarily unavailable");
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.data).toBe("recovered"));
});
it("reconnect and return to the tab revalidate seeded public content", async () => {
  request.mockResolvedValue({ data: "online" });
  const { result } = renderHook(() =>
    useResource("/public/items", parse, "seed", { revalidateOnMount: false }),
  );
  act(() => window.dispatchEvent(new Event("online")));
  await waitFor(() => expect(result.current.data).toBe("online"));
  request.mockResolvedValue({ data: "visible" });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await waitFor(() => expect(result.current.data).toBe("visible"));
});
it("clears private seed after account invalidation without replaying it", () => {
  const { result } = renderHook(() =>
    useResource("/customers/records", parse, "private", { revalidateOnMount: false }),
  );
  act(() => window.dispatchEvent(new Event("test-session-changed")));
  expect(result.current.data).toBeUndefined();
  expect(request).not.toHaveBeenCalled();
});
it("unmount aborts a public refresh", () => {
  request.mockImplementation(() => new Promise(() => {}));
  const { result, unmount } = renderHook(() =>
    useResource("/public/items", parse, "seed", { revalidateOnMount: false }),
  );
  act(() => result.current.refresh());
  const signal: AbortSignal = request.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
});
it("public content reloads after account invalidation instead of staying in loading state", async () => {
  request.mockResolvedValue({ data: "current public content" });
  const { result } = renderHook(() =>
    useResource("/public/items", parse, "seed", { revalidateOnMount: false }),
  );
  act(() => window.dispatchEvent(new Event("test-session-changed")));
  await waitFor(() => expect(result.current.data).toBe("current public content"));
  expect(result.current.loading).toBe(false);
});
it("an external refresh preserves the current page and ignores an older response", async () => {
  let resolveOlder!: (value: { data: string }) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOlder = resolve;
      }),
  );
  const { result, rerender } = renderHook(
    ({ refreshKey }) =>
      useResource("/staff/messages?cursor=current", parse, "saved page", {
        revalidateOnMount: false,
        refreshKey,
      }),
    { initialProps: { refreshKey: 0 } },
  );
  rerender({ refreshKey: 1 });
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(result.current.data).toBe("saved page");
  const olderSignal: AbortSignal = request.mock.calls[0][1].signal;
  request.mockResolvedValueOnce({ data: "new acknowledgement" });
  rerender({ refreshKey: 2 });
  await waitFor(() => expect(result.current.data).toBe("new acknowledgement"));
  expect(olderSignal.aborted).toBe(true);
  await act(async () => {
    resolveOlder({ data: "outdated conversation" });
  });
  expect(result.current.data).toBe("new acknowledgement");
  expect(request.mock.calls.map((call) => call[0])).toEqual([
    "/staff/messages?cursor=current",
    "/staff/messages?cursor=current",
  ]);
});
