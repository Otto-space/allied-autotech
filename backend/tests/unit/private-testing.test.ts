import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { privateTesting } from "../../src/common/middleware/private-testing.js";

const password = "a".repeat(64);
const authorization = `Basic ${Buffer.from(`allied-test:${password}`).toString("base64")}`;
function fixture(enabled = true) {
  const app = express();
  app.use(privateTesting(enabled, password));
  app.use((_req, res) => res.status(204).end());
  return app;
}

describe("private staging perimeter (no database)", () => {
  it.each([
    "/api/v1/public/services",
    "/api/v1/auth/register",
    "/api/v1/admin/customers",
    "/api/v1/health/live/extra",
    "/api/v1/webhooks/paystack/extra",
  ])("denies unauthenticated %s", async (path) => {
    const response = await request(fixture()).get(path);
    expect(response.status).toBe(401);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["www-authenticate"]).toContain("Basic realm=");
    expect(JSON.stringify(response.body)).not.toContain(password);
  });
  it.each([
    "Bearer wrong",
    "Basic !!!",
    `${authorization}extra`,
    `Basic ${Buffer.from(`other:${password}`).toString("base64")}`,
  ])("rejects malformed or incorrect credentials", async (header) => {
    expect(
      (
        await request(fixture())
          .get("/api/v1/public/services")
          .set("Authorization", header)
      ).status,
    ).toBe(401);
  });
  it("passes authorized traffic to the existing session/permission layer", async () => {
    expect(
      (
        await request(fixture())
          .get("/api/v1/admin/customers")
          .set("Authorization", authorization)
      ).status,
    ).toBe(204);
  });
  it("allows only exact health reads and provider callback POSTs through the perimeter", async () => {
    const app = fixture();
    expect((await request(app).get("/api/v1/health/ready")).status).toBe(204);
    expect((await request(app).head("/api/v1/health/live")).status).toBe(204);
    expect((await request(app).post("/api/v1/health/live")).status).toBe(401);
    expect((await request(app).get("/api/v1/webhooks/paystack")).status).toBe(401);
    expect((await request(app).post("/api/v1/webhooks/paystack")).status).toBe(204);
    expect((await request(app).post("/api/v1/webhooks/monnify")).status).toBe(204);
  });
  it("leaves normal public routing available when explicitly disabled", async () => {
    expect((await request(fixture(false)).get("/api/v1/public/services")).status).toBe(
      204,
    );
  });
  it("refuses to start with missing or weak private-access configuration", () => {
    expect(() => privateTesting(true)).toThrow();
    expect(() => privateTesting(true, "short")).toThrow();
  });
});
