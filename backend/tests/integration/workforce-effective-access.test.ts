import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { fixturePassword, workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "reviewed effective responsibility access",
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
    const read = (identity: { headers: Record<string, string> }, id: string) =>
      request(app).get(`/api/v1/admin/workforce/accounts/${id}`).set(identity.headers);
    const preview = (
      identity: { headers: Record<string, string> },
      id: string,
      body: unknown,
    ) =>
      request(app)
        .post(`/api/v1/admin/workforce/accounts/${id}/access-preview`)
        .set(identity.headers)
        .send(body);
    const revoke = (id: string, assignmentId: string, fingerprint: string) =>
      request(app)
        .post(`/api/v1/admin/workforce/accounts/${id}/assignments/${assignmentId}/revoke`)
        .set(owner.headers)
        .send({
          receiptVersion: 2,
          expectedVersion: 0,
          expectedAccessPreview: fingerprint,
          reason: "Reviewed isolated coverage change",
          currentPassword: fixturePassword,
        });
    const grant = (template: string, branchId: string) => ({
      operation: "assign",
      expectedVersion: 0,
      expectedTemplateVersion: 1,
      template,
      branchId,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: null,
    });
    it("explains branch and assigned-work overlap using the pinned server definitions", async () => {
      const target = await f.account("MECHANICAL_TECHNICIAN");
      const lead = await f.assignment(target.user.id, "WORKSHOP_LEAD");
      const response = await read(owner, target.user.id);
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toContain("no-store");
      const row = response.body.data.effectiveAccess.grants.find(
        (r: { capability: string }) => r.capability === "JOBS_READ",
      );
      expect(row).toMatchObject({ scope: "BRANCH", branch: { id: f.home.id } });
      expect(row.sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ assignmentId: lead.id, scope: "BRANCH" }),
          expect.objectContaining({ scope: "ASSIGNED" }),
        ]),
      );
      const change = await preview(owner, target.user.id, {
        operation: "revoke",
        expectedVersion: 0,
        assignmentId: lead.id,
      });
      expect(change.status).toBe(200);
      expect(change.body.data.removed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ capability: "JOBS_READ", scope: "BRANCH" }),
        ]),
      );
      expect(change.body.data.retained).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ capability: "JOBS_READ", scope: "ASSIGNED" }),
        ]),
      );
    });
    it("retains the remaining care source and applies a reviewed revocation without requiring target re-login", async () => {
      const target = await f.account("CUSTOMER_SERVICE");
      const first = await prisma.workforceAssignment.findFirstOrThrow({
        where: { userId: target.user.id },
      });
      const remaining = await f.assignment(target.user.id, "CUSTOMER_SERVICE", true);
      const response = await preview(owner, target.user.id, {
        operation: "revoke",
        expectedVersion: 0,
        assignmentId: first.id,
      });
      expect(response.status).toBe(200);
      expect(response.body.data.removed).toEqual([]);
      expect(
        response.body.data.retained.find(
          (r: { capability: string }) => r.capability === "CUSTOMER_ENQUIRIES",
        ).sources,
      ).toEqual([expect.objectContaining({ assignmentId: remaining.id })]);
      expect(
        (await revoke(target.user.id, first.id, response.body.data.fingerprint)).status,
      ).toBe(200);
      const stillSignedIn = await request(app)
        .get("/api/v1/staff/workforce/access")
        .set(target.headers);
      expect(stillSignedIn.status).toBe(200);
      expect(stillSignedIn.body.data.permissions).toContain("CUSTOMER_ENQUIRIES");
      expect(
        stillSignedIn.body.data.assignments.map((a: { id: string }) => a.id),
      ).toEqual([remaining.id]);
    });
    it("bounds delegated previews and redacts another responsibility supplying retained access", async () => {
      const target = await f.account("CUSTOMER_SERVICE");
      const care = await prisma.workforceAssignment.findFirstOrThrow({
        where: { userId: target.user.id },
      });
      const secret = await f.assignment(target.user.id, "OPERATIONS");
      const finance = await f.assignment(target.user.id, "ACCOUNTANT");
      const foreign = await f.assignment(
        target.user.id,
        "CUSTOMER_SERVICE",
        true,
        f.other.id,
      );
      const response = await preview(f.scopedAdmin, target.user.id, {
        operation: "revoke",
        expectedVersion: 0,
        assignmentId: care.id,
      });
      expect(response.status).toBe(200);
      expect(response.body.data.visibility).toBe("DELEGATED");
      expect(
        response.body.data.retained.find(
          (r: { capability: string }) => r.capability === "ORDERS_READ",
        ).sources,
      ).toEqual([
        {
          assignmentId: null,
          label: "Another active responsibility",
          scope: "BRANCH",
          kind: "OTHER",
        },
      ]);
      for (const hidden of [
        secret.id,
        finance.id,
        foreign.id,
        f.other.id,
        "Operations Supervisor",
        "Accountant",
        "FINANCE_READ",
      ])
        expect(JSON.stringify(response.body.data)).not.toContain(hidden);
      expect(response.body.data.removed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            capability: "CUSTOMER_ENQUIRIES",
            branch: expect.objectContaining({ id: f.home.id }),
          }),
        ]),
      );
    });
    it("does not reveal broader hidden scopes to an assigned-work-only delegator", async () => {
      const manager = await f.account("OPERATIONS", "ADMIN");
      await prisma.workforceAccess.update({
        where: { userId: manager.user.id },
        data: {
          delegatedTemplates: ["MECHANICAL_TECHNICIAN"],
          delegatedBranchIds: [f.home.id],
        },
      });
      const target = await f.account("MECHANICAL_TECHNICIAN");
      const technician = await prisma.workforceAssignment.findFirstOrThrow({
        where: { userId: target.user.id },
      });
      const privateLead = await f.assignment(target.user.id, "WORKSHOP_LEAD");
      const response = await preview(manager, target.user.id, {
        operation: "revoke",
        expectedVersion: 0,
        assignmentId: technician.id,
      });
      expect(response.status).toBe(200);
      expect(response.body.data.removed).toEqual([]);
      expect(response.body.data.retained).toHaveLength(2);
      expect(
        response.body.data.retained.every(
          (row: { scope: string; sources: { scope: string }[] }) =>
            row.scope === "ASSIGNED" &&
            row.sources.every((source) => source.scope === "ASSIGNED"),
        ),
      ).toBe(true);
      expect(JSON.stringify(response.body.data)).not.toContain(privateLead.id);
      expect(JSON.stringify(response.body.data)).not.toContain("QUALITY_APPROVE");
    });
    it("rejects foreign target/branch, protected target, invalid revision and missing CSRF without a partial change", async () => {
      const target = await f.account("MECHANICAL_TECHNICIAN");
      const foreign = await f.account("CUSTOMER_SERVICE", "STAFF", f.other.id);
      const unassuredOwner = await f.session(f.owner.id, "SUPER_ADMIN", false);
      expect(
        (
          await preview(
            unassuredOwner,
            target.user.id,
            grant("CUSTOMER_SERVICE", f.home.id),
          )
        ).status,
      ).toBe(403);
      expect(
        (await preview(f.customer, target.user.id, grant("CUSTOMER_SERVICE", f.home.id)))
          .status,
      ).toBe(403);
      expect(
        (
          await preview(
            f.mechanical1,
            target.user.id,
            grant("CUSTOMER_SERVICE", f.home.id),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await preview(owner, target.user.id, {
            ...grant("CUSTOMER_SERVICE", f.home.id),
            scope: "COMPANY",
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await preview(
            f.scopedAdmin,
            foreign.user.id,
            grant("CUSTOMER_SERVICE", f.home.id),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await preview(
            f.scopedAdmin,
            target.user.id,
            grant("CUSTOMER_SERVICE", f.other.id),
          )
        ).status,
      ).toBe(403);
      expect(
        (await preview(owner, f.owner.id, grant("CUSTOMER_SERVICE", f.home.id))).status,
      ).toBe(403);
      expect(
        (
          await preview(owner, target.user.id, {
            ...grant("CUSTOMER_SERVICE", f.home.id),
            expectedVersion: 99,
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await preview(owner, target.user.id, {
            ...grant("CUSTOMER_SERVICE", f.home.id),
            expectedTemplateVersion: 99,
          })
        ).status,
      ).toBe(409);
      const { "X-CSRF-Token": _csrf, ...headers } = owner.headers;
      void _csrf;
      expect(
        (
          await request(app)
            .post(`/api/v1/admin/workforce/accounts/${target.user.id}/access-preview`)
            .set(headers)
            .send(grant("CUSTOMER_SERVICE", f.home.id))
        ).status,
      ).toBe(403);
      expect(
        await prisma.workforceAssignment.count({ where: { userId: target.user.id } }),
      ).toBe(1);
    });
    it("rejects a changed effective result inside the save transaction even when assignment version did not change", async () => {
      const target = await f.account("CUSTOMER_SERVICE");
      const first = await prisma.workforceAssignment.findFirstOrThrow({
        where: { userId: target.user.id },
      });
      const overlap = await f.assignment(target.user.id, "CUSTOMER_SERVICE", true);
      const initial = await preview(owner, target.user.id, {
        operation: "revoke",
        expectedVersion: 0,
        assignmentId: first.id,
      });
      expect(initial.status).toBe(200);
      await prisma.workforceAssignment.update({
        where: { id: overlap.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      expect(
        (await revoke(target.user.id, first.id, initial.body.data.fingerprint)).status,
      ).toBe(409);
      expect(
        (await prisma.workforceAssignment.findUniqueOrThrow({ where: { id: first.id } }))
          .revokedAt,
      ).toBeNull();
      expect(
        (
          await prisma.workforceAccess.findUniqueOrThrow({
            where: { userId: target.user.id },
          })
        ).version,
      ).toBe(0);
      const refreshed = await preview(owner, target.user.id, {
        operation: "revoke",
        expectedVersion: 0,
        assignmentId: first.id,
      });
      expect(refreshed.body.data.removed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ capability: "CUSTOMER_ENQUIRIES" }),
        ]),
      );
      expect(
        (await revoke(target.user.id, first.id, refreshed.body.data.fingerprint)).status,
      ).toBe(200);
      expect(
        (await request(app).get("/api/v1/staff/workforce/enquiries").set(target.headers))
          .status,
      ).toBe(403);
    });
    it("previews a scheduled assignment at its start without granting present access or recording a preview mutation", async () => {
      const target = await f.account("ACCOUNTANT");
      const input = {
        ...grant("MECHANICAL_TECHNICIAN", f.home.id),
        startsAt: new Date(Date.now() + 3600000).toISOString(),
      };
      const auditBefore = await prisma.auditLog.count({
        where: { entityId: target.user.id },
      });
      const response = await preview(owner, target.user.id, input);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        scheduled: true,
        evaluatedAt: input.startsAt,
      });
      expect(response.body.data.added).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ capability: "JOBS_READ", scope: "ASSIGNED" }),
        ]),
      );
      expect(await prisma.auditLog.count({ where: { entityId: target.user.id } })).toBe(
        auditBefore,
      );
      const { operation: _operation, ...fields } = input;
      void _operation;
      const saved = await request(app)
        .post(`/api/v1/admin/workforce/accounts/${target.user.id}/assignments`)
        .set(owner.headers)
        .send({
          ...fields,
          temporary: true,
          receiptVersion: 2,
          expectedAccessPreview: response.body.data.fingerprint,
          reason: "Reviewed scheduled technician coverage",
          currentPassword: fixturePassword,
        });
      expect(saved.status).toBe(200);
      expect(
        (await request(app).get("/api/v1/staff/workforce/jobs").set(target.headers))
          .status,
      ).toBe(403);
    });
    it("shows inactive and unknown-version assignments as history, and rejects forged preview digests", async () => {
      const target = await f.account("CUSTOMER_SERVICE");
      await prisma.workforceAssignment.updateMany({
        where: { userId: target.user.id },
        data: { templateVersion: 99 },
      });
      const active = await read(owner, target.user.id);
      expect(active.body.data.effectiveAccess.grants).toEqual([]);
      await prisma.user.update({
        where: { id: target.user.id },
        data: { status: "SUSPENDED" },
      });
      const inactive = await read(owner, target.user.id);
      expect(inactive.body.data.effectiveAccess.baseline).toBe("INACTIVE");
      expect(inactive.body.data.activeAssignmentIds).toEqual([]);
      const another = await f.account("CUSTOMER_SERVICE");
      const existing = await prisma.workforceAssignment.findFirstOrThrow({
        where: { userId: another.user.id },
      });
      expect((await revoke(another.user.id, existing.id, "0".repeat(64))).status).toBe(
        409,
      );
      expect(
        (
          await prisma.workforceAssignment.findUniqueOrThrow({
            where: { id: existing.id },
          })
        ).revokedAt,
      ).toBeNull();
    });
  },
);
