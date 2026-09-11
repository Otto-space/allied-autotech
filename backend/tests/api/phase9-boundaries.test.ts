import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

const app = createApp({ checkReadiness: async () => undefined });

describe("Phase 9 route boundaries", () => {
  it("marks every API response as non-cacheable at the application boundary", async () => {
    const response = await request(app).get("/api/v1/health/live");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.pragma).toBe("no-cache");
  });

  it.each([
    "/api/v1/customers/notifications",
    "/api/v1/customers/support/enquiries",
    "/api/v1/staff/support/complaints",
    "/api/v1/admin/audit",
    "/api/v1/admin/operations/jobs",
  ])("rejects unauthenticated access to %s", async (path) => {
    const response = await request(app).get(path);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects unsupported fields before public support persistence", async () => {
    const response = await request(app)
      .post("/api/v1/public/support/complaints")
      .set("Origin", "http://localhost:3000")
      .send({
        subject: "Synthetic complaint",
        description: "No real customer data",
        name: "Synthetic User",
        email: "synthetic@example.test",
        isAdministrator: true,
      });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });
});
