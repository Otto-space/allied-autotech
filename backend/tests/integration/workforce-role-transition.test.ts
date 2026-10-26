import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture, fixturePassword } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { decryptIdentityPayload } from "../../src/common/security/mfa-encryption.js";
import type { EncryptedEnvelope } from "../../src/common/security/mfa-encryption.js";
import type { IdentityEmailPayload } from "../../src/modules/identity/identity.types.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "atomic workforce role dependencies",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      owner: Awaited<ReturnType<typeof f.session>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
    }, 30000);
    afterAll(() => prisma.$disconnect());
    async function target() {
      const t = await f.account("CUSTOMER_SERVICE", "ADMIN");
      await prisma.workforceAccess.update({
        where: { userId: t.user.id },
        data: {
          delegatedTemplates: ["CUSTOMER_SERVICE", "ADMIN_INVITE"],
          delegatedBranchIds: [f.home.id],
          version: 3,
        },
      });
      return t;
    }
    async function input(t: Awaited<ReturnType<typeof target>>) {
      const r = await request(app)
        .get(`/api/v1/admin/staff/${t.user.id}`)
        .set(owner.headers);
      expect(r.status).toBe(200);
      const u = r.body.data;
      return {
        role: "STAFF",
        branchId: f.home.id,
        expectedRevision: [
          u.updatedAt,
          u.role,
          u.status,
          u.staffProfile.updatedAt,
          u.staffProfile.branchId,
        ].join(":"),
        expectedWorkforceVersion: 3,
        reason:
          "Reviewed demotion and dependent delegation removal.\nRetain separately authorised scoped duties.",
      };
    }
    const change = (
      t: Awaited<ReturnType<typeof target>>,
      body: unknown,
      actor = owner,
    ) =>
      request(app)
        .patch(`/api/v1/admin/staff/${t.user.id}/role`)
        .set(actor.headers)
        .send(body);
    it("removes delegation atomically while retaining independently valid operational grants, financial grants and attributable history", async () => {
      const t = await target(),
        body = await input(t);
      const assignments = await prisma.workforceAssignment.findMany({
        where: { userId: t.user.id },
      });
      const capability = await prisma.userCapability.create({
        data: {
          userId: t.user.id,
          capability: "REFUND_APPROVE",
          grantedByUserId: f.owner.id,
        },
      });
      const r = await change(t, body);
      expect(r.status).toBe(200);
      expect(r.body.data.role).toBe("STAFF");
      const a = await prisma.workforceAccess.findUniqueOrThrow({
        where: { userId: t.user.id },
      });
      expect(a).toMatchObject({
        position: "CUSTOMER_SERVICE",
        version: 4,
        delegatedTemplates: [],
        delegatedBranchIds: [],
        updatedByUserId: f.owner.id,
      });
      expect(
        await prisma.workforceAssignment.findMany({ where: { userId: t.user.id } }),
      ).toEqual(assignments);
      expect(
        (await prisma.userCapability.findUniqueOrThrow({ where: { id: capability.id } }))
          .revokedAt,
      ).toBeNull();
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: t.record.id } }))
          .revokedAt,
      ).not.toBeNull();
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: t.user.id, action: "ROLE_CHANGE" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit.userId).toBe(f.owner.id);
      expect(audit.newValues).toMatchObject({
        reason: body.reason,
        removedDelegationTemplates: "CUSTOMER_SERVICE,ADMIN_INVITE",
        removedDelegationBranchIds: f.home.id,
        workforceVersion: 4,
        operationalAssignments: "RETAINED_WITH_EXISTING_SCOPE",
      });
      const signedIn = await f.session(t.user.id, "STAFF");
      const access = await request(app)
        .get("/api/v1/staff/workforce/access")
        .set(signedIn.headers);
      expect(access.body.data).toMatchObject({
        canManageAssignments: false,
        canInviteAdmins: false,
      });
      expect(access.body.data.permissions).toContain("CUSTOMER_ENQUIRIES");
      expect(
        (await request(app).get("/api/v1/admin/workforce/accounts").set(signedIn.headers))
          .status,
      ).toBe(403);
    });
    it("rejects a stale workforce review even when the account revision has not changed", async () => {
      const t = await target(),
        body = await input(t);
      await prisma.workforceAccess.update({
        where: { userId: t.user.id },
        data: { version: { increment: 1 } },
      });
      expect((await change(t, body)).status).toBe(409);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: t.user.id } })).role,
      ).toBe("ADMIN");
      expect(
        (await prisma.workforceAccess.findUniqueOrThrow({ where: { userId: t.user.id } }))
          .delegatedTemplates,
      ).toContain("ADMIN_INVITE");
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: t.record.id } }))
          .revokedAt,
      ).toBeNull();
      expect(
        await prisma.auditLog.count({
          where: { entityId: t.user.id, action: "ROLE_CHANGE" },
        }),
      ).toBe(0);
    });
    it("requires the current workforce version and a reason for an enrolled account", async () => {
      const t = await target(),
        body = await input(t);
      const { expectedWorkforceVersion: _version, ...missingVersion } = body;
      const { reason: _reason, ...missingReason } = body;
      expect((await change(t, missingVersion)).status).toBe(409);
      expect((await change(t, missingReason)).status).toBe(422);
      expect((await change(t, { ...body, reason: "short" })).status).toBe(422);
      expect(
        (await change(t, { ...body, reason: "Invalid\u0000control character" })).status,
      ).toBe(422);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: t.user.id } })).role,
      ).toBe("ADMIN");
    });
    it("commits one of two concurrent reviewed changes and rejects the second without partially changing grants", async () => {
      const t = await target(),
        body = await input(t);
      const results = await Promise.all([change(t, body), change(t, body)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.auditLog.count({
          where: { entityId: t.user.id, action: "ROLE_CHANGE" },
        }),
      ).toBe(1);
      expect(
        (await prisma.workforceAccess.findUniqueOrThrow({ where: { userId: t.user.id } }))
          .version,
      ).toBe(4);
    });
    it("preserves owner-only demotion, self-change and protected-owner restrictions", async () => {
      const t = await target(),
        body = await input(t);
      expect((await change(t, body, f.scopedAdmin)).status).toBe(403);
      expect((await change(t, body, t)).status).toBe(403);
      expect(
        (
          await request(app)
            .patch(`/api/v1/admin/staff/${f.owner.id}/role`)
            .set(owner.headers)
            .send(body)
        ).status,
      ).toBe(403);
    });
    it("an accepted secure invitation cannot resurrect a former administrator's dormant delegation", async () => {
      const t = await f.account("CUSTOMER_SERVICE", "STAFF");
      await prisma.workforceAccess.update({
        where: { userId: t.user.id },
        data: {
          delegatedTemplates: ["CUSTOMER_SERVICE", "ADMIN_INVITE"],
          delegatedBranchIds: [f.home.id],
        },
      });
      const invited = await request(app)
        .post("/api/v1/admin/staff/invitations")
        .set(owner.headers)
        .send({ email: t.user.email, role: "ADMIN", currentPassword: fixturePassword });
      expect(invited.status).toBe(202);
      const outbox = await prisma.outboxEvent.findFirstOrThrow({
        where: { aggregateId: invited.body.data.invitation.id },
      });
      const payload = decryptIdentityPayload<IdentityEmailPayload>(
        (outbox.payload as unknown as { encrypted: EncryptedEnvelope }).encrypted,
      );
      const token = new URLSearchParams(new URL(payload.link).hash.slice(1)).get("token");
      const accepted = await request(app)
        .post("/api/v1/auth/staff/invitations/accept")
        .set(t.headers)
        .send({ token, currentPassword: fixturePassword });
      expect(accepted.status).toBe(200);
      const a = await prisma.workforceAccess.findUniqueOrThrow({
        where: { userId: t.user.id },
      });
      expect(a).toMatchObject({
        delegatedTemplates: [],
        delegatedBranchIds: [],
        version: 1,
        position: "CUSTOMER_SERVICE",
      });
      expect(
        await prisma.workforceAssignment.count({
          where: { userId: t.user.id, revokedAt: null },
        }),
      ).toBe(1);
    });
  },
);
