// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { invalidateSession } from "@/lib/api/client";

afterEach(cleanup);

it("locks synchronously against duplicate starts before React rerenders", () => {
  const reset = vi.fn();
  const { result } = renderHook(() => useAccountMutation(reset));
  act(() => {
    expect(result.current.begin()).toBeInstanceOf(AbortController);
    expect(result.current.begin()).toBeNull();
  });
});

it("aborts and clears completed or pending account state on each invalidation", () => {
  const reset = vi.fn();
  const { result } = renderHook(() => useAccountMutation(reset));
  let first: AbortController | null = null;
  act(() => {
    first = result.current.begin();
  });
  expect(result.current.busy).toBe(true);
  act(() => invalidateSession());
  expect(first!.signal.aborted).toBe(true);
  expect(result.current.busy).toBe(false);
  expect(result.current.sessionChanged).toBe(true);
  expect(reset).toHaveBeenCalledTimes(1);
  act(() => invalidateSession());
  expect(reset).toHaveBeenCalledTimes(2);
});

it("an old request's finally cannot unlock a new account's pending mutation", () => {
  const reset = vi.fn();
  const { result } = renderHook(() => useAccountMutation(reset));
  let previous: AbortController | null = null;
  let current: AbortController | null = null;
  act(() => {
    previous = result.current.begin();
  });
  act(() => invalidateSession());
  act(() => {
    current = result.current.begin();
  });
  act(() => result.current.finish(previous!));
  expect(result.current.busy).toBe(true);
  expect(result.current.sessionChanged).toBe(false);
  act(() => {
    expect(result.current.begin()).toBeNull();
  });
  act(() => result.current.finish(current!));
  expect(result.current.busy).toBe(false);
});

it("unmount aborts work and removes the reset listener", () => {
  const reset = vi.fn();
  const { result, unmount } = renderHook(() => useAccountMutation(reset));
  let pending: AbortController | null = null;
  act(() => {
    pending = result.current.begin();
  });
  unmount();
  expect(pending!.signal.aborted).toBe(true);
  act(() => invalidateSession());
  expect(reset).not.toHaveBeenCalled();
});
