import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { fixturePassword, workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { notifySupportTeam } from "../../src/modules/notifications/team-notifications.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "reviewed workforce template versions",
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
    it("runs with a separate runtime identity that cannot own, change schema, truncate or write the migration ledger", async () => {
      const rows = await prisma.$queryRaw<
        {
          superuser: boolean;
          createdb: boolean;
          createrole: boolean;
          dbowner: boolean;
          table_owner: boolean;
          schema_create: boolean;
          can_truncate: boolean;
          can_write_ledger: boolean;
        }[]
      >`SELECT r.rolsuper AS superuser, r.rolcreatedb AS createdb, r.rolcreaterole AS createrole, d.datdba=r.oid AS dbowner, c.relowner=r.oid AS table_owner, has_schema_privilege(current_user,'public','CREATE') AS schema_create, has_table_privilege(current_user,'"WorkforceAssignment"','TRUNCATE') AS can_truncate, has_table_privilege(current_user,'_prisma_migrations','INSERT,UPDATE,DELETE') AS can_write_ledger FROM pg_roles r JOIN pg_database d ON d.datname=current_database() JOIN pg_class c ON c.oid='"WorkforceAssignment"'::regclass WHERE r.rolname=current_user`;
      expect(rows).toEqual([
        {
          superuser: false,
          createdb: false,
          createrole: false,
          dbowner: false,
          table_owner: false,
          schema_create: false,
          can_truncate: false,
          can_write_ledger: false,
        },
      ]);
    });
    const read = (actor: { headers: Record<string, string> }, path: string) =>
      request(app).get(`/api/v1${path}`).set(actor.headers);
    const assign = (
      actor: { headers: Record<string, string> },
      userId: string,
      body: unknown,
    ) =>
      request(app)
        .post(`/api/v1/admin/workforce/accounts/${userId}/assignments`)
        .set(actor.headers)
        .send(body);
    function body(version = 0) {
      return {
        template: "CUSTOMER_SERVICE",
        receiptVersion: 2,
        branchId: f.home.id,
        temporary: true,
        startsAt: new Date(Date.now() - 1000).toISOString(),
        expiresAt: null,
        reason: "Reviewed isolated responsibility coverage",
        currentPassword: fixturePassword,
        expectedVersion: version,
        expectedTemplateVersion: 1,
      };
    }
    it("pins defaults and projects the same existing fitment authority as named capabilities", async () => {
      const operations = await read(f.operations, "/staff/workforce/access"),
        lead = await read(f.lead, "/staff/workforce/access"),
        technician = await read(f.mechanical1, "/staff/workforce/access");
      expect(operations.status).toBe(200);
      expect(operations.body.data.permissions).toContain("FITMENT_AUTHOR");
      expect(
        operations.body.data.assignments.every(
          (a: { templateVersion: number }) => a.templateVersion === 1,
        ),
      ).toBe(true);
      expect(lead.body.data.permissions).toContain("FITMENT_REVIEW");
      expect(technician.body.data.permissions).not.toContain("FITMENT_AUTHOR");
      expect((await read(f.operations, "/staff/fitment/products")).status).toBe(200);
      expect((await read(f.mechanical1, "/staff/fitment/products")).status).toBe(403);
    });
    it("does not interpret an unknown version using today's expanded template or expose it as active", async () => {
      const target = await f.account("MECHANICAL_TECHNICIAN");
      const future = await f.assignment(target.user.id, "OPERATIONS", true, f.other.id);
      await prisma.workforceAssignment.update({
        where: { id: future.id },
        data: { templateVersion: 99 },
      });
      const own = await read(target, "/staff/workforce/access");
      expect(own.body.data.permissions).toEqual(["JOBS_READ", "JOBS_UPDATE"]);
      expect(
        own.body.data.assignments.some((a: { id: string }) => a.id === future.id),
      ).toBe(false);
      expect((await read(target, "/staff/fitment/products")).status).toBe(403);
      const inspect = await read(owner, `/admin/workforce/accounts/${target.user.id}`);
      expect(inspect.status).toBe(200);
      expect(inspect.body.data.assignmentDefinitions[future.id]).toBeNull();
      expect(inspect.body.data.activeAssignmentIds).not.toContain(future.id);
      expect(
        (await prisma.workforceAssignment.findUniqueOrThrow({ where: { id: future.id } }))
          .templateVersion,
      ).toBe(99);
    });
    it("requires the reviewed catalogue version for a new assignment and records the pinned definition", async () => {
      const target = await f.account("MECHANICAL_TECHNICIAN");
      expect(
        (await assign(owner, target.user.id, { ...body(), expectedTemplateVersion: 99 }))
          .status,
      ).toBe(409);
      expect(
        (
          await prisma.workforceAccess.findUniqueOrThrow({
            where: { userId: target.user.id },
          })
        ).version,
      ).toBe(0);
      const created = await assign(owner, target.user.id, body());
      expect(created.status).toBe(200);
      expect(created.body.data.templateVersion).toBe(1);
      const inspect = await read(owner, `/admin/workforce/accounts/${target.user.id}`);
      expect(inspect.body.data.templatesVersion).toBe(2);
      expect(
        inspect.body.data.assignmentDefinitions[created.body.data.id].actions,
      ).toContain("CUSTOMER_ENQUIRIES");
    });
    it("does not interpret an unknown delegation policy as current authority; the owner can still urgently revoke a grant", async () => {
      const target = await f.account("CUSTOMER_SERVICE");
      await prisma.workforceAccess.update({
        where: { userId: f.scopedAdmin.user.id },
        data: { delegationPolicyVersion: 99 },
      });
      const inspect = await read(
        f.scopedAdmin,
        `/admin/workforce/accounts/${target.user.id}`,
      );
      expect(inspect.status).toBe(403);
      const own = await read(f.scopedAdmin, "/staff/workforce/access");
      expect(own.body.data.canManageAssignments).toBe(false);
      expect(own.body.data.canInviteAdmins).toBe(false);
      expect((await assign(f.scopedAdmin, target.user.id, body())).status).toBe(403);
      const assignment = await prisma.workforceAssignment.findFirstOrThrow({
        where: { userId: target.user.id, revokedAt: null },
      });
      const command = {
        expectedVersion: 0,
        reason: "Urgent scoped revocation despite catalogue review gap",
        currentPassword: fixturePassword,
      };
      const path = `/api/v1/admin/workforce/accounts/${target.user.id}/assignments/${assignment.id}/revoke`;
      expect(
        (await request(app).post(path).set(f.scopedAdmin.headers).send(command)).status,
      ).toBe(403);
      const revoked = await request(app)
        .post(
          `/api/v1/admin/workforce/accounts/${target.user.id}/assignments/${assignment.id}/revoke`,
        )
        .set(owner.headers)
        .send(command);
      expect(revoked.status).toBe(200);
      await prisma.workforceAccess.update({
        where: { userId: f.scopedAdmin.user.id },
        data: { delegationPolicyVersion: 1 },
      });
    });
    it("rejects a copied target ID outside the delegated administrator's permitted account branch", async () => {
      const foreign = await f.account("CUSTOMER_SERVICE", "STAFF", f.other.id);
      expect(
        (await read(f.scopedAdmin, `/admin/workforce/accounts/${foreign.user.id}`))
          .status,
      ).toBe(403);
      expect((await assign(f.scopedAdmin, foreign.user.id, body())).status).toBe(403);
      expect(
        (
          await prisma.workforceAccess.findUniqueOrThrow({
            where: { userId: foreign.user.id },
          })
        ).version,
      ).toBe(0);
    });
    it("does not turn ambiguous historical delegation names into directory or account-management authority", async () => {
      const ambiguous = await f.account("OPERATIONS", "ADMIN");
      await prisma.workforceAccess.update({
        where: { userId: ambiguous.user.id },
        data: {
          delegatedTemplates: ["UNKNOWN_LEGACY_ROLE"],
          delegatedBranchIds: [f.home.id],
          delegationPolicyVersion: 1,
        },
      });
      const own = await read(ambiguous, "/staff/workforce/access");
      expect(own.body.data.canManageAssignments).toBe(false);
      expect(own.body.data.permissions).toContain("BOOKINGS_READ");
      expect((await read(ambiguous, "/admin/workforce/accounts")).status).toBe(403);
      expect(
        (await read(ambiguous, `/admin/workforce/accounts/${f.care.user.id}`)).status,
      ).toBe(403);
    });
    it("requires a reviewed version for owner delegation changes and enforces positive persisted versions", async () => {
      const r = await request(app)
        .put(`/api/v1/admin/workforce/accounts/${f.scopedAdmin.user.id}/delegation`)
        .set(owner.headers)
        .send({
          expectedVersion: 0,
          expectedPolicyVersion: 99,
          templates: ["CUSTOMER_SERVICE"],
          branchIds: [f.home.id],
          allowAdminInvitations: false,
          reason: "Reviewed isolated management catalogue",
          currentPassword: fixturePassword,
        });
      expect(r.status).toBe(409);
      await expect(
        prisma.workforceAccess.update({
          where: { userId: f.care.user.id },
          data: { delegationPolicyVersion: 0 },
        }),
      ).rejects.toThrow();
      const a = await prisma.workforceAssignment.findFirstOrThrow({
        where: { userId: f.care.user.id },
      });
      await expect(
        prisma.workforceAssignment.update({
          where: { id: a.id },
          data: { templateVersion: 0 },
        }),
      ).rejects.toThrow();
    });
    it("excludes unsupported-version technicians from assignee options and authoritative assignment", async () => {
      const target = await f.account("MECHANICAL_TECHNICIAN");
      await prisma.workforceAssignment.updateMany({
        where: { userId: target.user.id },
        data: { templateVersion: 99 },
      });
      const options = await read(f.lead, `/staff/workforce/jobs/${f.job1.id}/assignees`);
      expect(options.status).toBe(200);
      expect(
        options.body.data.items.some(
          (a: { id: string }) => a.id === target.user.staffProfile!.id,
        ),
      ).toBe(false);
      const assigned = await request(app)
        .patch(`/api/v1/staff/workforce/jobs/${f.job1.id}/assignment`)
        .set(f.lead.headers)
        .send({
          expectedVersion: 0,
          staffId: target.user.staffProfile!.id,
          reason: "Synthetic unsupported template rejection",
        });
      expect(assigned.status).toBe(403);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: f.job1.id } }))
          .assignedStaffId,
      ).toBe(f.mechanical1.user.staffProfile!.id);
    });
    it("does not enqueue team notifications from unsupported-version care grants", async () => {
      const target = await f.account("CUSTOMER_SERVICE");
      await prisma.workforceAssignment.updateMany({
        where: { userId: target.user.id },
        data: { templateVersion: 99 },
      });
      const event = `template-version:${randomUUID()}`;
      await prisma.$transaction((tx) =>
        notifySupportTeam(tx, {
          kind: "ENQUIRY",
          id: f.generalEnquiry.id,
          event,
          title: "Synthetic support eligibility check",
        }),
      );
      const notifications = await prisma.notification.findMany({
        where: { deduplicationKey: { startsWith: `team:${event}:` } },
        select: { userId: true },
      });
      expect(notifications.some((n) => n.userId === target.user.id)).toBe(false);
      expect(notifications.some((n) => n.userId === f.care.user.id)).toBe(true);
    });
    it("preserves all four legacy strict mutation receipts while persisting the versioned model", async () => {
      const legacyAccess = z
        .object({
          userId: z.uuid(),
          position: z.string(),
          enabledAt: z.iso.datetime(),
          updatedByUserId: z.uuid(),
          version: z.number().int(),
          delegatedTemplates: z.array(z.string()),
          delegatedBranchIds: z.array(z.uuid()),
        })
        .strict();
      const legacyAssignment = z
        .object({
          id: z.uuid(),
          userId: z.uuid(),
          template: z.string(),
          branchId: z.uuid(),
          scope: z.enum(["BRANCH", "ASSIGNED"]),
          temporary: z.boolean(),
          startsAt: z.iso.datetime(),
          expiresAt: z.iso.datetime().nullable(),
          reason: z.string(),
          assignedByUserId: z.uuid(),
          createdAt: z.iso.datetime(),
          revokedAt: z.iso.datetime().nullable(),
          revokedByUserId: z.uuid().nullable(),
          revocationReason: z.string().nullable(),
        })
        .strict();
      const target = await f.account(null);
      const enrolled = await request(app)
        .put(`/api/v1/admin/workforce/accounts/${target.user.id}`)
        .set(owner.headers)
        .send({
          position: "MECHANICAL_TECHNICIAN",
          expectedVersion: null,
          reason: "Legacy caller reviewed explicit enrollment",
          currentPassword: fixturePassword,
        });
      expect(enrolled.status).toBe(200);
      expect(() => legacyAccess.parse(enrolled.body.data)).not.toThrow();
      const {
        receiptVersion: _receipt,
        expectedTemplateVersion: _definition,
        ...legacyCommand
      } = body();
      const created = await assign(owner, target.user.id, legacyCommand);
      expect(created.status).toBe(200);
      expect(() => legacyAssignment.parse(created.body.data)).not.toThrow();
      expect(
        (
          await prisma.workforceAssignment.findUniqueOrThrow({
            where: { id: created.body.data.id },
          })
        ).templateVersion,
      ).toBe(1);
      const revoked = await request(app)
        .post(
          `/api/v1/admin/workforce/accounts/${target.user.id}/assignments/${created.body.data.id}/revoke`,
        )
        .set(owner.headers)
        .send({
          expectedVersion: 1,
          reason: "Legacy caller reviewed independent revocation",
          currentPassword: fixturePassword,
        });
      expect(revoked.status).toBe(200);
      expect(() => legacyAssignment.parse(revoked.body.data)).not.toThrow();
      const admin = await f.account("OPERATIONS", "ADMIN");
      const delegated = await request(app)
        .put(`/api/v1/admin/workforce/accounts/${admin.user.id}/delegation`)
        .set(owner.headers)
        .send({
          expectedVersion: 0,
          templates: ["CUSTOMER_SERVICE"],
          branchIds: [f.home.id],
          allowAdminInvitations: false,
          reason: "Legacy caller reviewed scoped delegation",
          currentPassword: fixturePassword,
        });
      expect(delegated.status).toBe(200);
      expect(() => legacyAccess.parse(delegated.body.data)).not.toThrow();
      expect(
        (
          await prisma.workforceAccess.findUniqueOrThrow({
            where: { userId: admin.user.id },
          })
        ).delegationPolicyVersion,
      ).toBe(1);
    });
  },
);
