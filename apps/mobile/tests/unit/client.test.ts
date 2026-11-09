import { z } from "zod";
import { createApiClient } from "../../src/api/client";
import { ApiError, parseRetryAfter } from "../../src/api/errors";

const base = "http://127.0.0.1:4000/api/v1";
function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: {
      get: (name: string) =>
        Object.entries(headers).find(
          ([key]) => key.toLowerCase() === name.toLowerCase(),
        )?.[1] ?? null,
    },
  } as Response;
}
const schema = z.object({ value: z.string() });
test("success envelope validated and only anonymous no-store GET sent", async () => {
  const fetcher = jest.fn().mockResolvedValue(
    response({
      success: true,
      message: "Loaded",
      data: { value: "verified" },
      meta: { requestId: "request-test" },
    }),
  );
  await expect(
    createApiClient(base, fetcher).get("/public/services", schema),
  ).resolves.toEqual({ value: "verified" });
  expect(fetcher).toHaveBeenCalledWith(
    `${base}/public/services`,
    expect.objectContaining({
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      headers: { Accept: "application/json" },
    }),
  );
});
test("rejects incomplete generated-any success responses", async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ success: true, data: "wrong" }));
  await expect(
    createApiClient(base, fetcher).get("/public/services", schema),
  ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
test("normalizes error envelope fields and requestId", async () => {
  const fields = [{ path: "field", message: "Invalid" }];
  const fetcher = jest.fn().mockResolvedValue(
    response(
      {
        success: false,
        message: "Request rejected",
        error: { code: "VALIDATION_ERROR", fields },
        meta: { requestId: "body-id" },
      },
      422,
      { "X-Request-ID": "header-id" },
    ),
  );
  await expect(
    createApiClient(base, fetcher).get("/public/services", schema),
  ).rejects.toMatchObject({
    status: 422,
    code: "VALIDATION_ERROR",
    message: "Request rejected",
    requestId: "body-id",
    fieldErrors: fields,
  });
});
test("429 surfaces Retry-After and header requestId", async () => {
  const fetcher = jest.fn().mockResolvedValue(
    response(
      {
        success: false,
        error: { code: "RATE_LIMITED", message: "Wait before retrying" },
      },
      429,
      { "Retry-After": "45", "X-Request-ID": "header-id" },
    ),
  );
  await expect(
    createApiClient(base, fetcher).get("/public/services", schema),
  ).rejects.toMatchObject({ retryAfterSeconds: 45, requestId: "header-id" });
  expect(
    parseRetryAfter("Mon, 09 Nov 2026 00:00:30 GMT", Date.parse("2026-11-09T00:00:00Z")),
  ).toBe(30);
});
const hangingFetch = jest.fn(
  (_url: unknown, options: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      if (options.signal?.aborted) reject(new Error("aborted"));
      else options.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }),
);
test("timeout aborts request and normalizes ApiError", async () => {
  jest.useFakeTimers();
  const promise = createApiClient(base, hangingFetch as typeof fetch, 10).get(
    "/public/services",
    schema,
  );
  const assertion = expect(promise).rejects.toMatchObject({ code: "TIMEOUT", status: 0 });
  await jest.advanceTimersByTimeAsync(10);
  await assertion;
  jest.useRealTimers();
});
test("external cancellation and pre-aborted signal normalize safely", async () => {
  const controller = new AbortController();
  const promise = createApiClient(base, hangingFetch as typeof fetch).get(
    "/public/services",
    schema,
    controller.signal,
  );
  controller.abort();
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(
    createApiClient(base, hangingFetch as typeof fetch).get(
      "/public/services",
      schema,
      controller.signal,
    ),
  ).rejects.toMatchObject({ code: "ABORTED" });
});
