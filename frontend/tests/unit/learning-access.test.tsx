// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { readLearning, useLearningCatalogue } from "@/lib/learning/read";
import { saveLearningProgress } from "@/lib/learning/progress";
const catalogue = (key: string) => ({
  accessKey: key.repeat(64),
  audience: "public",
  contentVersion: 1,
  mode: "browse_enquiries",
  flags: { guides: true, practice: true, ai: false },
  articles: [],
  guides: [],
  scenarios: [],
});
const response = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

it.each(["aat:session-changed", "aat:workforce-access-changed"])(
  "ignores a slow response after %s and clears only learning progress",
  async (event) => {
    let finishOld: (value: Response) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValue(response(catalogue("b")));
    vi.stubGlobal("fetch", fetcher);
    saveLearningProgress("a".repeat(64), {
      id: "sample",
      version: 1,
      step: 0,
      status: "paused",
      lastActivity: 1,
    });
    sessionStorage.setItem("live-form-draft", "preserve");
    const { result } = renderHook(() => useLearningCatalogue());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new Event(event)));
    await waitFor(() => expect(result.current.data?.accessKey).toBe("b".repeat(64)));
    await act(async () => {
      finishOld(response(catalogue("a")));
    });
    expect(result.current.data?.accessKey).toBe("b".repeat(64));
    expect(
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith("aat:learning-progress"),
      ),
    ).toEqual([]);
    expect(sessionStorage.getItem("live-form-draft")).toBe("preserve");
  },
);
it("fails closed on malformed revalidation instead of retaining a prior catalogue", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(catalogue("a")))
    .mockResolvedValue(response({ privateBody: "not-a-catalogue" }));
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => useLearningCatalogue());
  await waitFor(() => expect(result.current.data).not.toBeNull());
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(result.current.error).toContain("could not be verified"));
  expect(result.current.data).toBeNull();
});
it("uses only bounded GET reads with no operational write token or arbitrary route", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(response(catalogue("a")));
  vi.stubGlobal("fetch", fetcher);
  await readLearning("catalogue", undefined, new AbortController().signal);
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/api/v1/learning/catalogue",
    "/api/v1/public/learning/catalogue",
  ]);
  for (const [, options] of fetcher.mock.calls) {
    expect(options).toMatchObject({
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeUndefined();
  }
  await expect(
    readLearning("scenarios", "../../live-reset", new AbortController().signal),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
