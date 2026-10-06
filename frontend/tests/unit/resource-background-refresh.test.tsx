// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: request,
}));
import { useResource } from "@/lib/api/use-resource";
import { ApiError } from "@/lib/api/client";
const parse = (value: unknown) => String(value);
afterEach(() => {
  cleanup();
  request.mockReset();
});

it("distinguishes background revalidation from an explicit refresh", async () => {
  let finish!: (value: unknown) => void;
  request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() =>
    useResource("/customers/record", parse, "saved", { revalidateOnMount: false }),
  );
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(result.current.loading).toBe(false);
  expect(result.current.refreshing).toBe(true);
  expect(result.current.settledRevision).toBeNull();
  expect(result.current.data).toBe("saved");
  await act(async () => finish({ data: "fresh" }));
  expect(result.current.data).toBe("fresh");
  expect(result.current.refreshing).toBe(false);
  await act(async () => result.current.refresh());
  expect(result.current.loading).toBe(true);
  expect(result.current.refreshing).toBe(false);
});

it("exposes a temporary refresh failure without unmounting the form or claiming a successful refresh", async () => {
  request.mockRejectedValue(
    new ApiError(503, { error: { code: "SERVICE_UNAVAILABLE" } }),
  );
  const { result } = renderHook(() =>
    useResource("/customers/record", parse, "saved", { revalidateOnMount: false }),
  );
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(result.current.data).toBe("saved");
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeUndefined();
  expect(result.current.refreshError).toBeTruthy();
  expect(result.current.settledRevision).toBeNull();
  request.mockResolvedValue({ data: "recovered" });
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(result.current.refreshError).toBeUndefined();
  expect(result.current.data).toBe("recovered");
});

it.each([401, 403, 404])(
  "clears unavailable protected data on background HTTP %s",
  async (status) => {
    request.mockRejectedValue(new ApiError(status, { error: { code: "ACCESS_DENIED" } }));
    const { result } = renderHook(() =>
      useResource("/customers/record", parse, "private", { revalidateOnMount: false }),
    );
    await act(async () => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeUndefined();
    expect(result.current.refreshError).toBeUndefined();
  },
);
