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
  "Operational owner policy approvals",
  () => {
    afterAll(() => prisma.$disconnect());
    for (const kind of ["COMPLAINTS", "DISPUTES", "RETENTION"] as const)
      it(`${kind} enforces owner approval, validates settings and serializes competing versions`, async () => {
        const app = createApp({ checkReadiness: async () => undefined });
        const owner = await account("SUPER_ADMIN"),
          identity = await session(owner.id, owner.role);
        const primary = await account("ADMIN"),
          backup = await account("STAFF");
        const latest = await prisma.businessPolicyVersion.findFirst({
          where: { key: kind.toLowerCase() },
          orderBy: { version: "desc" },
        });
        const settings =
          kind === "COMPLAINTS"
            ? {
                escalationUserId: primary.id,
                ordinaryBusinessDayDefinition: "ACCUMULATED_WORKING_HOURS",
                holidays: ["2035-10-01"],
                holidayCalendarApproved: true,
                urgentClassifications: ["Synthetic urgent safety complaint"],
              }
            : kind === "DISPUTES"
              ? {
                  primaryUserId: primary.id,
                  backupUserId: backup.id,
                  days: [1, 2, 3, 4, 5],
                  openMinute: 480,
                  closeMinute: 1080,
                  holidays: ["2035-10-01"],
                }
              : {
                  destructiveExecutionEnabled: false,
                  records: [
                    {
                      recordType: "INVOICE",
                      retentionMonths: 84,
                      startEvent: "Synthetic invoice issue event",
                      disposition: "RETAIN",
                      legalBasis: "Synthetic approved legal basis for this test only.",
                    },
                  ],
                };
        const body = {
          kind,
          settings,
          expectedVersion: latest?.version ?? 0,
          effectiveAt: "2035-01-01T00:00:00Z",
          source: "Synthetic owner approval",
          approvalEvidence: "Synthetic signed operational policy TEST-APPROVAL.",
        };
        const publish = (auth: typeof identity, data: unknown = body, csrf = auth.csrf) =>
          request(app)
            .post("/api/v1/admin/policies")
            .set("Cookie", auth.cookie)
            .set("Origin", "http://localhost:3000")
            .set("X-CSRF-Token", csrf)
            .send(data);
        for (const role of ["CUSTOMER", "STAFF", "ADMIN"] as const) {
          const user = await account(role),
            auth = await session(user.id, role);
          expect((await publish(auth)).status).toBe(403);
          expect(
            (
              await request(app)
                .get(`/api/v1/admin/policies?key=${kind.toLowerCase()}`)
                .set("Cookie", auth.cookie)
            ).status,
          ).toBe(403);
        }
        expect((await publish(await session(owner.id, owner.role, false))).status).toBe(
          403,
        );
        expect(await publish(identity, body, "wrong-csrf")).toMatchObject({
          status: 403,
        });
        expect(
          (await publish(identity, { ...body, approvalEvidence: "short" })).status,
        ).toBe(422);
        expect(
          (await publish(identity, { ...body, effectiveAt: "2020-01-01T00:00:00Z" }))
            .status,
        ).toBe(409);
        if (kind === "COMPLAINTS") {
          expect(
            (
              await publish(identity, {
                ...body,
                settings: { ...settings, escalationUserId: backup.id },
              })
            ).status,
          ).toBe(409);
          await prisma.user.update({
            where: { id: primary.id },
            data: { emailVerifiedAt: null },
          });
          expect((await publish(identity)).status).toBe(409);
          await prisma.user.update({
            where: { id: primary.id },
            data: { emailVerifiedAt: new Date(), status: "SUSPENDED" },
          });
          expect((await publish(identity)).status).toBe(409);
          await prisma.user.update({
            where: { id: primary.id },
            data: { status: "ACTIVE" },
          });
          for (const invalid of [
            { holidays: ["2035-02-30"] },
            { holidayCalendarApproved: false },
            { urgentClassifications: [] },
            { ordinaryBusinessDayDefinition: "CALENDAR_DAY" },
          ])
            expect(
              (
                await publish(identity, {
                  ...body,
                  settings: { ...settings, ...invalid },
                })
              ).status,
            ).toBe(422);
        } else if (kind === "DISPUTES") {
          expect((await publish(identity)).status).toBe(409);
          await prisma.userCapability.create({
            data: {
              userId: primary.id,
              capability: "DISPUTE_MANAGE",
              grantedByUserId: owner.id,
            },
          });
          expect((await publish(identity)).status).toBe(409);
          const grant = await prisma.userCapability.create({
            data: {
              userId: backup.id,
              capability: "DISPUTE_MANAGE",
              grantedByUserId: owner.id,
            },
          });
          await prisma.userCapability.update({
            where: { id: grant.id },
            data: { revokedAt: new Date() },
          });
          expect((await publish(identity)).status).toBe(409);
          await prisma.userCapability.create({
            data: {
              userId: backup.id,
              capability: "DISPUTE_MANAGE",
              grantedByUserId: owner.id,
            },
          });
          for (const invalid of [
            { backupUserId: primary.id },
            { days: [] },
            { closeMinute: 480 },
            { holidays: ["2035-02-30"] },
          ])
            expect(
              (
                await publish(identity, {
                  ...body,
                  settings: { ...settings, ...invalid },
                })
              ).status,
            ).toBe(422);
        } else {
          for (const invalid of [
            { destructiveExecutionEnabled: true },
            { records: [] },
            {
              records: [
                {
                  recordType: "INVOICE",
                  retentionMonths: 0,
                  startEvent: "issue",
                  disposition: "DELETE",
                  legalBasis: "short",
                },
              ],
            },
          ])
            expect(
              (
                await publish(identity, {
                  ...body,
                  settings: { ...settings, ...invalid },
                })
              ).status,
            ).toBe(422);
        }
        const responses = await Promise.all([publish(identity), publish(identity)]);
        expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
        const saved = responses.find((r) => r.status === 201)!.body.data;
        expect(saved).toMatchObject({
          source: body.source,
          approvalEvidence: body.approvalEvidence,
          key: kind.toLowerCase(),
          version: body.expectedVersion + 1,
          approvalStatus: "APPROVED",
          approvedByUserId: owner.id,
          settings,
        });
        const history = await request(app)
          .get(`/api/v1/admin/policies?key=${kind.toLowerCase()}&limit=100`)
          .set("Cookie", identity.cookie);
        expect(history.status).toBe(200);
        expect(history.body.data[0]).toMatchObject({ id: saved.id, settings });
        expect(
          await prisma.auditLog.count({
            where: {
              userId: owner.id,
              newValues: { path: ["policyVersionId"], equals: saved.id },
            },
          }),
        ).toBe(1);
        expect(
          await prisma.user.count({
            where: { id: { in: [owner.id, primary.id, backup.id] } },
          }),
        ).toBe(3);
      }, 30000);
  },
);
