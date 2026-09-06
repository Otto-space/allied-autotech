import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("Phase 7 vehicle and API-documentation boundaries", () => {
  const app = createApp({ checkReadiness: async () => undefined });

  it.each([
    ["get", "/api/v1/customers/saved-vehicles"],
    ["post", "/api/v1/customers/vehicle-inspections"],
    ["get", "/api/v1/customers/vehicle-transactions"],
    ["get", "/api/v1/staff/vehicles"],
    ["get", "/api/v1/staff/vehicle-inspections"],
    ["post", "/api/v1/admin/vehicle-transactions/expire"],
  ] as const)("protects %s %s", async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
  });

  it("strictly validates public vehicle filters", async () => {
    const response = await request(app).get("/api/v1/public/vehicles?unexpected=true");
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("serves a no-store OpenAPI 3.1 contract containing Phase 7 routes", async () => {
    const response = await request(app).get("/api/v1/openapi.json");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.components.securitySchemes.sessionCookie).toBeDefined();
    expect(response.body.paths["/public/vehicles"]).toBeDefined();
    expect(
      response.body.paths[
        "/staff/vehicle-transactions/{transactionId}/handovers/{handoverId}/access"
      ],
    ).toBeDefined();
  });

  it("serves Swagger UI with route-scoped hardening", async () => {
    const response = await request(app).get("/api/v1/docs/");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.text).toContain("Allied AutoTech API Documentation");
  });
});
