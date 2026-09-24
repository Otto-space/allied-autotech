import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { IdentityOutboxWorker } from "../../src/workers/outbox.worker.js";
describe("disabled identity delivery", () => {
  it("leaves encrypted messages unclaimed and does not require a provider", async () => {
    const query = vi.fn();
    const database = { $queryRaw: query } as unknown as PrismaClient;
    expect(await new IdentityOutboxWorker(null, database).runOnce()).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});
