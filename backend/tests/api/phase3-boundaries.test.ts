import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { errorCodes } from "../../src/common/errors/error-codes.js";

const trustedOrigin = "http://localhost:3000";

describe("Phase 3 HTTP trust boundaries", () => {
  it("fails closed for customer, staff, and administrator routes", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    for (const path of [
      "/api/v1/customers/profile",
      "/api/v1/staff/profile",
      "/api/v1/admin/branches",
    ]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe(errorCodes.unauthorized);
    }
  });

  it("rejects mass assignment before customer persistence", async () => {
    const response = await request(createApp({ checkReadiness: async () => undefined }))
      .post("/api/v1/customers/vehicles")
      .set("Origin", trustedOrigin)
      .send({
        make: "Toyota",
        model: "Camry",
        year: 2022,
        customerId: "00000000-0000-4000-8000-000000000001",
      });
    expect(response.status).toBe(401);
  });

  it("requires a trusted origin and strong input for invitation acceptance", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const missingOrigin = await request(app)
      .post("/api/v1/auth/staff/invitations/accept")
      .send({});
    expect(missingOrigin.status).toBe(403);
    expect(missingOrigin.body.error.code).toBe(errorCodes.csrfInvalid);

    const massAssignment = await request(app)
      .post("/api/v1/auth/staff/invitations/accept")
      .set("Origin", trustedOrigin)
      .send({
        token: "x".repeat(32),
        password: "password1234",
        firstName: "Test",
        lastName: "Staff",
        role: "SUPER_ADMIN",
      });
    expect(massAssignment.status).toBe(422);
    expect(JSON.stringify(massAssignment.body)).not.toContain("password1234");
  });

  it("publishes the complete Phase 3 route surface in OpenAPI", async () => {
    const response = await request(
      createApp({ checkReadiness: async () => undefined }),
    ).get("/api/v1/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.paths).toHaveProperty("/customers/profile");
    expect(response.body.paths).toHaveProperty("/customers/vehicles/{vehicleId}");
    expect(response.body.paths).toHaveProperty("/public/branches");
    expect(response.body.paths).toHaveProperty("/admin/staff/invitations");
    expect(response.body.paths).toHaveProperty("/auth/staff/invitations/accept");
  });
});
