import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("Phase 6 route boundaries", () => {
  const app = createApp({ checkReadiness: async () => undefined });
  it.each([
    ["post", "/api/v1/customers/orders/checkout"],
    ["get", "/api/v1/customers/orders"],
    ["post", "/api/v1/customers/promotions/preview"],
    ["get", "/api/v1/customers/invoices"],
    ["get", "/api/v1/staff/orders"],
    ["get", "/api/v1/staff/invoices"],
    ["get", "/api/v1/admin/promotions"],
  ] as const)("protects %s %s", async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
  });
  it("strictly rejects unknown staff order filters", async () => {
    const response = await request(app).get("/api/v1/staff/orders?unexpected=true");
    expect(response.status).toBe(401);
  });
});
