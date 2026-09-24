import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PostgresRateLimitStore } from "../../src/common/middleware/postgres-rate-limit-store.js";
import { prisma } from "../../src/config/database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Shared PostgreSQL rate limiter",
  () => {
    afterAll(() => prisma.$disconnect());
    it("shares one atomic bucket across separate API store instances", async () => {
      const a = new PostgresRateLimitStore("isolated-shared-test");
      const b = new PostgresRateLimitStore("isolated-shared-test");
      a.init({ windowMs: 60000 } as never);
      b.init({ windowMs: 60000 } as never);
      const key = randomUUID();
      const results = await Promise.all([
        a.increment(key),
        b.increment(key),
        a.increment(key),
      ]);
      expect(results.map((result) => result.totalHits).sort()).toEqual([1, 2, 3]);
      expect(new Set(results.map((result) => result.resetTime.getTime())).size).toBe(1);
      await b.resetKey(key);
      expect((await a.increment(key)).totalHits).toBe(1);
    });
  },
);
