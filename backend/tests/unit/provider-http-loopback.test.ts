import { createServer, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { env } from "../../src/config/env.js";
import { PaystackAdapter } from "../../src/providers/payments/paystack.adapter.js";
import { MonnifyAdapter } from "../../src/providers/payments/monnify.adapter.js";
import { ResendEmailProvider } from "../../src/providers/messaging/resend-email.adapter.js";
import { TermiiSmsProvider } from "../../src/providers/messaging/termii-sms.adapter.js";
import {
  readProviderBytes,
  withProviderResponse,
} from "../../src/providers/provider-http.js";

const nativeFetch = fetch,
  original = { ...env };
let server: Server,
  base: string,
  mode = "valid",
  closed = 0,
  requests = 0;
const fetched: string[] = [];
beforeAll(async () => {
  server = createServer((_req, res) => {
    requests++;
    res.on("close", () => closed++);
    if (mode === "no-headers") return;
    if (mode === "redirect") {
      res.writeHead(302, { location: `${base}/redirect-target` });
      res.end();
      return;
    }
    if (mode === "declared") {
      res.writeHead(200, { "content-length": 10000 });
      res.write("{");
      return;
    }
    if (mode === "chunked") {
      res.writeHead(200);
      res.write(Buffer.alloc(4097));
      return;
    }
    if (mode === "compressed") {
      const bytes = gzipSync(Buffer.alloc(4097));
      res.writeHead(200, { "content-encoding": "gzip", "content-length": bytes.length });
      res.end(bytes);
      return;
    }
    if (mode === "body-stall") {
      res.writeHead(200);
      res.write("{");
      return;
    }
    if (mode === "utf8") {
      res.end("é".repeat(2049));
      return;
    }
    if (mode.startsWith("status-")) {
      res.writeHead(Number(mode.slice(7)));
      res.write("ignored-private-provider-message");
      return;
    }
    const body = JSON.stringify({
      status: true,
      message: "Synthetic",
      data: {
        id: "9007199254740993",
        status: "success",
        reference: "synthetic",
        domain: "test",
        amount: 10000,
        currency: "NGN",
      },
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Expected test listener");
  base = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => {
  fetched.length = 0;
  mode = "valid";
  Object.assign(env, {
    PAYSTACK_MODE: "test",
    PAYSTACK_SECRET_KEY: "sk_test_synthetic_transport",
    PAYSTACK_REQUEST_TIMEOUT_MS: 500,
    PAYSTACK_MAX_RESPONSE_BYTES: 4096,
    MESSAGING_REQUEST_TIMEOUT_MS: 500,
    TERMII_API_KEY: "synthetic-key",
    TERMII_SENDER_ID: "Synthetic",
    TERMII_BASE_URL: "https://example.test",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      fetched.push(String(input));
      return nativeFetch(`${base}/${mode}`, init);
    }),
  );
});
afterEach(() => {
  Object.assign(env, original);
  vi.unstubAllGlobals();
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
function send(name: string) {
  if (name === "paystack") return new PaystackAdapter().verify("synthetic");
  if (name === "monnify")
    return new MonnifyAdapter({
      mode: "sandbox",
      apiKey: "synthetic-key",
      secretKey: "synthetic-secret",
      contractCode: "synthetic-contract",
      callbackUrl: "https://example.test/complete",
      requestTimeoutMs: 500,
      maxResponseBytes: 4096,
    }).verify("synthetic");
  if (name === "email")
    return new ResendEmailProvider("synthetic-key", "test@example.test").send({
      to: "test@example.test",
      subject: "Synthetic",
      text: "Synthetic",
      html: "<p>Synthetic</p>",
      idempotencyKey: "synthetic",
    });
  return new TermiiSmsProvider().send({
    to: "+2348000000000",
    text: "Synthetic",
    idempotencyKey: "synthetic",
  });
}
describe("real provider HTTP streams", () => {
  it("retains normal Paystack values and exact large identifiers", async () => {
    expect(await send("paystack")).toMatchObject({
      gatewayTransactionId: "9007199254740993",
      amountKobo: 10000n,
      status: "success",
    });
    expect(fetched).toEqual(["https://api.paystack.co/transaction/verify/synthetic"]);
  });
  for (const provider of ["paystack", "monnify"])
    it.each(["declared", "chunked", "compressed", "utf8"])(
      `${provider} bounds %s bytes without waiting for EOF`,
      async (value) => {
        mode = value;
        const before = closed;
        await expect(send(provider)).rejects.toMatchObject({
          statusCode: 503,
          retryable: true,
          cause: { message: "Provider response too large" },
        });
        await vi.waitFor(() => expect(closed).toBeGreaterThan(before));
      },
    );
  for (const provider of ["paystack", "monnify", "email", "sms"])
    it(`${provider} aborts a real connection with no response headers`, async () => {
      mode = "no-headers";
      const before = closed;
      await expect(send(provider)).rejects.toMatchObject({
        statusCode: 503,
        retryable: true,
      });
      await vi.waitFor(() => expect(closed).toBeGreaterThan(before));
    });
  it.each(["paystack", "monnify"])(
    "%s aborts a body that stalls after headers",
    async (provider) => {
      mode = "body-stall";
      const before = closed;
      await expect(send(provider)).rejects.toMatchObject({
        statusCode: 503,
        retryable: true,
      });
      await vi.waitFor(() => expect(closed).toBeGreaterThan(before));
    },
  );
  for (const provider of ["email", "sms"])
    it.each([200, 400, 429, 503])(
      `${provider} preserves HTTP %i classification and discards unused bodies`,
      async (status) => {
        mode = `status-${status}`;
        const before = closed;
        if (status === 200) await expect(send(provider)).resolves.toBeUndefined();
        else
          await expect(send(provider)).rejects.toMatchObject({
            statusCode: 503,
            retryable: status !== 400,
          });
        await vi.waitFor(() => expect(closed).toBeGreaterThan(before));
      },
    );
  it("refuses redirects without following a second request", async () => {
    mode = "redirect";
    const before = requests;
    await expect(send("paystack")).rejects.toMatchObject({
      statusCode: 503,
      retryable: true,
    });
    expect(requests - before).toBe(1);
  });
  it("allows exactly the configured number of decoded bytes", async () => {
    const bytes = Buffer.from("éé");
    const result = await withProviderResponse(
      "https://example.test",
      {},
      500,
      (response, signal) => readProviderBytes(response, bytes.length, signal),
      async () => new Response(bytes),
    );
    expect(result).toEqual(bytes);
  });
});
