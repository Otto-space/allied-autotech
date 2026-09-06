import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { errorCodes } from "../../src/common/errors/error-codes.js";

describe("Phase 5 service-operation HTTP boundaries", () => {
  const app = createApp({ checkReadiness: async () => undefined });

  it("keeps customer, staff, and administrator routes authenticated", async () => {
    for (const path of [
      "/api/v1/customers/bookings",
      "/api/v1/staff/bookings",
      "/api/v1/admin/services",
    ]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe(errorCodes.unauthorized);
    }
  });

  it("strictly validates public query allowlists", async () => {
    const response = await request(app).get("/api/v1/public/services?unexpected=true");
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(errorCodes.validationFailed);
  });
});
