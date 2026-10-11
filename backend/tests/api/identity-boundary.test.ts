import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { errorCodes } from "../../src/common/errors/error-codes.js";

const trustedOrigin = "http://localhost:3000";

describe("identity HTTP trust boundaries", () => {
  it("rejects invalid recovery email and additional fields before persistence", async () => {
    const response = await request(createApp({ checkReadiness: async () => undefined }))
      .post("/api/v1/auth/password/forgot")
      .set("Origin", trustedOrigin)
      .send({ email: "invalid", role: "ADMIN" });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(errorCodes.validationFailed);
  });
  it("rejects cross-origin registration before persistence", async () => {
    const response = await request(createApp({ checkReadiness: async () => undefined }))
      .post("/api/v1/auth/register")
      .set("Origin", "https://untrusted.example")
      .set("Sec-Fetch-Site", "cross-site")
      .send({
        email: "register@example.test",
        password: "unique registration phrase",
        firstName: "Test",
        lastName: "Person",
        phone: "+2348000000000",
      });
    expect(response.status).toBe(403);
    // CORS rejects the disallowed origin before the identity middleware runs.
    expect(response.body.error.code).toBe(errorCodes.forbidden);
  });
  it("requires an exact trusted origin for public identity mutations", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "person@example.com",
      password: "a sufficiently long password",
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(errorCodes.csrfInvalid);
  });

  it("rejects mass assignment and weak passwords before persistence", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", trustedOrigin)
      .send({
        email: "person@example.com",
        password: "password1234",
        firstName: "Test",
        lastName: "Person",
        phone: "+234 800 000 0000",
        role: "SUPER_ADMIN",
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(errorCodes.validationFailed);
    expect(JSON.stringify(response.body)).not.toContain("password1234");
  });

  it("fails closed when a protected session cookie is absent", async () => {
    const response = await request(
      createApp({ checkReadiness: async () => undefined }),
    ).get("/api/v1/auth/session");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(errorCodes.unauthorized);
    expect(response.body.meta.requestId).toEqual(expect.any(String));
  });

  it("publishes the complete Phase 2 identity route surface in OpenAPI", async () => {
    const response = await request(
      createApp({ checkReadiness: async () => undefined }),
    ).get("/api/v1/openapi.json");

    expect(response.status).toBe(200);
    expect(response.body.paths).toHaveProperty("/auth/register");
    expect(response.body.paths).toHaveProperty("/auth/password/reset");
    expect(response.body.paths).toHaveProperty("/auth/mfa/webauthn/verify");
    expect(response.body.paths).toHaveProperty("/auth/mfa/challenge/verify");
    expect(response.body.components.securitySchemes).toHaveProperty("sessionCookie");
  });
});
