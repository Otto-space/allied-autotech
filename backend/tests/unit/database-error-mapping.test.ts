import { describe, expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client.js";
import { classifyError } from "../../src/common/errors/error-classification.js";
import { toPublicError } from "../../src/common/errors/http-error-mapper.js";

describe("Database outage error mapping", () => {
  it.each([
    "P1000",
    "P1001",
    "P1002",
    "P1017",
    "P2024",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
  ])("maps Prisma %s to the existing safe availability error", (code) => {
    const original = new Prisma.PrismaClientKnownRequestError(
      "private connection details",
      {
        code,
        clientVersion: "7.10.0",
      },
    );
    const error = toPublicError(original);
    expect(error).toMatchObject({
      code: "DATABASE_UNAVAILABLE",
      statusCode: 503,
      message: "Service temporarily unavailable",
      retryable: true,
      cause: original,
    });
    expect(error.details).toBeUndefined();
    expect(classifyError(error)).toMatchObject({ retryable: true, severity: "error" });
  });

  it("maps raw query connection failure metadata without exposing it", () => {
    const error = toPublicError(
      new Prisma.PrismaClientKnownRequestError("private SQL", {
        code: "P2010",
        clientVersion: "7.10.0",
        meta: { code: "ECONNREFUSED", message: "private server" },
      }),
    );
    expect(error).toMatchObject({ code: "DATABASE_UNAVAILABLE", statusCode: 503 });
    expect(error.details).toBeUndefined();
  });

  it.each([
    "DatabaseNotReachable",
    "ConnectionClosed",
    "SocketTimeout",
    "postgres",
    "UniqueConstraintViolation",
  ])("only classifies known connection-related raw driver causes: %s", (kind) => {
    const error = toPublicError(
      new Prisma.PrismaClientKnownRequestError("private SQL", {
        code: "P2010",
        clientVersion: "7.10.0",
        meta: { driverAdapterError: { cause: { kind } } },
      }),
    );
    expect(error.statusCode).toBe(
      ["DatabaseNotReachable", "ConnectionClosed", "SocketTimeout"].includes(kind)
        ? 503
        : 500,
    );
  });

  it.each(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"])(
    "does not label an unrelated %s error as a database outage",
    (code) => {
      const error = Object.assign(new Error("provider details"), {
        code,
        name: "PrismaClientKnownRequestError",
      });
      expect(toPublicError(error)).toMatchObject({
        code: "INTERNAL_ERROR",
        statusCode: 500,
      });
    },
  );

  it.each(["P2002", "P2025", "P2010", "P2028", "UNKNOWN"])(
    "preserves the existing behavior for unrelated Prisma code %s",
    (code) => {
      const error = toPublicError(
        new Prisma.PrismaClientKnownRequestError("private SQL", {
          code,
          clientVersion: "7.10.0",
          meta: { code: "42601" },
        }),
      );
      expect(error.statusCode).toBe(
        code === "P2002" ? 409 : code === "P2025" ? 404 : 500,
      );
    },
  );
});
