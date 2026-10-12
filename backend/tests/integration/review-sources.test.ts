import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { reviewSourcePageSchema } from "../../src/modules/support/support.schemas.js";
import {
  reviewSourceCustomer,
  reviewSourceFixtures,
  sourceTargets,
} from "../helpers/review-sources.js";
import { testOwner } from "../helpers/owner.js";
import { newReviewRequestKey } from "../helpers/review-request.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { sessionWindow } from "../helpers/session-window.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "owned available review sources",
  () => {
    let app = createApp();
    const path = "/api/v1/customers/support/review-sources";
    beforeEach(() => {
      app = createApp();
    });
    type Customer = Awaited<ReturnType<typeof reviewSourceCustomer>>;
    const get = (f: Customer, query: Record<string, string | number>) =>
      request(app).get(path).set("Cookie", f.cookie).query(query);
    const post = (f: Customer, body: unknown) =>
      request(app)
        .post("/api/v1/customers/support/reviews")
        .set("Idempotency-Key", newReviewRequestKey())
        .set("Cookie", f.cookie)
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", f.csrf)
        .send(body);
    afterAll(() => prisma.$disconnect());

    for (const targetType of sourceTargets) {
      it(`${targetType}: excludes foreign, incomplete and all reviewed sources with private projection`, async () => {
        const owner = await reviewSourceCustomer(),
          foreign = await reviewSourceCustomer();
        const fixture = await reviewSourceFixtures(owner.customerId);
        const available = await fixture.source(targetType);
        const incomplete = await fixture.source(targetType, false),
          other = await fixture.source(targetType, true, foreign.customerId);
        const moderator = await testOwner("unusable-synthetic-fixture");
        for (const status of ["PENDING", "APPROVED", "REJECTED"] as const) {
          const source = await fixture.source(targetType);
          await prisma.review.create({
            data: {
              customerId: owner.customerId,
              ...source.body,
              status,
              ...(status !== "PENDING"
                ? {
                    moderatedByUserId: moderator.id,
                    moderatedAt: new Date(),
                    moderationNote: "Synthetic decision",
                  }
                : {}),
            },
          });
          expect(
            (await get(owner, { targetType, sourceId: source.id })).body.data.items,
          ).toEqual([]);
        }
        const result = await get(owner, { targetType });
        expect(result.status).toBe(200);
        expect(result.headers["cache-control"]).toContain("no-store");
        const data = reviewSourcePageSchema.parse(result.body.data);
        expect(data.items).toHaveLength(1);
        expect(data.items[0]).toMatchObject({
          id: available.id,
          targetType,
          ...available.fields,
        });
        expect(Object.keys(result.body.data.items[0]).sort()).toEqual(
          ["id", "label", "targetType", ...Object.keys(available.fields)].sort(),
        );
        expect(JSON.stringify(result.body)).not.toContain("PRIVATE_CONTACT_SENTINEL");
        for (const sourceId of [incomplete.id, other.id, randomUUID()]) {
          const lookup = await get(owner, { targetType, sourceId });
          expect(lookup.status).toBe(200);
          expect(lookup.body.data).toEqual({ items: [] });
        }
        const eligible = await get(owner, { targetType, sourceId: available.id });
        expect(eligible.body.data.items).toHaveLength(1);
        expect((await post(owner, available.body)).status).toBe(201);
        expect(
          (await get(owner, { targetType, sourceId: available.id })).body.data.items,
        ).toEqual([]);
        expect((await post(owner, available.body)).status).toBe(409);
      });

      it(`${targetType}: keyset traversal survives the cursor becoming reviewed`, async () => {
        const owner = await reviewSourceCustomer(),
          fixture = await reviewSourceFixtures(owner.customerId);
        const sources = [];
        for (let i = 0; i < 5; i++) sources.push(await fixture.source(targetType));
        const sorted = sources.map((s) => s.id).sort();
        const first = await get(owner, { targetType, limit: 2 });
        expect(first.body.data.items.map((s: { id: string }) => s.id)).toEqual(
          sorted.slice(0, 2),
        );
        expect(first.body.data.nextCursor).toBe(sorted[1]);
        expect(
          (await post(owner, sources.find((s) => s.id === sorted[1])!.body)).status,
        ).toBe(201);
        const second = await get(owner, {
          targetType,
          limit: 2,
          cursor: first.body.data.nextCursor,
        });
        expect(second.body.data.items.map((s: { id: string }) => s.id)).toEqual(
          sorted.slice(2, 4),
        );
        const third = await get(owner, {
          targetType,
          limit: 2,
          cursor: second.body.data.nextCursor,
        });
        expect(third.body.data.items.map((s: { id: string }) => s.id)).toEqual(
          sorted.slice(4),
        );
        expect(third.body.data.nextCursor).toBeUndefined();
      });
    }

    it("excludes all purchases of an already-reviewed product, including rejected reviews", async () => {
      const owner = await reviewSourceCustomer(),
        fixture = await reviewSourceFixtures(owner.customerId);
      const first = await fixture.source("PRODUCT", true, owner.customerId, true);
      const second = await fixture.source("PRODUCT", true, owner.customerId, true);
      expect((await get(owner, { targetType: "PRODUCT" })).body.data.items).toHaveLength(
        2,
      );
      const created = await post(owner, first.body);
      expect(created.status).toBe(201);
      const moderator = await testOwner("unusable-synthetic-fixture");
      await prisma.review.update({
        where: { id: created.body.data.id },
        data: {
          status: "REJECTED",
          moderatedByUserId: moderator.id,
          moderatedAt: new Date(),
          moderationNote: "Synthetic moderation",
          version: { increment: 1 },
        },
      });
      expect((await get(owner, { targetType: "PRODUCT" })).body.data.items).toEqual([]);
      expect(
        (await get(owner, { targetType: "PRODUCT", sourceId: second.id })).body.data
          .items,
      ).toEqual([]);
      expect((await post(owner, second.body)).status).toBe(409);
    });

    it("keeps product-item and whole-order availability independent", async () => {
      const owner = await reviewSourceCustomer(),
        fixture = await reviewSourceFixtures(owner.customerId);
      const product = await fixture.source("PRODUCT");
      const item = await prisma.orderItem.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(
        (
          await post(owner, {
            targetType: "ORDER",
            orderId: item.orderId,
            rating: 5,
            comment: "Order experience",
          })
        ).status,
      ).toBe(201);
      expect(
        (await get(owner, { targetType: "PRODUCT", sourceId: product.id })).body.data
          .items,
      ).toHaveLength(1);
      expect((await post(owner, product.body)).status).toBe(201);
      expect(
        (await get(owner, { targetType: "PRODUCT", sourceId: product.id })).body.data
          .items,
      ).toEqual([]);
      expect(
        (await get(owner, { targetType: "ORDER", sourceId: item.orderId })).body.data
          .items,
      ).toEqual([]);
    });

    it("another customer's product review does not consume this customer's eligibility", async () => {
      const owner = await reviewSourceCustomer(),
        foreign = await reviewSourceCustomer();
      const fixture = await reviewSourceFixtures(owner.customerId);
      const own = await fixture.source("PRODUCT", true, owner.customerId, true);
      const other = await fixture.source("PRODUCT", true, foreign.customerId, true);
      expect((await post(foreign, other.body)).status).toBe(201);
      const available = await get(owner, { targetType: "PRODUCT" });
      expect(available.body.data.items.map((row: { id: string }) => row.id)).toEqual([
        own.id,
      ]);
      expect((await post(owner, own.body)).status).toBe(201);
    });

    it("does not expose customer sources to the super administrator", async () => {
      const owner = await testOwner("unusable-synthetic-fixture"),
        token = generateOpaqueToken(),
        now = new Date();
      await prisma.session.create({
        data: {
          userId: owner.id,
          tokenHash: hashToken("session", token),
          ...sessionWindow(3600000),
          createdAt: now,
          lastRotatedAt: now,
          mfaRequired: true,
          mfaVerifiedAt: now,
        },
      });
      expect(
        (
          await request(app)
            .get(path)
            .set("Cookie", `${sessionCookieName}=${token}`)
            .query({ targetType: "ORDER" })
        ).status,
      ).toBe(403);
    });

    it("revalidates a source changed after selection and prevents concurrent duplicate reviews", async () => {
      const owner = await reviewSourceCustomer(),
        fixture = await reviewSourceFixtures(owner.customerId);
      const source = await fixture.source("SERVICE");
      expect(
        (await get(owner, { targetType: "SERVICE", sourceId: source.id })).body.data
          .items,
      ).toHaveLength(1);
      await prisma.booking.update({
        where: { id: source.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "Synthetic changed source",
        },
      });
      expect((await post(owner, source.body)).status).toBe(409);
      const another = await fixture.source("ORDER");
      const results = await Promise.all([
        post(owner, another.body),
        post(owner, another.body),
      ]);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
      expect(await prisma.review.count({ where: { orderId: another.id } })).toBe(1);
    });

    it("rejects missing/invalid target, pagination and scope injection", async () => {
      const owner = await reviewSourceCustomer();
      for (const query of [
        {},
        { targetType: "BUSINESS" },
        { targetType: "ORDER", limit: 0 },
        { targetType: "ORDER", limit: 51 },
        { targetType: "ORDER", cursor: "bad" },
        { targetType: "ORDER", sourceId: randomUUID(), cursor: randomUUID() },
        { targetType: "ORDER", customerId: randomUUID() },
        { targetType: "ORDER", status: "PENDING" },
      ])
        expect((await get(owner, query)).status).toBe(422);
      expect((await get(owner, { targetType: "ORDER" })).body.data).toEqual({
        items: [],
      });
    });

    it("requires an authenticated customer and CSRF for subsequent creation", async () => {
      expect((await request(app).get(path).query({ targetType: "ORDER" })).status).toBe(
        401,
      );
      const owner = await reviewSourceCustomer();
      expect(
        (
          await request(app)
            .post("/api/v1/customers/support/reviews")
            .set("Cookie", owner.cookie)
            .send({ targetType: "BUSINESS", rating: 5, comment: "Test" })
        ).status,
      ).toBe(403);
      for (const role of ["STAFF", "ADMIN"] as const) {
        const f = await reviewSourceCustomer();
        await prisma.user.update({ where: { id: f.user.id }, data: { role } });
        await prisma.session.updateMany({
          where: { userId: f.user.id },
          data: { mfaRequired: true, mfaVerifiedAt: new Date() },
        });
        expect((await get(f, { targetType: "ORDER" })).status).toBe(403);
      }
    });
  },
);
