import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

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
