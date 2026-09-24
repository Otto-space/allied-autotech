import { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createApp } from "../../src/app.js";
import { AppError } from "../../src/common/errors/app-error.js";
import { errorCodes } from "../../src/common/errors/error-codes.js";
import { validate } from "../../src/common/middleware/validate.js";

const trustedOrigin = "https://app.example.com";

describe("secure application foundation", () => {
  it("keeps the legacy health endpoint database-backed", async () => {
    const response = await request(
      createApp({
        allowedOrigins: [trustedOrigin],
        checkReadiness: async () => undefined,
      }),
    ).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Allied AutoTech API is healthy",
      meta: { requestId: expect.any(String) },
    });
  });

  it("reports liveness without invoking the database", async () => {
    let readinessCalls = 0;
    const app = createApp({
      allowedOrigins: [trustedOrigin],
      checkReadiness: async () => {
        readinessCalls += 1;
        throw new Error("Database unavailable");
      },
    });

    const response = await request(app).get("/api/v1/health/live");

    expect(response.status).toBe(200);
    expect(readinessCalls).toBe(0);
  });

  it("fails readiness safely when PostgreSQL is unavailable", async () => {
    const response = await request(
      createApp({
        allowedOrigins: [trustedOrigin],
        checkReadiness: async () => {
          throw new Error("sensitive database detail");
        },
      }),
    ).get("/api/v1/health/ready");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      message: "Service temporarily unavailable",
      error: { code: errorCodes.databaseUnavailable },
    });
    expect(JSON.stringify(response.body)).not.toContain("sensitive database detail");
  });

  it("rejects untrusted browser origins and allows exact trusted origins", async () => {
    const app = createApp({
      allowedOrigins: [trustedOrigin],
      checkReadiness: async () => undefined,
    });
    const rejected = await request(app)
      .get("/api/v1/health/live")
      .set("Origin", "https://evil.example");
    const accepted = await request(app)
      .get("/api/v1/health/live")
      .set("Origin", trustedOrigin);

    expect(rejected.status).toBe(403);
    expect(rejected.body.error.code).toBe(errorCodes.forbidden);
    expect(accepted.status).toBe(200);
    expect(accepted.headers["access-control-allow-origin"]).toBe(trustedOrigin);
  });

  it("returns stable errors for malformed JSON and unknown routes", async () => {
    const router = Router();
    router.post("/echo", (_req, res) => res.status(204).end());
    const app = createApp({ allowedOrigins: [trustedOrigin], apiRouter: router });

    const malformed = await request(app)
      .post("/api/v1/echo")
      .set("Content-Type", "application/json")
      .send('{"broken":');
    const missing = await request(app).get("/api/v1/missing");

    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe(errorCodes.malformedJson);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe(errorCodes.notFound);
  });

  it("rejects oversized JSON with a stable non-sensitive error", async () => {
    const router = Router();
    router.post("/echo", (_req, res) => res.status(204).end());
    const response = await request(
      createApp({
        allowedOrigins: [trustedOrigin],
        apiRouter: router,
        requestBodyLimit: "16b",
      }),
    )
      .post("/api/v1/echo")
      .send({ value: "this request is intentionally too large" });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe(errorCodes.payloadTooLarge);
  });

  it("preserves Paystack webhook bytes before JSON parsing", async () => {
    const router = Router();
    router.post("/webhooks/paystack", (req, res) => {
      res.status(200).json({ isBuffer: Buffer.isBuffer(req.body) });
    });
    const response = await request(
      createApp({ allowedOrigins: [trustedOrigin], apiRouter: router }),
    )
      .post("/api/v1/webhooks/paystack")
      .set("Content-Type", "application/json")
      .send('{"event":"test"}');

    expect(response.status).toBe(200);
    expect(response.body.isBuffer).toBe(true);
  });

  it("normalizes validation failures without echoing rejected values", async () => {
    const router = Router();
    router.post(
      "/validated",
      validate({ body: z.object({ name: z.string().trim().min(2).max(30) }).strict() }),
      (_req, res) => res.status(204).end(),
    );
    const response = await request(
      createApp({ allowedOrigins: [trustedOrigin], apiRouter: router }),
    )
      .post("/api/v1/validated")
      .send({ name: "x", password: "must-not-be-reflected" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(errorCodes.validationFailed);
    expect(JSON.stringify(response.body)).not.toContain("must-not-be-reflected");
  });

  it("hides unexpected internal errors", async () => {
    const router = Router();
    router.get("/failure", () => {
      throw new Error("database password leaked");
    });
    const response = await request(
      createApp({ allowedOrigins: [trustedOrigin], apiRouter: router }),
    ).get("/api/v1/failure");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe(errorCodes.internalError);
    expect(JSON.stringify(response.body)).not.toContain("database password leaked");
  });

  it("preserves safe request IDs and replaces invalid values", async () => {
    const app = createApp({
      allowedOrigins: [trustedOrigin],
      checkReadiness: async () => undefined,
    });
    const accepted = await request(app)
      .get("/api/v1/health/live")
      .set("X-Request-ID", "safe_request-123");
    const replaced = await request(app)
      .get("/api/v1/health/live")
      .set("X-Request-ID", "bad id");

    expect(accepted.headers["x-request-id"]).toBe("safe_request-123");
    expect(replaced.headers["x-request-id"]).not.toBe("bad id");
  });

  it("sets baseline security headers and suppresses Express fingerprinting", async () => {
    const response = await request(
      createApp({
        allowedOrigins: [trustedOrigin],
        checkReadiness: async () => undefined,
      }),
    ).get("/api/v1/health/live");

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("returns an OpenAPI 3.1 foundation document", async () => {
    const response = await request(
      createApp({
        allowedOrigins: [trustedOrigin],
        checkReadiness: async () => undefined,
      }),
    ).get("/api/v1/openapi.json");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.info.title).toBe("Allied AutoTech API");
  });

  it("returns the standard rate-limit envelope", async () => {
    const app = createApp({
      allowedOrigins: [trustedOrigin],
      checkReadiness: async () => undefined,
      rateLimit: 1,
      rateWindowMs: 60_000,
    });

    expect((await request(app).get("/api/v1/openapi.json")).status).toBe(200);
    const response = await request(app).get("/api/v1/openapi.json");

    expect((await request(app).get("/api/v1/health/live")).status).toBe(200);
    expect(response.headers["retry-after"]).toBeDefined();
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe(errorCodes.rateLimited);
  });

  it("maps trusted application errors without exposing causes", async () => {
    const router = Router();
    router.get("/conflict", () => {
      throw new AppError({
        code: errorCodes.conflict,
        message: "Resource conflict",
        statusCode: 409,
        cause: new Error("internal cause"),
      });
    });
    const response = await request(
      createApp({ allowedOrigins: [trustedOrigin], apiRouter: router }),
    ).get("/api/v1/conflict");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Resource conflict");
    expect(JSON.stringify(response.body)).not.toContain("internal cause");
  });
});
