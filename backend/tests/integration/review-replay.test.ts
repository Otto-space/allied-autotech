import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import * as audit from "../../src/modules/audit/audit.service.js";
import {
  reviewSourceCustomer,
  reviewSourceFixtures,
  sourceTargets,
} from "../helpers/review-sources.js";
import { newReviewRequestKey } from "../helpers/review-request.js";
import { testOwner } from "../helpers/owner.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "durable customer review replay",
  () => {
    let app = createApp();
    beforeEach(() => {
      app = createApp();
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(() => prisma.$disconnect());
    type Customer = Awaited<ReturnType<typeof reviewSourceCustomer>>;
    const path = "/api/v1/customers/support/reviews";
    function post(
      f: Customer,
      body: unknown,
      key: string | undefined = newReviewRequestKey(),
    ) {
      const req = request(app)
        .post(path)
        .set("Cookie", f.cookie)
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", f.csrf);
      return (key === "" ? req : req.set("Idempotency-Key", key!)).send(body);
    }
    const business = { targetType: "BUSINESS", rating: 5, comment: "Original review" };
    const receipts = (f: Customer) =>
      prisma.idempotencyRecord.findMany({
        where: { scope: `review-create:${f.user.id}` },
      });
    const counts = async (f: Customer) => ({
      reviews: await prisma.review.count({ where: { customerId: f.customerId } }),
      audits: await prisma.auditLog.count({
        where: { userId: f.user.id, entityType: "REVIEW", action: "CREATE" },
      }),
      receipts: (await receipts(f)).length,
    });

    for (const targetType of ["BUSINESS", ...sourceTargets] as const) {
      it(`${targetType}: original request replays the same identity and current moderation with one audit`, async () => {
        const f = await reviewSourceCustomer(),
          key = newReviewRequestKey();
        const body =
          targetType === "BUSINESS"
            ? business
            : (await (await reviewSourceFixtures(f.customerId)).source(targetType)).body;
        const initial = await post(f, body, key);
        expect(initial.status).toBe(201);
        expect(initial.body.data.replayed).toBe(false);
        expect(initial.headers["cache-control"]).toContain("no-store");
        const owner = await testOwner("synthetic-owner");
        await prisma.review.update({
          where: { id: initial.body.data.id },
          data: {
            status: "REJECTED",
            version: { increment: 1 },
            moderatedAt: new Date(),
            moderatedByUserId: owner.id,
            moderationNote: "Synthetic moderation",
          },
        });
        const again = await post(
          f,
          Object.fromEntries(
            Object.entries({ ...body, comment: `  ${body.comment}  ` }).reverse(),
          ),
          key,
        );
        expect(again.status).toBe(201);
        expect(again.body.data).toMatchObject({
          id: initial.body.data.id,
          replayed: true,
          status: "REJECTED",
          version: 1,
        });
        expect(again.body.data.customerId).toBeUndefined();
        expect(again.body.data.customer).toBeUndefined();
        expect(await counts(f)).toEqual({ reviews: 1, audits: 1, receipts: 1 });
        expect((await receipts(f))[0]?.responseBody).toEqual({
          resourceId: initial.body.data.id,
        });
      });
    }

    it("serializes competing same-key requests and returns a single result", async () => {
      const f = await reviewSourceCustomer(),
        key = newReviewRequestKey();
      const results = await Promise.all([
        post(f, business, key),
        post(f, business, key),
        post(f, business, key),
      ]);
      expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
      expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
      expect(results.filter((r) => !r.body.data.replayed)).toHaveLength(1);
      expect(await counts(f)).toEqual({ reviews: 1, audits: 1, receipts: 1 });
    });

    it("conflicts on changed content, rating or target without new writes", async () => {
      const f = await reviewSourceCustomer(),
        key = newReviewRequestKey();
      expect((await post(f, business, key)).status).toBe(201);
      for (const body of [
        { ...business, comment: "Different content" },
        { ...business, rating: 1 },
        { ...business, title: "Different title" },
        {
          targetType: "ORDER",
          orderId: randomUUID(),
          rating: 5,
          comment: business.comment,
        },
      ]) {
        const result = await post(f, body, key);
        expect(result.status).toBe(409);
        expect(result.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      }
      expect(await counts(f)).toEqual({ reviews: 1, audits: 1, receipts: 1 });
    });

    it("scopes identical raw keys to each customer and never returns a foreign receipt", async () => {
      const f = await reviewSourceCustomer(),
        foreign = await reviewSourceCustomer(),
        key = newReviewRequestKey();
      const first = await post(f, business, key),
        second = await post(
          foreign,
          { ...business, comment: "Other customer's review" },
          key,
        );
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.data.id).not.toBe(first.body.data.id);
      expect(second.body.data.replayed).toBe(false);
      const receipt = (await receipts(f))[0]!;
      await prisma.idempotencyRecord.update({
        where: { id: receipt.id },
        data: { responseBody: { resourceId: second.body.data.id } },
      });
      const replay = await post(f, business, key);
      expect(replay.status).toBe(409);
      expect(JSON.stringify(replay.body)).not.toContain("Other customer's review");
      expect(await counts(f)).toEqual({ reviews: 1, audits: 1, receipts: 1 });
    });

    it("rejects expired keys both before and after receipt cleanup, and future keys", async () => {
      const f = await reviewSourceCustomer(),
        fresh = newReviewRequestKey();
      const original = await post(f, business, fresh);
      expect(original.status).toBe(201);
      const oldKey = newReviewRequestKey(Date.now() - 25 * 3600000),
        current = (await receipts(f))[0]!;
      const receipt = await prisma.idempotencyRecord.create({
        data: {
          scope: current.scope,
          userId: f.user.id,
          keyHash: createHash("sha256").update(oldKey).digest("hex"),
          requestHash: current.requestHash,
          status: "COMPLETED",
          responseStatus: 201,
          responseBody: { resourceId: original.body.data.id },
          createdAt: new Date(Date.now() - 25 * 3600000),
          completedAt: new Date(Date.now() - 25 * 3600000),
          expiresAt: new Date(Date.now() - 3600000),
        },
      });
      expect((await post(f, business, oldKey)).body.error.code).toBe(
        "IDEMPOTENCY_EXPIRED",
      );
      await prisma.idempotencyRecord.deleteMany({
        where: { id: receipt.id, expiresAt: { lte: new Date() } },
      });
      for (const key of [oldKey, newReviewRequestKey(Date.now() + 120000)]) {
        const result = await post(f, business, key);
        expect(result.status).toBe(409);
        expect(result.body.error.code).toBe("IDEMPOTENCY_EXPIRED");
      }
      expect(await counts(f)).toEqual({ reviews: 1, audits: 1, receipts: 1 });
    });

    it("rolls back the review and receipt if auditing fails; original-key recovery can then create once", async () => {
      const f = await reviewSourceCustomer(),
        key = newReviewRequestKey();
      vi.spyOn(audit, "appendAuditEvent").mockRejectedValueOnce(
        new Error("Synthetic audit failure"),
      );
      expect((await post(f, business, key)).status).toBe(500);
      expect(await counts(f)).toEqual({ reviews: 0, audits: 0, receipts: 0 });
      expect((await post(f, business, key)).body.data.replayed).toBe(false);
      expect((await post(f, business, key)).body.data.replayed).toBe(true);
      expect(await counts(f)).toEqual({ reviews: 1, audits: 1, receipts: 1 });
    });

    it("requires a valid key, authentication and CSRF on every attempt", async () => {
      const f = await reviewSourceCustomer();
      for (const key of [
        "",
        randomUUID(),
        "review-v1.bad",
        `review-v1.${Date.now()}.${randomUUID().toUpperCase()}`,
      ])
        expect((await post(f, business, key)).status).toBe(422);
      expect(
        (
          await request(app)
            .post(path)
            .set("Origin", "http://localhost:3000")
            .set("Idempotency-Key", newReviewRequestKey())
            .send(business)
        ).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post(path)
            .set("Cookie", f.cookie)
            .set("Origin", "http://localhost:3000")
            .set("Idempotency-Key", newReviewRequestKey())
            .send(business)
        ).status,
      ).toBe(403);
      expect(await counts(f)).toEqual({ reviews: 0, audits: 0, receipts: 0 });
    });
  },
);
