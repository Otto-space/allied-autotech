import pino from "pino";
import { Router } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { logger } from "../../src/common/observability/logger.js";
import { safeErrorAttributes } from "../../src/common/observability/safe-error.js";
import { providerUnavailable } from "../../src/common/errors/provider-error-mapper.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { env } from "../../src/config/env.js";
import { PaystackAdapter } from "../../src/providers/payments/paystack.adapter.js";

const marker = "PRIVATE_SYNTHETIC_VALUE",
  lines: string[] = [];
const level = logger.level;
const providerConfig = { mode: env.PAYSTACK_MODE, key: env.PAYSTACK_SECRET_KEY };
const destination = (
  logger as unknown as Record<symbol, { write: (chunk: string) => boolean }>
)[pino.symbols.streamSym]!;
beforeEach(() => {
  lines.length = 0;
  logger.level = "info";
  vi.spyOn(destination, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  env.PAYSTACK_MODE = providerConfig.mode;
  env.PAYSTACK_SECRET_KEY = providerConfig.key;
  logger.level = level;
});
const records = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
function appWith(error: unknown) {
  const router = Router();
  router.get("/failure", () => {
    throw error;
  });
  return createApp({ apiRouter: router });
}
describe("emitted application log privacy", () => {
  it.each(["structured", "bare", "implicit", "child", "undefined-message"])(
    "%s errors cannot expose messages, causes or attached request data",
    (kind) => {
      const error = providerUnavailable(
        Object.assign(new Error(marker), {
          request: { password: marker },
          response: { body: marker },
        }),
      );
      if (kind === "structured")
        logger.error({ err: error }, "Synthetic provider failure");
      else if (kind === "bare") logger.error(error);
      else if (kind === "implicit") logger.error({ err: error });
      else if (kind === "undefined-message") logger.error({ err: error }, undefined);
      else
        logger
          .child({ worker: "synthetic" })
          .error({ err: error }, "Synthetic worker failure");
      expect(lines).toHaveLength(1);
      expect(lines.join("")).not.toContain(marker);
      expect(records()[0]?.err).toMatchObject({
        errorName: "AppError",
        errorCode: "PROVIDER_UNAVAILABLE",
        retryable: true,
      });
    },
  );
  it("keeps raw database invocation text and metadata out of HTTP logs", async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      `Invalid query containing ${marker}`,
      { code: "P2021", clientVersion: "synthetic", meta: { table: marker } },
    );
    const response = await request(appWith(error)).get("/api/v1/failure");
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(marker);
    expect(lines.join("")).not.toContain(marker);
    const entry = records().find((row) => row.msg === "Request rejected");
    expect(entry?.err).toMatchObject({
      errorName: "PrismaClientKnownRequestError",
      errorCode: "P2021",
    });
    expect(JSON.stringify(entry)).toContain("npm run db:migrate");
  });
  it("does not log malformed JSON request bodies or parser snippets", async () => {
    const router = Router();
    router.post("/submit", (_req, res) => res.sendStatus(204));
    const response = await request(createApp({ apiRouter: router }))
      .post("/api/v1/submit")
      .set("Content-Type", "application/json")
      .send(`{"password":"${marker}",`);
    expect(response.status).toBe(400);
    expect(lines.join("")).not.toContain(marker);
    expect(records().some((row) => row.errorCode === "MALFORMED_JSON")).toBe(true);
  });
  it("drops custom exception fields instead of serializing arbitrary objects", async () => {
    const response = await request(
      appWith({
        name: "Error",
        message: marker,
        request: { headers: { authorization: marker } },
        body: marker,
      }),
    ).get("/api/v1/failure");
    expect(response.status).toBe(500);
    expect(lines.join("")).not.toContain(marker);
    expect(records().find((row) => row.msg === "Request rejected")?.err).toEqual({
      errorName: "Error",
    });
  });
  it("uses a matched route template without URL parameters, queries or headers", async () => {
    const router = Router();
    router.get("/resource/:id", (_req, res) => res.sendStatus(204));
    await request(createApp({ apiRouter: router }))
      .get(`/api/v1/resource/${marker}?token=${marker}`)
      .set("Authorization", marker)
      .set("Cookie", `session=${marker}`);
    expect(lines.join("")).not.toContain(marker);
    expect(records().at(-1)).toMatchObject({
      route: "/resource/:id",
      req: { method: "GET" },
      res: { statusCode: 204 },
    });
  });
  it("does not record arbitrary unmatched URL paths", async () => {
    await request(createApp({ apiRouter: Router() })).get(`/api/v1/${marker}`);
    expect(lines.join("")).not.toContain(marker);
    expect(records().at(-1)).toMatchObject({
      route: "UNRESOLVED",
      res: { statusCode: 404 },
    });
  });
  it("sanitizes errors attached directly to the HTTP response", async () => {
    const router = Router();
    router.get("/failure", (_req, res) => {
      res.err = new Error(marker);
      res.sendStatus(503);
    });
    await request(createApp({ apiRouter: router })).get("/api/v1/failure");
    expect(lines.join("")).not.toContain(marker);
    expect(records().at(-1)?.err).toEqual({ errorName: "Error" });
  });
  it("does not trust secret-shaped values merely because they match a token regex", () => {
    expect(safeErrorAttributes({ name: marker, code: marker })).toEqual({
      errorName: "Error",
    });
  });
  it("sanitizes a real provider JSON parsing failure through the HTTP error boundary", async () => {
    env.PAYSTACK_MODE = "test";
    env.PAYSTACK_SECRET_KEY = "sk_test_synthetic_logging";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(`${marker} invalid provider JSON`)),
    );
    const router = Router();
    router.get("/provider", async () => {
      await new PaystackAdapter().verify("synthetic-reference");
    });
    const response = await request(createApp({ apiRouter: router })).get(
      "/api/v1/provider",
    );
    expect(response.status).toBe(503);
    expect(lines.join("")).not.toContain(marker);
    expect(
      records().find((row) => row.errorCode === "PROVIDER_UNAVAILABLE"),
    ).toMatchObject({
      err: { errorName: "AppError", errorCode: "PROVIDER_UNAVAILABLE", retryable: true },
    });
  });
  it("retains allowlisted worker diagnostics and omits cyclic aggregate details", () => {
    const error = new AggregateError([new Error(marker)], marker);
    error.cause = error;
    logger.warn(
      { err: error, eventId: "synthetic-event", attempt: 2 },
      "Synthetic worker failure",
    );
    expect(records()[0]).toMatchObject({
      err: { errorName: "AggregateError" },
      eventId: "synthetic-event",
      attempt: 2,
    });
    expect(lines.join("")).not.toContain(marker);
    const value = safeErrorAttributes(
      Object.assign(new Error(marker), { code: "ECONNREFUSED" }),
    );
    expect(value).toEqual({ errorName: "Error", errorCode: "ECONNREFUSED" });
    expect(safeErrorAttributes(value)).toEqual(value);
  });
  it("does not fail logging when a third-party error has a throwing getter", () => {
    const error = Object.defineProperty({}, "name", {
      get() {
        throw new Error(marker);
      },
    });
    logger.warn({ err: error }, "Synthetic unexpected exception");
    expect(records()[0]?.err).toEqual({ errorName: "UnknownError" });
    expect(lines.join("")).not.toContain(marker);
  });
  it("keeps ordinary configured field redaction in child loggers", () => {
    logger.child({ worker: "synthetic" }).info(
      {
        password: marker,
        email: marker,
        upload: { url: marker, headers: { authorization: marker } },
      },
      "Synthetic redaction check",
    );
    expect(lines.join("")).not.toContain(marker);
    expect(records()[0]).toMatchObject({
      password: "[REDACTED]",
      email: "[REDACTED]",
      upload: { url: "[REDACTED]", headers: "[REDACTED]" },
    });
  });
});
