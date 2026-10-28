import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { fixturePassword, workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "separate reviewed Care duties and workforce positions",
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
    const get = (actor: { headers: Record<string, string> }, path: string) =>
      request(app).get(`/api/v1${path}`).set(actor.headers);
    const post = (
      actor: { headers: Record<string, string> },
      userId: string,
      action: string,
      body: object,
    ) => {
      const path = `/api/v1/admin/workforce/accounts/${userId}${action === "enrollment" ? "" : `/${action}`}`;
      return (action === "assignments" ? request(app).post(path) : request(app).put(path))
        .set(actor.headers)
        .send(body);
    };
    const assignment = (template: string, version: number, expectedVersion: number) => ({
      template,
      expectedTemplateVersion: version,
      expectedVersion,
      branchId: f.home.id,
      temporary: true,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: null,
      reason: "Reviewed synthetic Care responsibility contract",
      currentPassword: fixturePassword,
      receiptVersion: 2,
    });
    it("keeps version-one delegated management usable without widening its catalogue", async () => {
      const target = await f.account("MECHANICAL_TECHNICIAN");
      const inspect = await get(
        f.scopedAdmin,
        `/admin/workforce/accounts/${target.user.id}`,
      );
      expect(inspect.status).toBe(200);
      expect(inspect.body.data.templatesVersion).toBe(1);
      expect(inspect.body.data.management.templates).toContain("CUSTOMER_SERVICE");
      expect(inspect.body.data.management.templates).not.toContain("CARE_VIEWER");
      const saved = await post(
        f.scopedAdmin,
        target.user.id,
        "assignments",
        assignment("CUSTOMER_SERVICE", 1, 0),
      );
      expect(saved.status).toBe(200);
      expect(saved.body.data.templateVersion).toBe(1);
      expect(
        (
          await post(
            f.scopedAdmin,
            target.user.id,
            "assignments",
            assignment("CARE_VIEWER", 2, 1),
          )
        ).status,
      ).toBe(403);
    });
    it("requires an explicit supported version for new duties and preserves old assignments", async () => {
      const target = await f.account("MECHANICAL_TECHNICIAN");
      const inspect = await get(owner, `/admin/workforce/accounts/${target.user.id}`);
      expect(inspect.body.data.templatesVersion).toBe(2);
      expect(inspect.body.data.management.templates).toContain("CARE_VIEWER");
      expect(
        (
          await post(
            owner,
            target.user.id,
            "assignments",
            assignment("CARE_VIEWER", 1, 0),
          )
        ).status,
      ).toBe(409);
      const saved = await post(
        owner,
        target.user.id,
        "assignments",
        assignment("CARE_VIEWER", 2, 0),
      );
      expect(saved.status).toBe(200);
      expect(saved.body.data.templateVersion).toBe(2);
      const access = await get(target, "/staff/workforce/access");
      expect(access.body.data.permissions).toContain("CARE_CASE_VIEW");
      expect(access.body.data.permissions).not.toContain("CARE_PUBLIC_REPLY");
      expect(access.body.data.permissions).not.toContain("CUSTOMER_ENQUIRIES");
      expect(
        access.body.data.assignments.find(
          (a: { template: string }) => a.template === "MECHANICAL_TECHNICIAN",
        ).templateVersion,
      ).toBe(1);
    });
    it("does not activate a previously unknown duty name in a version-one delegation", async () => {
      const admin = await f.account("MECHANICAL_TECHNICIAN", "ADMIN"),
        target = await f.account("MECHANICAL_TECHNICIAN");
      await prisma.workforceAccess.update({
        where: { userId: admin.user.id },
        data: {
          delegationPolicyVersion: 1,
          delegatedTemplates: ["CUSTOMER_SERVICE", "CARE_VIEWER"],
          delegatedBranchIds: [f.home.id],
        },
      });
      expect(
        (
          await post(
            owner,
            target.user.id,
            "assignments",
            assignment("CARE_VIEWER", 2, 0),
          )
        ).status,
      ).toBe(200);
      const inspected = await get(admin, `/admin/workforce/accounts/${target.user.id}`);
      expect(inspected.status).toBe(200);
      expect(inspected.body.data.management.templates).toEqual(["CUSTOMER_SERVICE"]);
      expect(
        inspected.body.data.assignments.some(
          (a: { template: string }) => a.template === "CARE_VIEWER",
        ),
      ).toBe(false);
      const directory = await get(
        admin,
        `/admin/workforce/accounts?q=${encodeURIComponent(target.user.email)}`,
      );
      expect(directory.status).toBe(200);
      expect(directory.body.data.items).toHaveLength(1);
      expect(
        directory.body.data.items[0].responsibilities.some(
          (a: { template: string }) => a.template === "CARE_VIEWER",
        ),
      ).toBe(false);
      expect(
        (
          await post(
            admin,
            target.user.id,
            "assignments",
            assignment("CARE_VIEWER", 2, 1),
          )
        ).status,
      ).toBe(403);
    });
    it("delegates a new duty only under the exact owner-reviewed catalogue version", async () => {
      const admin = await f.account("MECHANICAL_TECHNICIAN", "ADMIN");
      const body = {
        templates: ["CARE_VIEWER", "CARE_RESPONDER"],
        branchIds: [f.home.id],
        allowAdminInvitations: false,
        expectedVersion: 0,
        reason: "Owner reviewed synthetic Care management envelope",
        currentPassword: fixturePassword,
        receiptVersion: 2,
      };
      expect(
        (
          await post(owner, admin.user.id, "delegation", {
            ...body,
            expectedPolicyVersion: 1,
          })
        ).status,
      ).toBe(409);
      const saved = await post(owner, admin.user.id, "delegation", {
        ...body,
        expectedPolicyVersion: 2,
      });
      expect(saved.status).toBe(200);
      expect(saved.body.data.delegationPolicyVersion).toBe(2);
      const target = await f.account("MECHANICAL_TECHNICIAN");
      const inspect = await get(admin, `/admin/workforce/accounts/${target.user.id}`);
      expect(inspect.status).toBe(200);
      expect(inspect.body.data.templatesVersion).toBe(2);
      expect(inspect.body.data.management.templates).toEqual([
        "CARE_VIEWER",
        "CARE_RESPONDER",
      ]);
      expect(
        (
          await post(
            admin,
            target.user.id,
            "assignments",
            assignment("CARE_RESPONDER", 2, 0),
          )
        ).status,
      ).toBe(200);
    });
    it("never treats a duty as a job position, and a position grants no Care authority", async () => {
      const target = await f.account("MECHANICAL_TECHNICIAN");
      const body = {
        expectedVersion: 0,
        reason: "Reviewed synthetic position update",
        currentPassword: fixturePassword,
        receiptVersion: 2,
      };
      expect(
        (
          await post(owner, target.user.id, "enrollment", {
            ...body,
            position: "CARE_VIEWER",
          })
        ).status,
      ).toBe(422);
      expect(
        (await post(owner, target.user.id, "enrollment", { ...body, position: "CEO_MD" }))
          .status,
      ).toBe(403);
      const saved = await post(owner, target.user.id, "enrollment", {
        ...body,
        position: "ACCOUNTANT",
      });
      expect(saved.status).toBe(200);
      const access = await get(target, "/staff/workforce/access");
      expect(access.body.data.position).toBe("ACCOUNTANT");
      expect(access.body.data.permissions).not.toContain("CARE_CASE_VIEW");
      expect(access.body.data.canManageAssignments).toBe(false);
    });
  },
);
