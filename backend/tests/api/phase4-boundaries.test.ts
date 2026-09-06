import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { errorCodes } from "../../src/common/errors/error-codes.js";

describe("Phase 4 HTTP trust boundaries", () => {
  it("rejects invalid public filters before database access", async () => {
    const response = await request(
      createApp({ checkReadiness: async () => undefined }),
    ).get("/api/v1/public/catalog/products?sort=unsafe");
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(errorCodes.validationFailed);
  });

  it("fails closed for customer, inventory, and catalogue administration routes", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    for (const path of [
      "/api/v1/customers/cart",
      "/api/v1/staff/inventory",
      "/api/v1/admin/catalog/products",
    ]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe(errorCodes.unauthorized);
    }
  });

  it("publishes the Phase 4 contracts", async () => {
    const response = await request(
      createApp({ checkReadiness: async () => undefined }),
    ).get("/api/v1/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.paths).toHaveProperty("/public/catalog/products");
    expect(response.body.paths).toHaveProperty("/customers/cart/items/{productId}");
    expect(response.body.paths).toHaveProperty(
      "/admin/catalog/products/{productId}/images/{imageId}",
    );
    expect(response.body.paths).toHaveProperty(
      "/staff/inventory/{inventoryId}/reservations",
    );
  });
});
