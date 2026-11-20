import { createHmac } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { paymentsService } from "../../src/modules/payments/payments.service.js";

describe("Phase 8 payment HTTP boundaries", () => {
  const app = createApp({ checkReadiness: async () => undefined });
  it.each([
    ["get", "/api/v1/customers/payments"],
    ["post", "/api/v1/customers/payments"],
    ["get", "/api/v1/staff/payments"],
    ["post", "/api/v1/staff/payments/refunds"],
  ] as const)("protects %s %s", async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });

  it("rejects unsigned Paystack webhooks before processing", async () => {
    const response = await request(app)
      .post("/api/v1/webhooks/paystack")
      .set("content-type", "application/json")
      .send({ event: "charge.success", data: {} });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("accepts a fresh signing-secret header and rejects legacy downgrade", async () => {
    const previous = {
      mode: env.PAYSTACK_MODE,
      apiKey: env.PAYSTACK_SECRET_KEY,
      signingKey: env.PAYSTACK_WEBHOOK_SECRET,
    };
    env.PAYSTACK_MODE = "test";
    env.PAYSTACK_SECRET_KEY = "sk_test_synthetic_http_boundary";
    env.PAYSTACK_WEBHOOK_SECRET = "whsec_synthetic_http_boundary";
    const ingest = vi
      .spyOn(paymentsService, "ingestWebhook")
      .mockResolvedValue({ accepted: true, duplicate: false });
    try {
      const raw = JSON.stringify({ event: "ping", data: {} });
      const freshTimestamp = Math.floor(Date.now() / 1_000);
      const freshSignature = createHmac("sha512", env.PAYSTACK_WEBHOOK_SECRET)
        .update(`${freshTimestamp}.`)
        .update(raw)
        .digest("hex");
      const good = await request(app)
        .post("/api/v1/webhooks/paystack")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", "bad-legacy-header")
        .set(
          "paystack-signature",
          `t=${freshTimestamp},v1=whk_synthetic:${freshSignature}`,
        )
        .send(raw);
      expect(good.status).toBe(200);
      expect(ingest).toHaveBeenCalledOnce();
      expect(ingest.mock.calls[0]?.[0]).toMatchObject({ eventType: "ping" });
      ingest.mockClear();

      const timestamp = Math.floor(Date.now() / 1_000) - 301;
      const newSignature = createHmac("sha512", env.PAYSTACK_WEBHOOK_SECRET)
        .update(`${timestamp}.`)
        .update(raw)
        .digest("hex");
      const legacySignature = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
        .update(raw)
        .digest("hex");
      const withBoth = await request(app)
        .post("/api/v1/webhooks/paystack")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", legacySignature)
        .set("paystack-signature", `t=${timestamp},v1=whk_synthetic:${newSignature}`)
        .send(raw);
      expect(withBoth.status).toBe(401);

      const legacyOnly = await request(app)
        .post("/api/v1/webhooks/paystack")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", legacySignature)
        .send(raw);
      expect(legacyOnly.status).toBe(401);
      expect(ingest).not.toHaveBeenCalled();
    } finally {
      ingest.mockRestore();
      env.PAYSTACK_MODE = previous.mode;
      env.PAYSTACK_SECRET_KEY = previous.apiKey;
      env.PAYSTACK_WEBHOOK_SECRET = previous.signingKey;
    }
  });

  it("fails closed when Monnify is disabled and exposes no provider detail", async () => {
    const response = await request(createApp({ checkReadiness: async () => undefined }))
      .post("/api/v1/webhooks/monnify")
      .set("Content-Type", "application/json")
      .send({ eventType: "UNSUPPORTED_EVENT", eventData: {} });
    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toMatch(
      /MONNIFY_SECRET|SK_TEST|stack|database/iu,
    );
  });

  it("publishes payment routes and their CSRF/idempotency headers", async () => {
    const response = await request(app).get("/api/v1/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.paths["/customers/payments"]).toBeDefined();
    expect(response.body.paths["/webhooks/paystack"]).toBeDefined();
    expect(response.body.paths["/webhooks/monnify"]).toBeDefined();
    expect(response.body.paths["/customers/payments/{paymentId}/monnify"]).toBeDefined();
    const parameters = response.body.paths["/customers/payments"].post.parameters;
    expect(
      parameters.some((item: { name: string }) => item.name === "x-csrf-token"),
    ).toBe(true);
    expect(
      parameters.some((item: { name: string }) => item.name === "idempotency-key"),
    ).toBe(true);
  });
});
