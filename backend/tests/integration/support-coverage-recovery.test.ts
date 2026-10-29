import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "owner support coverage recovery",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let owner: { headers: Record<string, string> };
    const key = (time = Date.now()) => `support-reply-v1.${time}.${randomUUID()}`;
    const root = (branch?: string) =>
      `/api/v1/admin/workforce/support-chat/coverage/${branch ?? f.home.id}`;
    async function input(extra: object = {}) {
      const before = await prisma.supportLiveCoverage.findUnique({
        where: { branchId: f.home.id },
      });
      return {
        expectedVersion: before?.version ?? 0,
        enabled: true,
        schedule: {
          timezone: "Africa/Lagos",
          windows: [{ day: 1, startMinute: 540, endMinute: 1020 }],
        },
        maxConcurrentPerAgent: 2,
        reason: "Synthetic reviewed staffing coverage",
        ...extra,
      };
    }
    const put = (body: object, operationKey?: string, branch?: string) => {
      const call = request(app).put(root(branch)).set(owner.headers);
      return (operationKey ? call.set("Idempotency-Key", operationKey) : call).send(body);
    };
    const read = (operationKey: string, branch?: string) =>
      request(app)
        .get(root(branch) + "/operations/" + operationKey)
        .set(owner.headers);
    const cancel = (operationKey: string, branch?: string) =>
      request(app)
        .delete(root(branch) + "/operations/" + operationKey)
        .set(owner.headers);
    const audits = () =>
      prisma.auditLog.count({
        where: { entityType: "BRANCH", entityId: f.home.id, userId: f.owner.id },
      });
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
    }, 60000);
    afterAll(() => prisma.$disconnect());

    it("keeps legacy PUT response compatibility and audited changes", async () => {
      const before = await audits(),
        body = await input();
      const response = await put(body);
      expect(response.status).toBe(200);
      expect(Object.keys(response.body.data).sort()).toEqual([
        "branchId",
        "enabled",
        "maxConcurrentPerAgent",
        "schedule",
        "version",
      ]);
      expect(response.body.data.version).toBe(body.expectedVersion + 1);
      expect(await audits()).toBe(before + 1);
    });
    it("replays the same keyed save once and recovers its reference without a private command", async () => {
      const before = await audits(),
        body = await input(),
        operationKey = key();
      const saved = await put(body, operationKey),
        replayed = await put(body, operationKey);
      expect(saved.status).toBe(200);
      expect(replayed.status).toBe(200);
      expect(replayed.body.data).toEqual(saved.body.data);
      expect(await audits()).toBe(before + 1);
      const recovered = await read(operationKey);
      expect(recovered.status).toBe(200);
      expect(recovered.headers["cache-control"]).toBe("private, no-store");
      expect(recovered.body.data).toEqual({
        state: "SAVED",
        savedVersion: saved.body.data.version,
        coverage: saved.body.data,
      });
      const receipt = await prisma.idempotencyRecord.findFirstOrThrow({
        where: {
          userId: f.owner.id,
          scope: `support-coverage:${f.owner.id}`,
          responseStatus: 200,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(Object.keys(receipt.responseBody as object).sort()).toEqual([
        "resourceId",
        "savedVersion",
      ]);
      expect(JSON.stringify(receipt)).not.toContain(body.reason);
      expect(JSON.stringify(receipt)).not.toContain("startMinute");
    });
    it("rejects changed commands and cross-branch key reuse without more writes", async () => {
      const body = await input(),
        operationKey = key();
      expect((await put(body, operationKey)).status).toBe(200);
      const before = await audits();
      expect(
        (await put({ ...body, reason: "Another private reviewed reason" }, operationKey))
          .status,
      ).toBe(409);
      expect(
        (await put({ ...body, expectedVersion: 0 }, operationKey, f.other.id)).status,
      ).toBe(404);
      expect((await read(operationKey, f.other.id)).status).toBe(404);
      expect((await cancel(operationKey, f.other.id)).status).toBe(404);
      expect(await audits()).toBe(before);
    });
    it("distinguishes an unknown result from an established cancellation and blocks delayed saving", async () => {
      const body = await input(),
        operationKey = key(),
        before = await audits();
      const unknown = await read(operationKey);
      expect(unknown.status).toBe(200);
      expect(unknown.body.data.state).toBe("UNKNOWN");
      const cancelled = await cancel(operationKey);
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.state).toBe("CANCELLED");
      expect((await cancel(operationKey)).body.data.state).toBe("CANCELLED");
      expect((await put(body, operationKey)).status).toBe(409);
      expect((await read(operationKey)).body.data.state).toBe("CANCELLED");
      expect(await audits()).toBe(before);
    });
    it("never undoes an established save when cancellation arrives later", async () => {
      const body = await input(),
        operationKey = key();
      const saved = await put(body, operationKey);
      const result = await cancel(operationKey);
      expect(result.status).toBe(200);
      expect(result.body.data.state).toBe("SAVED");
      expect(result.body.data.savedVersion).toBe(saved.body.data.version);
      expect(result.body.data.coverage).toEqual(saved.body.data);
    });
    it("serializes two submissions under the original key", async () => {
      const before = await audits(),
        body = await input(),
        operationKey = key();
      const results = await Promise.all([
        put(body, operationKey),
        put(body, operationKey),
      ]);
      expect(results.map((result) => result.status)).toEqual([200, 200]);
      expect(results[0]!.body.data).toEqual(results[1]!.body.data);
      expect(await audits()).toBe(before + 1);
    });
    it("serializes cancel versus save without duplicate changes", async () => {
      const before = await audits(),
        body = await input(),
        operationKey = key();
      const [saved, cancelled] = await Promise.all([
        put(body, operationKey),
        cancel(operationKey),
      ]);
      const outcome = await read(operationKey);
      expect(cancelled.status).toBe(200);
      if (outcome.body.data.state === "SAVED") {
        expect(saved.status).toBe(200);
        expect(await audits()).toBe(before + 1);
      } else {
        expect(outcome.body.data.state).toBe("CANCELLED");
        expect(saved.status).toBe(409);
        expect(await audits()).toBe(before);
      }
    });
    it("reports the originally saved revision separately from a later configuration", async () => {
      const body = await input(),
        operationKey = key();
      const saved = await put(body, operationKey);
      const newer = await put(await input({ enabled: false }));
      const recovered = await read(operationKey);
      expect(recovered.status).toBe(200);
      expect(recovered.body.data.savedVersion).toBe(saved.body.data.version);
      expect(recovered.body.data.coverage).toEqual(newer.body.data);
      expect(recovered.body.data.coverage.version).toBeGreaterThan(
        recovered.body.data.savedVersion,
      );
    });
    it("rejects expired, future and malformed operation references", async () => {
      for (const operationKey of [
        key(Date.now() - 86_400_001),
        key(Date.now() + 300_000),
      ]) {
        expect((await put(await input(), operationKey)).status).toBe(409);
        expect((await read(operationKey)).status).toBe(409);
        expect((await cancel(operationKey)).status).toBe(409);
      }
      expect((await read("invalid-reference")).status).toBe(422);
    });
    it("enforces owner role and CSRF on recovery as well as saving", async () => {
      const admin = await f.account(null, "ADMIN"),
        operationKey = key();
      for (const actor of [admin, f.care, f.customer]) {
        expect(
          (
            await request(app)
              .get(root() + "/operations/" + operationKey)
              .set(actor.headers)
          ).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .delete(root() + "/operations/" + operationKey)
              .set(actor.headers)
          ).status,
        ).toBe(403);
      }
      const withoutCsrf = Object.fromEntries(
        Object.entries(owner.headers).filter(
          ([name]) => name.toLowerCase() !== "x-csrf-token",
        ),
      );
      expect(
        (
          await request(app)
            .delete(root() + "/operations/" + operationKey)
            .set(withoutCsrf)
        ).status,
      ).toBe(403);
    });
    it("does not enable the global live release when coverage is configured", async () => {
      const previous = env.SUPPORT_LIVE_CHAT_ENABLED;
      env.SUPPORT_LIVE_CHAT_ENABLED = false;
      try {
        expect((await put(await input(), key())).status).toBe(200);
        expect(env.SUPPORT_LIVE_CHAT_ENABLED).toBe(false);
      } finally {
        env.SUPPORT_LIVE_CHAT_ENABLED = previous;
      }
    });
  },
);
