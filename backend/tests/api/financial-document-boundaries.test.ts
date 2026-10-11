import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("private financial document routes", () => {
  const app = createApp({ checkReadiness: async () => undefined });
  const id = "f7000000-0000-4000-8000-000000000001";
  it.each([
    `/customers/invoices/${id}/document`,
    `/customers/invoices/${id}/download`,
    `/customers/payments/${id}/receipt/document`,
    `/customers/payments/${id}/receipt`,
  ])("requires authentication before exposing %s", async (path) => {
    const response = await request(app).get(`/api/v1${path}`);
    expect(response.status).toBe(401);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["content-disposition"]).toBeUndefined();
  });
});
