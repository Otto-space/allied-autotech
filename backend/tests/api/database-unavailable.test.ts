import { createServer } from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { PrismaClient } from "../../src/generated/prisma/client.js";

describe("Unavailable PostgreSQL HTTP response", () => {
  it.each(["model", "raw"] as const)(
    "returns a safe 503 for a real refused %s query",
    async (kind) => {
      // Reserve an ephemeral loopback port, then close it. No running database is
      // stopped or reconfigured and no application credentials are used.
      const socket = createServer();
      await new Promise<void>((resolve, reject) => {
        socket.once("error", reject);
        socket.listen(0, "127.0.0.1", resolve);
      });
      const address = socket.address();
      if (address === null || typeof address === "string")
        throw new Error("Missing test port");
      await new Promise<void>((resolve, reject) =>
        socket.close((error) => (error ? reject(error) : resolve())),
      );
      const db = new PrismaClient({
        adapter: new PrismaPg({
          host: "127.0.0.1",
          port: address.port,
          database: "unreachable_test",
          user: "synthetic_test",
          password: "synthetic_test_only",
          connectionTimeoutMillis: 1000,
          max: 1,
        }),
      });
      const router = Router();
      let databaseFailure: unknown;
      router.get("/database-probe", async (_req, res) => {
        try {
          if (kind === "model")
            await db.session.findUnique({ where: { tokenHash: "synthetic" } });
          else await db.$queryRaw`SELECT 1`;
        } catch (error) {
          databaseFailure = error;
          throw error;
        }
        res.sendStatus(204);
      });
      try {
        const response = await request(createApp({ apiRouter: router })).get(
          "/api/v1/database-probe",
        );
        expect(response.status, JSON.stringify(databaseFailure)).toBe(503);
        expect(response.body).toEqual({
          success: false,
          message: "Service temporarily unavailable",
          error: { code: "DATABASE_UNAVAILABLE" },
          meta: { requestId: expect.any(String) },
        });
        expect(response.headers["cache-control"]).toContain("no-store");
      } finally {
        await db.$disconnect();
      }
    },
  );
});
