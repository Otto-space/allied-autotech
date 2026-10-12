import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { PaystackAdapter } from "../../src/providers/payments/paystack.adapter.js";
import { MonnifyAdapter } from "../../src/providers/payments/monnify.adapter.js";
import { ResendEmailProvider } from "../../src/providers/messaging/resend-email.adapter.js";
import { TermiiSmsProvider } from "../../src/providers/messaging/termii-sms.adapter.js";
import {
  readProviderBytes,
  withProviderResponse,
} from "../../src/providers/provider-http.js";

const original = { ...env };
const names = ["paystack", "monnify", "email", "sms"] as const;
type Name = (typeof names)[number];
function send(name: Name) {
  if (name === "paystack") return new PaystackAdapter().verify("synthetic");
  if (name === "monnify")
    return new MonnifyAdapter({
      mode: "sandbox",
      apiKey: "synthetic-key",
      secretKey: "synthetic-secret",
      contractCode: "synthetic-contract",
      callbackUrl: "https://example.test/complete",
      requestTimeoutMs: 100,
      maxResponseBytes: 64,
    }).verify("synthetic");
  if (name === "email")
    return new ResendEmailProvider("synthetic-key", "test@example.test").send({
      to: "test@example.test",
      subject: "Synthetic",
      text: "Synthetic",
      html: "<p>Synthetic</p>",
      idempotencyKey: "synthetic-message",
    });
  return new TermiiSmsProvider().send({
    to: "+2348000000000",
    text: "Synthetic",
    idempotencyKey: "synthetic-message",
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn());
  Object.assign(env, {
    PAYSTACK_MODE: "test",
    PAYSTACK_SECRET_KEY: "sk_test_synthetic_transport",
    PAYSTACK_REQUEST_TIMEOUT_MS: 100,
    PAYSTACK_MAX_RESPONSE_BYTES: 64,
    MESSAGING_REQUEST_TIMEOUT_MS: 100,
    TERMII_API_KEY: "synthetic-key",
    TERMII_SENDER_ID: "Synthetic",
    TERMII_BASE_URL: "https://example.test",
  });
});
afterEach(() => {
  Object.assign(env, original);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("provider transport bounds", () => {
  it("discards late headers without running provider parsing after the deadline", async () => {
    let resolve!: (value: Response) => void;
    const consume = vi.fn();
    const cancel = vi.fn();
    const task = withProviderResponse(
      "https://example.test",
      {},
      100,
      consume,
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    const rejected = expect(task).rejects.toThrow("Provider request timed out");
    await vi.advanceTimersByTimeAsync(101);
    await rejected;
    resolve(new Response(new ReadableStream({ cancel })));
    await vi.advanceTimersByTimeAsync(0);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(consume).not.toHaveBeenCalled();
  });
  it("releases a stalled body even when its cancellation never settles", async () => {
    let release!: () => void;
    const cancel = vi.fn(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    const task = withProviderResponse(
      "https://example.test",
      {},
      100,
      (response, signal) => readProviderBytes(response, 64, signal),
      async () => new Response(new ReadableStream({ cancel })),
    );
    const rejected = expect(task).rejects.toThrow("Provider request timed out");
    await vi.advanceTimersByTimeAsync(101);
    await rejected;
    expect(cancel).toHaveBeenCalledTimes(1);
    release();
  });
  it("bounds overflow without waiting for cancellation and clears the deadline", async () => {
    let release!: () => void;
    const cancel = vi.fn(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    const task = withProviderResponse(
      "https://example.test",
      {},
      100,
      (response, signal) => readProviderBytes(response, 64, signal),
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(65));
            },
            cancel,
          }),
        ),
    );
    await expect(task).rejects.toThrow("Provider response too large");
    expect(vi.getTimerCount()).toBe(0);
    expect(cancel).toHaveBeenCalledTimes(1);
    release();
  });
  it.each(names)("%s releases the caller when fetch ignores abort", async (name) => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    let result: unknown;
    const operation = send(name).catch((error) => {
      result = error;
    });
    await vi.advanceTimersByTimeAsync(101);
    try {
      expect(result).toMatchObject({ statusCode: 503, retryable: true });
    } finally {
      resolve(new Response("{}"));
      await operation;
    }
  });
  it.each(["paystack", "monnify"] as const)(
    "%s rejects chunked overflow before the body ends",
    async (name) => {
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const cancel = vi.fn();
      const response = new Response(
        new ReadableStream<Uint8Array>({
          start(value) {
            controller = value;
            value.enqueue(new Uint8Array(65));
          },
          cancel,
        }),
      );
      vi.mocked(fetch).mockResolvedValue(response);
      let result: unknown;
      const operation = send(name).catch((error) => {
        result = error;
      });
      await vi.advanceTimersByTimeAsync(0);
      try {
        expect(result).toMatchObject({ statusCode: 503, retryable: true });
        expect(cancel).toHaveBeenCalled();
      } finally {
        try {
          controller.close();
        } catch {
          /* already cancelled */
        }
        await operation;
      }
    },
  );
  it.each(["email", "sms"] as const)(
    "%s does not await a broken body cancellation after acceptance",
    async (name) => {
      let release!: () => void;
      const cancel = vi.fn(
        () =>
          new Promise<void>((r) => {
            release = r;
          }),
      );
      vi.mocked(fetch).mockResolvedValue(new Response(new ReadableStream({ cancel })));
      let settled = false;
      const operation = send(name).then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      try {
        expect(settled).toBe(true);
        expect(cancel).toHaveBeenCalled();
      } finally {
        release();
        await operation;
      }
    },
  );
});
