// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePurchaseResource } from "@/lib/purchase/resource";

const { request, subscribe } = vi.hoisted(() => ({
  request: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock("@/lib/purchase/client", () => ({
  purchaseRequest: request,
  subscribePurchaseAccess: subscribe,
}));
type Record = { id: string; version: number };
const parse = (value: unknown) => value as Record;
let discard: () => void;
function deferred() {
  let resolve!: (value: { data: Record }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ data: Record }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  request.mockReset();
  subscribe.mockReset().mockImplementation((callback) => {
    discard = callback;
    return () => {};
  });
  request.mockResolvedValueOnce({ data: { id: "one", version: 1 } });
});
afterEach(cleanup);

it("keeps the same record mounted during a successful background recheck", async () => {
  const next = deferred();
  request.mockReturnValueOnce(next.promise);
  const { result } = renderHook(() => usePurchaseResource("/purchase/orders/one", parse));
  await waitFor(() => expect(result.current.data?.version).toBe(1));
  act(() => result.current.revalidate());
  await waitFor(() => expect(result.current.refreshing).toBe(true));
  expect(result.current.loading).toBe(false);
  expect(result.current.data).toEqual({ id: "one", version: 1 });
  await act(async () => next.resolve({ data: { id: "one", version: 2 } }));
  await waitFor(() => expect(result.current.data?.version).toBe(2));
  expect(result.current.refreshing).toBe(false);
});

it("clears the record for an explicit refresh", async () => {
  const next = deferred();
  request.mockReturnValueOnce(next.promise);
  const { result } = renderHook(() => usePurchaseResource("/purchase/orders/one", parse));
  await waitFor(() => expect(result.current.data?.id).toBe("one"));
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.loading).toBe(true));
  expect(result.current.data).toBeUndefined();
  await act(async () => next.resolve({ data: { id: "one", version: 2 } }));
});

it("never retains a previous order when the destination changes", async () => {
  const next = deferred();
  request.mockReturnValueOnce(next.promise);
  const { result, rerender } = renderHook(
    ({ path }) => usePurchaseResource(path, parse),
    { initialProps: { path: "/purchase/orders/one" } },
  );
  await waitFor(() => expect(result.current.data?.id).toBe("one"));
  rerender({ path: "/purchase/orders/two" });
  expect(result.current.data).toBeUndefined();
  expect(result.current.loading).toBe(true);
  await act(async () => next.resolve({ data: { id: "two", version: 1 } }));
  await waitFor(() => expect(result.current.data?.id).toBe("two"));
});

it("discards retained data when a background check fails", async () => {
  const next = deferred();
  request.mockReturnValueOnce(next.promise);
  const { result } = renderHook(() => usePurchaseResource("/purchase/orders/one", parse));
  await waitFor(() => expect(result.current.data?.id).toBe("one"));
  act(() => result.current.revalidate());
  await waitFor(() => expect(result.current.refreshing).toBe(true));
  await act(async () => next.reject(new Error("Synthetic access/network failure")));
  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.data).toBeUndefined();
});

it("discards private data immediately on access change and ignores a late response", async () => {
  const next = deferred();
  request.mockReturnValueOnce(next.promise);
  const { result } = renderHook(() => usePurchaseResource("/purchase/orders/one", parse));
  await waitFor(() => expect(result.current.data?.id).toBe("one"));
  act(() => result.current.revalidate());
  await waitFor(() => expect(result.current.refreshing).toBe(true));
  act(() => discard());
  expect(result.current.data).toBeUndefined();
  expect(result.current.failed).toBe(true);
  await act(async () => next.resolve({ data: { id: "one", version: 2 } }));
  expect(result.current.data).toBeUndefined();
});
