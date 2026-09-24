import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { testOwner } from "../helpers/owner.js";
async function account(role: UserRole) {
  if (role === "SUPER_ADMIN") return testOwner("unusable-test-only");
  return prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-test-only",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {}
        : {
            staffProfile: { create: { firstName: "Synthetic", lastName: "Permissions" } },
          }),
    },
  });
}
async function session(userId: string, role: UserRole, assured = true) {
  const token = generateOpaqueToken();
  const csrf = generateOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3_600_000);
  const record = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt,
      idleExpiresAt: expiresAt,
      createdAt: now,
      lastRotatedAt: now,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: assured && role !== "CUSTOMER" ? now : null,
    },
  });
  return { cookie: `${sessionCookieName}=${token}`, csrf, record };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Privacy review and retention holds",
  () => {
    afterAll(() => prisma.$disconnect());
    it("isolates customer intake, enforces narrow grants and prevents stale review updates", async () => {
      const app = createApp({ checkReadiness: async () => undefined });
      const customer = await account("CUSTOMER"),
        stranger = await account("CUSTOMER"),
        owner = await account("SUPER_ADMIN");
      const customerAuth = await session(customer.id, customer.role),
        strangerAuth = await session(stranger.id, stranger.role);
      const post = (
        auth: typeof customerAuth,
        path: string,
        body: unknown,
        csrf = auth.csrf,
      ) =>
        request(app)
          .post(`/api/v1${path}`)
          .set("Cookie", auth.cookie)
          .set("Origin", "http://localhost:3000")
          .set("X-CSRF-Token", csrf)
          .send(body);
      const get = (auth: typeof customerAuth, path: string) =>
        request(app).get(`/api/v1${path}`).set("Cookie", auth.cookie);
      const intake = {
        kind: "DELETION",
        reason: "Synthetic customer privacy review request",
      };
      expect(
        (await get(customerAuth, "/customers/privacy-requests?limit=0")).status,
      ).toBe(422);
      expect(
        (await get(customerAuth, "/customers/privacy-requests?cursor=invalid")).status,
      ).toBe(422);
      expect(
        (await post(customerAuth, "/customers/privacy-requests", intake, "bad-token"))
          .status,
      ).toBe(403);
      expect(
        (
          await post(customerAuth, "/customers/privacy-requests", {
            ...intake,
            userId: stranger.id,
          })
        ).status,
      ).toBe(422);
      const parallel = await Promise.all([
        post(customerAuth, "/customers/privacy-requests", intake),
        post(customerAuth, "/customers/privacy-requests", intake),
      ]);
      expect(parallel.map((r) => r.status)).toEqual([201, 201]);
      const record = parallel[0]!.body.data;
      expect(record).not.toHaveProperty("reviewedByUserId");
      expect(parallel[1]!.body.data.id).toBe(record.id);
      expect(await prisma.privacyRequest.count({ where: { userId: customer.id } })).toBe(
        1,
      );
      const repeated = await post(customerAuth, "/customers/privacy-requests", {
        ...intake,
        reason: "Synthetic alternate reason is not a replacement",
      });
      expect(repeated.body.data).toMatchObject({
        id: record.id,
        reason: intake.reason,
        status: "REQUESTED",
      });
      expect(
        (await get(strangerAuth, "/customers/privacy-requests")).body.data.items,
      ).toEqual([]);
      expect(
        (await get(customerAuth, "/customers/privacy-requests")).body.data.items,
      ).toHaveLength(1);
      expect((await get(customerAuth, "/staff/privacy-requests")).status).toBe(403);
      const route = `/staff/privacy-requests/${record.id}/review`;
      expect(
        (
          await post(customerAuth, route, {
            status: "UNDER_REVIEW",
            note: "Synthetic unauthorized review",
          })
        ).status,
      ).toBe(403);
      const reviewers = [];
      for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
        const user = role === "SUPER_ADMIN" ? owner : await account(role),
          auth = await session(user.id, role);
        await prisma.userCapability.updateMany({
          where: { userId: user.id, capability: "PRIVACY_REVIEW", revokedAt: null },
          data: { revokedAt: new Date() },
        });
        expect((await get(auth, "/staff/privacy-requests")).status).toBe(403);
        const grant = await prisma.userCapability.create({
          data: {
            userId: user.id,
            capability: "PRIVACY_REVIEW",
            grantedByUserId: owner.id,
          },
        });
        expect((await get(auth, "/staff/privacy-requests")).status).toBe(200);
        expect(
          (await get(await session(user.id, role, false), "/staff/privacy-requests"))
            .status,
        ).toBe(403);
        reviewers.push({ user, auth, grant });
      }
      const reviewer = reviewers[0]!;
      expect((await get(reviewer.auth, "/staff/privacy-requests?limit=0")).status).toBe(
        422,
      );
      expect(
        (await get(reviewer.auth, "/staff/retention-holds?userId=invalid")).status,
      ).toBe(422);
      const holdBody = {
        userId: customer.id,
        recordType: "ALL",
        reason: "Synthetic protection while accounting review remains open",
      };
      expect(
        (await post(reviewer.auth, "/staff/retention-holds", holdBody, "bad-token"))
          .status,
      ).toBe(403);
      const createdHold = await post(reviewer.auth, "/staff/retention-holds", holdBody);
      expect(createdHold.status).toBe(201);
      const holdId = createdHold.body.data.id;
      expect(
        (await get(reviewer.auth, `/staff/retention-holds?userId=${customer.id}`)).body
          .data,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: holdId, releasedAt: null }),
        ]),
      );
      expect(
        (await get(customerAuth, `/staff/retention-holds?userId=${customer.id}`)).status,
      ).toBe(403);
      const approval = {
        status: "APPROVED_PENDING_POLICY",
        note: "Synthetic reviewed privacy response visible to customer",
        expectedReviewedAt: null,
      };
      expect((await post(reviewer.auth, route, approval)).status).toBe(409);
      expect(
        (
          await post(reviewer.auth, `/staff/retention-holds/${holdId}/release`, {
            reason: "short",
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await post(reviewer.auth, `/staff/retention-holds/${holdId}/release`, {
            reason: "Synthetic documented accounting clearance TEST-PRIVACY",
          })
        ).status,
      ).toBe(200);
      const competing = await Promise.all([
        post(reviewer.auth, route, approval),
        post(reviewers[1]!.auth, route, { ...approval, status: "UNDER_REVIEW" }),
      ]);
      expect(competing.map((r) => r.status).sort()).toEqual([200, 409]);
      const saved = competing.find((r) => r.status === 200)!.body.data;
      expect(saved.reviewedAt).not.toBeNull();
      expect(
        (await post(reviewer.auth, route, { ...approval, status: "REJECTED" })).status,
      ).toBe(409);
      const rejected = await post(reviewer.auth, route, {
        ...approval,
        status: "REJECTED",
        expectedReviewedAt: saved.reviewedAt,
      });
      expect(rejected.status).toBe(200);
      expect(Date.parse(rejected.body.data.reviewedAt)).toBeGreaterThan(
        Date.parse(saved.reviewedAt),
      );
      const own = (await get(customerAuth, "/customers/privacy-requests?limit=1")).body
        .data;
      expect(own.items[0]).toMatchObject({
        id: record.id,
        status: "REJECTED",
        reviewNote: approval.note,
      });
      expect(own.items[0]).not.toHaveProperty("reviewedByUserId");
      const fresh = await post(customerAuth, "/customers/privacy-requests", intake);
      expect(fresh.status).toBe(201);
      expect(fresh.body.data.id).not.toBe(record.id);
      const first = (await get(customerAuth, "/customers/privacy-requests?limit=1")).body
        .data;
      expect(first.nextCursor).toBe(fresh.body.data.id);
      const second = (
        await get(
          customerAuth,
          `/customers/privacy-requests?limit=1&cursor=${first.nextCursor}`,
        )
      ).body.data;
      expect(second.items[0].id).toBe(record.id);
      expect(second.nextCursor).toBeNull();
      await prisma.userCapability.update({
        where: { id: reviewer.grant.id },
        data: { revokedAt: new Date() },
      });
      expect((await get(reviewer.auth, "/staff/privacy-requests")).status).toBe(403);
      expect(
        (
          await post(reviewer.auth, route, {
            ...approval,
            expectedReviewedAt: rejected.body.data.reviewedAt,
          })
        ).status,
      ).toBe(403);
      expect((await post(reviewer.auth, "/staff/retention-holds", holdBody)).status).toBe(
        403,
      );
      expect(await prisma.user.findUnique({ where: { id: customer.id } })).not.toBeNull();
      expect(
        await prisma.auditLog.count({
          where: {
            userId: customer.id,
            action: "CREATE",
            newValues: { path: ["privacyRequestId"], equals: record.id },
          },
        }),
      ).toBe(1);
    }, 30000);
  },
);
