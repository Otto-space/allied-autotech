import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";

const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
const base = "/api/v1/customers/notifications";
describe.skipIf(process.env.RUN_NOTIFICATION_AWARENESS_TESTS !== "true")(
  "notification awareness ownership and full unread summary",
  () => {
    let headers: Record<string, string>, otherHeaders: Record<string, string>;
    let userId: string,
      otherId: string,
      unreadId: string,
      ownReview: string,
      foreignReview: string;
    async function account() {
      const user = await prisma.user.create({
        data: {
          email: `notification-awareness-${randomUUID()}@example.test`,
          role: "CUSTOMER",
          emailVerifiedAt: new Date(),
          passwordHash: "unusable-synthetic-fixture",
          profile: {
            create: {
              firstName: "Synthetic",
              lastName: "Notifications",
              phone: "+2348000000000",
            },
          },
        },
        include: { profile: true },
      });
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiresAt = new Date(Date.now() + 3600000);
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt,
          idleExpiresAt: expiresAt,
          mfaRequired: false,
        },
      });
      return {
        user,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "X-CSRF-Token": csrf,
        },
      };
    }
    beforeAll(async () => {
      if (
        env.DB_HOST !== "127.0.0.1" ||
        (env.DB_NAME !== "allied_notification_awareness_20261022_ci" &&
          !/^allied_notifications_20261025_[a-f0-9]{12}_ci$/.test(env.DB_NAME))
      )
        throw new Error("Requires the newly created isolated notification test database");
      const target = await prisma.$queryRaw<
        { name: string }[]
      >`SELECT current_database() AS name`;
      if (target[0]?.name !== env.DB_NAME) throw new Error("Wrong isolated target");
      const first = await account(),
        second = await account();
      headers = first.headers;
      otherHeaders = second.headers;
      userId = first.user.id;
      otherId = second.user.id;
      const data = {
        userId,
        type: "BOOKING" as const,
        category: "TRANSACTIONAL" as const,
        title: "Synthetic update",
        message: "Synthetic fixture",
        resourceType: "BOOKING",
        resourceId: randomUUID(),
      };
      unreadId = randomUUID();
      await prisma.notification.createMany({
        data: [
          { ...data, id: unreadId },
          ...Array.from({ length: 129 }, () => ({ ...data, id: randomUUID() })),
          { ...data, readAt: new Date() },
          { ...data, expiresAt: new Date(Date.now() - 10000) },
          { ...data, userId: otherId },
        ],
      });
      ownReview = (
        await prisma.review.create({
          data: {
            customerId: first.user.profile!.id,
            targetType: "BUSINESS",
            rating: 4,
            comment: "Synthetic older review",
            createdAt: new Date("2020-01-01T00:00:00Z"),
          },
        })
      ).id;
      await prisma.review.create({
        data: {
          customerId: first.user.profile!.id,
          targetType: "BUSINESS",
          rating: 5,
          comment: "Synthetic recent review",
        },
      });
      foreignReview = (
        await prisma.review.create({
          data: {
            customerId: second.user.profile!.id,
            targetType: "BUSINESS",
            rating: 3,
            comment: "Synthetic other review",
          },
        })
      ).id;
    });
    afterAll(async () => {
      await prisma.$disconnect();
    });
    it("counts all 130 unread records across pages, excluding expired, read and foreign records", async () => {
      const response = await request(app).get(`${base}/summary`).set(headers).expect(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.body.data).toEqual({
        unreadCount: 130,
        groups: [
          {
            resourceType: "BOOKING",
            type: "BOOKING",
            category: "TRANSACTIONAL",
            count: 130,
          },
        ],
      });
      const other = await request(app)
        .get(`${base}/summary`)
        .set(otherHeaders)
        .expect(200);
      expect(other.body.data.unreadCount).toBe(1);
    });
    it("rejects unauthenticated access, staff-only access and attempts to choose another account", async () => {
      await request(app).get(`${base}/summary`).expect(401);
      await request(app)
        .get("/api/v1/staff/notifications/summary")
        .set(headers)
        .expect(403);
      await request(app)
        .get(`${base}/summary?userId=${otherId}`)
        .set(headers)
        .expect(422);
      await request(app)
        .post(`${base}/${unreadId}/read`)
        .set(otherHeaders)
        .send({})
        .expect(404);
    });
    it("decrements a confirmed read once and clears all counts without changing another account", async () => {
      await request(app)
        .post(`${base}/${unreadId}/read`)
        .set(headers)
        .send({})
        .expect(200);
      await request(app)
        .post(`${base}/${unreadId}/read`)
        .set(headers)
        .send({})
        .expect(200);
      expect(
        (await request(app).get(`${base}/summary`).set(headers).expect(200)).body.data
          .unreadCount,
      ).toBe(129);
      await request(app).post(`${base}/read-all`).set(headers).send({}).expect(200);
      expect(
        (await request(app).get(`${base}/summary`).set(headers).expect(200)).body.data,
      ).toEqual({ unreadCount: 0, groups: [] });
      expect(
        (await request(app).get(`${base}/summary`).set(otherHeaders).expect(200)).body
          .data.unreadCount,
      ).toBe(1);
    });
    it("opens an older exact review without exposing a different customer's review", async () => {
      const root = "/api/v1/customers/support/reviews";
      const own = await request(app)
        .get(`${root}?reviewId=${ownReview}&limit=1`)
        .set(headers)
        .expect(200);
      expect(own.body.data.items.map((row: { id: string }) => row.id)).toEqual([
        ownReview,
      ]);
      const foreign = await request(app)
        .get(`${root}?reviewId=${foreignReview}&limit=1`)
        .set(headers)
        .expect(200);
      expect(foreign.body.data.items).toEqual([]);
      await request(app).get(`${root}?reviewId=../other`).set(headers).expect(422);
    });
  },
);
