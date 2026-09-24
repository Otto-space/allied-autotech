import type { Store, Options } from "express-rate-limit";
import { prisma } from "../../config/database.js";
import { hashToken } from "../security/session-tokens.js";

/** Atomic shared fixed windows; stores keyed HMACs rather than raw client addresses. */
export class PostgresRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60_000;
  constructor(
    private readonly scope: string,
    private readonly database = prisma,
  ) {}
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  async increment(rawKey: string) {
    const key = hashToken("rate-limit", `${this.scope}:${rawKey}`);
    const rows = await this.database.$queryRaw<Array<{ hits: number; resetAt: Date }>>`
      INSERT INTO "RateLimitBucket" ("key", "hits", "resetAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP + (${this.windowMs} * INTERVAL '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN 1 ELSE "RateLimitBucket"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
      RETURNING "hits", "resetAt"
    `;
    if (!rows[0]) throw new Error("Shared rate limiter unavailable");
    return { totalHits: rows[0].hits, resetTime: rows[0].resetAt };
  }
  async decrement(rawKey: string) {
    const key = hashToken("rate-limit", `${this.scope}:${rawKey}`);
    await this.database
      .$executeRaw`UPDATE "RateLimitBucket" SET "hits" = GREATEST(0, "hits" - 1) WHERE "key" = ${key}`;
  }
  async resetKey(rawKey: string) {
    const key = hashToken("rate-limit", `${this.scope}:${rawKey}`);
    await this.database.rateLimitBucket.deleteMany({ where: { key } });
  }
}
