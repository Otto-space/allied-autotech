import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { verifyPassword } from "../../src/common/security/passwords.js";
import { prisma } from "../../src/config/database.js";
import { decryptIdentityPayload } from "../../src/common/security/mfa-encryption.js";
import type { EncryptedEnvelope } from "../../src/common/security/mfa-encryption.js";
import type { IdentityEmailPayload } from "../../src/modules/identity/identity.types.js";
import { fixturePassword, workforceFixture } from "../fixtures/workforce.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "responsibility workspace through authenticated HTTP",
  () => {
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    beforeAll(async () => {
      f = await workforceFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());
    const read = (identity: { headers: Record<string, string> }, path: string) =>
      request(app).get(`/api/v1${path}`).set(identity.headers);
    const mutate = (
      identity: { headers: Record<string, string> },
      method: "post" | "patch" | "put",
      path: string,
      body: unknown,
    ) => request(app)[method](`/api/v1${path}`).set(identity.headers).send(body);
    it("combines current operations and independent covers without granting finance or access administration", async () => {
      const access = await read(f.operations, "/staff/workforce/access");
      expect(access.status).toBe(200);
      expect(access.body.data.permissions).toEqual(
        expect.arrayContaining([
          "BOOKINGS_READ",
          "SALES_ENQUIRIES",
          "CUSTOMER_ENQUIRIES",
          "COMPLAINTS",
          "ORDERS_PREPARE",
        ]),
      );
      expect(access.body.data.permissions).not.toContain("FINANCE_READ");
      expect(access.body.data.canManageAssignments).toBe(false);
      const overview = await read(f.operations, "/staff/workforce/overview");
      expect(overview.status).toBe(200);
      expect(overview.body.data.counts).toMatchObject({
        bookings: 2,
        enquiries: 2,
        complaints: 0,
        orders: 0,
      });
      expect(overview.body.data.counts).not.toHaveProperty("jobs");
      expect(overview.body.data.counts).not.toHaveProperty("payments");
      expect((await read(f.operations, "/staff/workforce/finance")).status).toBe(403);
      expect((await read(f.operations, "/staff/payments")).status).toBe(403);
      expect((await read(f.operations, "/staff/bookings")).status).toBe(403);
    });
    it("removes expired/revoked sources on the next request and preserves overlaps", async () => {
      const overlap = await f.assignment(f.operations.user.id, "CUSTOMER_SERVICE", true);
      await prisma.workforceAssignment.update({
        where: { id: f.careCover.id },
        data: {
          revokedAt: new Date(),
          revokedByUserId: f.owner.id,
          revocationReason: "Synthetic independent cover removal",
        },
      });
      expect((await read(f.operations, "/staff/workforce/complaints")).status).toBe(200);
      await prisma.workforceAssignment.update({
        where: { id: overlap.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      expect((await read(f.operations, "/staff/workforce/complaints")).status).toBe(403);
      expect(
        (await read(f.operations, "/staff/workforce/enquiries")).body.data.items.map(
          (r: { id: string }) => r.id,
        ),
      ).toEqual([f.enquiry.id]);
      await prisma.workforceAssignment.update({
        where: { id: f.salesCover.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      expect((await read(f.operations, "/staff/workforce/enquiries")).status).toBe(403);
      expect((await read(f.operations, "/staff/workforce/bookings")).status).toBe(200);
    });
    it("scopes technician lists, counts, details, fields and writes; denies legacy evidence/export paths", async () => {
      const own = await read(f.mechanical1, "/staff/workforce/jobs");
      expect(
        (await read(f.mechanical1, `/staff/workforce/jobs/${f.job1.id}/assignees`))
          .status,
      ).toBe(403);
      const options = await read(f.lead, `/staff/workforce/jobs/${f.job1.id}/assignees`);
      expect(options.status).toBe(200);
      expect(options.body.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: f.mechanical1.user.staffProfile!.id }),
        ]),
      );
      expect(options.body.data.items[0]).not.toHaveProperty("email");
      expect(options.body.data.items[0]).not.toHaveProperty("phone");
      expect(
        (await read(f.lead, `/staff/workforce/jobs/${f.foreignJob.id}/assignees`)).status,
      ).toBe(404);
      expect(own.status).toBe(200);
      expect(own.body.data.items.map((r: { id: string }) => r.id)).toEqual([f.job1.id]);
      const job = own.body.data.items[0];
      expect(job).not.toHaveProperty("customer");
      expect(job).not.toHaveProperty("customerId");
      expect(job).not.toHaveProperty("staffNotes");
      expect(JSON.stringify(job)).not.toContain(f.customer.user.email);
      expect(
        (await read(f.mechanical1, "/staff/workforce/overview")).body.data.counts,
      ).toEqual({ jobs: 1 });
      expect(
        (await read(f.mechanical1, `/staff/workforce/jobs/${f.job2.id}`)).status,
      ).toBe(404);
      expect(
        (await read(f.mechanical1, `/staff/workforce/jobs/${f.foreignJob.id}`)).status,
      ).toBe(404);
      expect(
        (
          await mutate(
            f.mechanical1,
            "patch",
            `/staff/workforce/jobs/${f.job2.id}/work`,
            { expectedVersion: 0, diagnosis: "Synthetic intrusion" },
          )
        ).status,
      ).toBe(404);
      for (const path of [
        `/staff/bookings/${f.job2.id}`,
        `/staff/bookings/${f.job1.id}`,
        "/staff/workforce/jobs?branchId=untrusted",
        "/staff/notifications/export",
        "/admin/customers",
        "/staff/workforce/jobs/export",
      ])
        expect([403, 404, 422]).toContain((await read(f.mechanical1, path)).status);
      // Managed staff now retain their own notification inbox; export and other
      // legacy operational paths remain forbidden by the workforce boundary.
      const notifications = await read(f.mechanical1, "/staff/notifications");
      expect(notifications.status).toBe(200);
      expect(notifications.body.data.items).toEqual([]);
      expect(
        (
          await mutate(
            f.mechanical1,
            "patch",
            `/staff/workforce/jobs/${f.job1.id}/assignment`,
            {
              expectedVersion: 0,
              staffId: f.mechanical2.user.staffProfile!.id,
              reason: "Synthetic unauthorized assignment",
            },
          )
        ).status,
      ).toBe(403);
    });
    it("separates technical progress from independent approval, including combined responsibilities", async () => {
      const path = `/staff/workforce/jobs/${f.job1.id}`;
      const start = await mutate(f.mechanical1, "patch", `${path}/work`, {
        expectedVersion: 0,
        status: "IN_PROGRESS",
        diagnosis: "Synthetic diagnosis",
      });
      expect(start.status).toBe(200);
      expect(
        (
          await mutate(f.mechanical1, "patch", `${path}/work`, {
            expectedVersion: 0,
            status: "QUALITY_CHECK",
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await mutate(f.mechanical1, "patch", `${path}/work`, {
            expectedVersion: 1,
            status: "QUALITY_CHECK",
          })
        ).status,
      ).toBe(200);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: f.job1.id } })).status,
      ).toBe("IN_PROGRESS");
      expect(
        (
          await mutate(f.mechanical1, "post", `${path}/quality`, {
            expectedVersion: 2,
            reason: "Synthetic self review denied",
          })
        ).status,
      ).toBe(403);
      const combined = await f.assignment(f.mechanical1.user.id, "WORKSHOP_LEAD");
      expect(
        (
          await mutate(f.mechanical1, "post", `${path}/quality`, {
            expectedVersion: 2,
            reason: "Synthetic combined self review denied",
          })
        ).status,
      ).toBe(403);
      await prisma.workforceAssignment.update({
        where: { id: combined.id },
        data: { revokedAt: new Date() },
      });
      expect(
        (
          await mutate(f.lead, "post", `${path}/quality`, {
            expectedVersion: 2,
            reason: "Independent synthetic review passed",
          })
        ).status,
      ).toBe(200);
      expect((await read(f.mechanical1, path)).body.data.workOrder).toMatchObject({
        status: "COMPLETED",
        qualityApprovedByUserId: f.lead.user.id,
      });
      expect(
        (
          await mutate(f.lead, "post", `${path}/quality`, {
            expectedVersion: 2,
            reason: "Duplicate synthetic review denied",
          })
        ).status,
      ).toBe(409);
    });
    it("revokes former technician access immediately when the lead reassigns a job", async () => {
      const changed = await mutate(
        f.lead,
        "patch",
        `/staff/workforce/jobs/${f.job2.id}/assignment`,
        {
          expectedVersion: 0,
          staffId: f.mechanical1.user.staffProfile!.id,
          reason: "Synthetic workshop reassignment",
        },
      );
      expect(changed.status).toBe(200);
      expect(
        (await read(f.mechanical2, `/staff/workforce/jobs/${f.job2.id}`)).status,
      ).toBe(404);
      expect(
        (await read(f.mechanical1, `/staff/workforce/jobs/${f.job2.id}`)).status,
      ).toBe(200);
      expect(
        (await read(f.mechanical2, "/staff/workforce/overview")).body.data.counts.jobs,
      ).toBe(0);
    });
    it("keeps cashier and accountant authority narrow and rejects mass assignment of payment/financial fields", async () => {
      expect(
        (await read(f.cashier, "/staff/workforce/enquiries")).body.data.items.map(
          (r: { id: string }) => r.id,
        ),
      ).toEqual([f.enquiry.id]);
      expect((await read(f.cashier, "/staff/workforce/orders")).status).toBe(403);
      expect((await read(f.accountant, "/staff/workforce/finance")).status).toBe(200);
      expect((await read(f.accountant, "/admin/staff")).status).toBe(403);
      for (const person of [f.cashier, f.accountant]) {
        expect(
          (await mutate(person, "post", "/staff/refunds/not-a-refund/approve", {}))
            .status,
        ).toBe(403);
        expect(
          (await mutate(person, "post", "/staff/payments", { status: "SUCCEEDED" }))
            .status,
        ).toBe(403);
      }
      expect(
        (
          await mutate(
            f.mechanical1,
            "patch",
            `/staff/workforce/jobs/${f.job2.id}/work`,
            { expectedVersion: 0, diagnosis: "Test", amountKobo: 1, status: "COMPLETED" },
          )
        ).status,
      ).toBe(422);
      expect(
        (
          await mutate(
            f.sales,
            "post",
            `/staff/workforce/enquiries/${f.enquiry.id}/replies`,
            { expectedVersion: 0, body: "Synthetic permitted reply" },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await mutate(
            f.sales,
            "post",
            `/staff/workforce/enquiries/${f.enquiry.id}/replies`,
            { expectedVersion: 0, body: "Synthetic duplicate reply" },
          )
        ).status,
      ).toBe(409);
      expect(
        await prisma.supportMessage.count({ where: { enquiryId: f.enquiry.id } }),
      ).toBe(1);
    });
    it("enforces delegation, self-protection, Super Admin protection, MFA, password and access versions", async () => {
      const body = {
        template: "CUSTOMER_SERVICE",
        branchId: f.home.id,
        temporary: true,
        startsAt: new Date().toISOString(),
        expiresAt: null,
        reason: "Synthetic delegated cover assignment",
        expectedVersion: 0,
        currentPassword: fixturePassword,
      };
      const path = `/admin/workforce/accounts/${f.mechanical2.user.id}/assignments`;
      expect(
        (
          await mutate(f.scopedAdmin, "post", path, {
            ...body,
            currentPassword: "incorrect",
          })
        ).status,
      ).toBe(403);
      expect(
        (await mutate(f.scopedAdmin, "post", path, { ...body, template: "ACCOUNTANT" }))
          .status,
      ).toBe(403);
      expect(
        (await mutate(f.scopedAdmin, "post", path, { ...body, branchId: f.other.id }))
          .status,
      ).toBe(403);
      const success = await mutate(f.scopedAdmin, "post", path, body);
      expect(success.status).toBe(200);
      expect((await mutate(f.scopedAdmin, "post", path, body)).status).toBe(409);
      expect(
        (
          await mutate(
            f.scopedAdmin,
            "post",
            `/admin/workforce/accounts/${f.scopedAdmin.user.id}/assignments`,
            body,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await mutate(
            f.scopedAdmin,
            "post",
            `/admin/workforce/accounts/${f.owner.id}/assignments`,
            body,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await mutate(
            f.scopedAdmin,
            "put",
            `/admin/workforce/accounts/${f.mechanical2.user.id}/delegation`,
            {
              expectedVersion: 1,
              currentPassword: fixturePassword,
              reason: body.reason,
              templates: ["ACCOUNTANT"],
              branchIds: [f.home.id],
            },
          )
        ).status,
      ).toBe(403);
      const unassured = await f.session(f.scopedAdmin.user.id, "ADMIN", false);
      expect(
        (await mutate(unassured, "post", path, { ...body, expectedVersion: 1 })).status,
      ).toBe(403);
      const revoke = await mutate(
        f.scopedAdmin,
        "post",
        `${path}/${success.body.data.id}/revoke`,
        {
          expectedVersion: 1,
          currentPassword: fixturePassword,
          reason: "Synthetic delegated independent revocation",
        },
      );
      expect(revoke.status).toBe(200);
      expect((await read(f.mechanical2, "/staff/workforce/complaints")).status).toBe(403);
      expect(
        await prisma.auditLog.count({
          where: { entityId: f.mechanical2.user.id, userId: f.scopedAdmin.user.id },
        }),
      ).toBeGreaterThanOrEqual(2);
    });
    it("preserves secure admin acceptance while rechecking owner delegation and recipient identity", async () => {
      const input = {
        email: f.care.user.email,
        role: "ADMIN",
        currentPassword: fixturePassword,
      };
      expect(
        (await mutate(f.operations, "post", "/admin/workforce/invitations", input))
          .status,
      ).toBe(403);
      const invitation = await mutate(
        f.scopedAdmin,
        "post",
        "/admin/workforce/invitations",
        input,
      );
      expect(invitation.status).toBe(200);
      const outbox = await prisma.outboxEvent.findFirstOrThrow({
        where: { aggregateId: invitation.body.data.invitation.id },
      });
      const payload = decryptIdentityPayload<IdentityEmailPayload>(
        (outbox.payload as unknown as { encrypted: EncryptedEnvelope }).encrypted,
      );
      const token = new URLSearchParams(new URL(payload.link!).hash.slice(1)).get(
        "token",
      )!;
      const accept = (identity: { headers: Record<string, string> }) =>
        mutate(identity, "post", "/auth/staff/invitations/accept", {
          token,
          currentPassword: fixturePassword,
        });
      expect((await accept(f.sales)).status).toBe(400);
      await prisma.workforceAccess.update({
        where: { userId: f.scopedAdmin.user.id },
        data: { delegatedTemplates: ["CUSTOMER_SERVICE"] },
      });
      expect((await accept(f.care)).status).toBe(403);
      await prisma.workforceAccess.update({
        where: { userId: f.scopedAdmin.user.id },
        data: { delegatedTemplates: ["CUSTOMER_SERVICE", "ADMIN_INVITE"] },
      });
      expect((await accept(f.care)).status).toBe(200);
      expect((await accept(f.care)).status).toBe(401);
      const next = await f.session(f.care.user.id, "ADMIN");
      expect((await read(next, "/staff/workforce/access")).body.data.managed).toBe(true);
      expect((await read(next, "/staff/payments")).status).toBe(403);
    });
    it("preserves customer ownership and suspends current sessions on the next request", async () => {
      expect((await read(f.customer, "/staff/workforce/jobs")).status).toBe(403);
      expect((await read(f.customer, `/customers/bookings/${f.job1.id}`)).status).toBe(
        200,
      );
      expect((await read(f.stranger, `/customers/bookings/${f.job1.id}`)).status).toBe(
        404,
      );
      await prisma.user.update({
        where: { id: f.electrical.user.id },
        data: { status: "SUSPENDED" },
      });
      expect((await read(f.electrical, "/staff/workforce/access")).status).toBe(401);
      expect(
        (await read(f.mechanical1, "/auth/session")).body.data.workforceManaged,
      ).toBe(true);
      expect((await read(f.customer, "/auth/session")).body.data.workforceManaged).toBe(
        false,
      );
    });
    it("keeps combined responsibilities scoped to the branch granting each permission", async () => {
      const combined = await f.account("SALES_CASHIER");
      await f.assignment(combined.user.id, "SALES_SUPERVISOR", true, f.other.id);
      const row = await prisma.enquiry.create({
        data: {
          branchId: f.home.id,
          type: "PRODUCT",
          productId: f.enquiry.productId,
          subject: "Synthetic unassigned sales task",
          message: "Synthetic question",
          name: "Synthetic",
          email: "synthetic@example.test",
        },
      });
      const visible = await read(combined, "/staff/workforce/enquiries");
      expect(visible.status).toBe(200);
      expect(visible.body.data.items).toEqual([]);
      expect(
        (
          await mutate(combined, "post", `/staff/workforce/enquiries/${row.id}/replies`, {
            expectedVersion: 0,
            body: "Synthetic attempted cross-scope reply",
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await mutate(
            combined,
            "patch",
            `/staff/workforce/enquiries/${row.id}/assignment`,
            {
              expectedVersion: 0,
              staffId: combined.user.staffProfile!.id,
              reason: "Synthetic attempted cross-scope allocation",
            },
          )
        ).status,
      ).toBe(404);
    });
    it("rejects future/invalid scopes and serializes conflicting access changes", async () => {
      const person = await f.account("OPERATIONS");
      await prisma.workforceAssignment.updateMany({
        where: { userId: person.user.id },
        data: { startsAt: new Date(Date.now() + 3_600_000) },
      });
      expect((await read(person, "/staff/workforce/bookings")).status).toBe(403);
      const invalid = await f.assignment(person.user.id, "WORKSHOP_LEAD");
      await prisma.workforceAssignment.update({
        where: { id: invalid.id },
        data: { scope: "INVALID" },
      });
      expect((await read(person, "/staff/workforce/jobs")).status).toBe(403);
      const path = `/admin/workforce/accounts/${person.user.id}/assignments`;
      const input = {
        template: "CUSTOMER_SERVICE",
        branchId: f.home.id,
        temporary: true,
        startsAt: new Date().toISOString(),
        expiresAt: null,
        reason: "Synthetic concurrent access change",
        expectedVersion: 0,
        currentPassword: fixturePassword,
      };
      const results = await Promise.all([
        mutate(f.scopedAdmin, "post", path, input),
        mutate(f.scopedAdmin, "post", path, input),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await read(person, "/staff/workforce/complaints")).status).toBe(200);
      expect(
        (
          await mutate(f.scopedAdmin, "post", path, {
            ...input,
            expectedVersion: 1,
            expiresAt: "2000-01-01T00:00:00Z",
          })
        ).status,
      ).toBe(422);
    });
    it("requires an explicit owner review to replace legacy access and does not infer duties from position", async (testContext) => {
      // Other integration fixtures may have created the one protected synthetic
      // owner using an unusable password. Never rewrite that owner to force a test.
      if (!(await verifyPassword(f.owner.passwordHash, fixturePassword)))
        testContext.skip();
      const owner = await f.session(f.owner.id, "SUPER_ADMIN");
      const target = await f.account(null);
      await prisma.booking.update({
        where: { id: f.job2.id },
        data: {
          assignedStaffId: target.user.staffProfile!.id,
          version: { increment: 1 },
        },
      });
      const legacyUpdate = await mutate(
        target,
        "put",
        `/staff/bookings/${f.job2.id}/work-orders/${f.job2.workOrder!.id}`,
        { expectedVersion: 0, diagnosis: "Synthetic work performed before enrollment" },
      );
      expect(legacyUpdate.status).toBe(200);
      expect(legacyUpdate.body.data).not.toHaveProperty("workedByUserIds");
      expect(
        (
          await prisma.workOrder.findUniqueOrThrow({
            where: { id: f.job2.workOrder!.id },
          })
        ).workedByUserIds,
      ).toContain(target.user.id);
      const path = `/admin/workforce/accounts/${target.user.id}`;
      const body = {
        position: "MECHANICAL_TECHNICIAN",
        expectedVersion: null,
        currentPassword: fixturePassword,
        reason: "Synthetic reviewed legacy access cutover",
      };
      expect((await mutate(f.scopedAdmin, "put", path, body)).status).toBe(403);
      const enrolled = await mutate(owner, "put", path, body);
      expect(enrolled.status).toBe(200);
      expect((await read(target, "/auth/session")).status).toBe(401);
      expect((await mutate(owner, "put", path, body)).status).toBe(409);
      const next = await f.session(target.user.id, "STAFF");
      const access = await read(next, "/staff/workforce/access");
      expect(access.body.data).toMatchObject({
        managed: true,
        position: "MECHANICAL_TECHNICIAN",
        permissions: [],
        assignments: [],
      });
      expect((await read(next, "/staff/bookings")).status).toBe(403);
      expect(
        (
          await mutate(owner, "post", `${path}/assignments`, {
            template: "MECHANICAL_TECHNICIAN",
            branchId: f.home.id,
            temporary: false,
            startsAt: new Date().toISOString(),
            expiresAt: null,
            reason: "Synthetic reviewed technician responsibility",
            expectedVersion: 0,
            currentPassword: fixturePassword,
          })
        ).status,
      ).toBe(200);
      expect((await read(next, "/staff/workforce/access")).body.data.permissions).toEqual(
        ["JOBS_READ", "JOBS_UPDATE"],
      );
      expect(
        (
          await mutate(
            owner,
            "put",
            `/admin/workforce/accounts/${f.scopedAdmin.user.id}/delegation`,
            {
              expectedVersion: 0,
              currentPassword: fixturePassword,
              reason: "Synthetic reviewed delegation change",
              templates: ["WORKSHOP_LEAD"],
              branchIds: [f.other.id],
              allowAdminInvitations: false,
            },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await prisma.workforceAccess.findUniqueOrThrow({
            where: { userId: f.scopedAdmin.user.id },
          })
        ).delegatedTemplates,
      ).toEqual(["WORKSHOP_LEAD"]);
    });
  },
);
