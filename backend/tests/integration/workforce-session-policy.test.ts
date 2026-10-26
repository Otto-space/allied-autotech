import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture, fixturePassword } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { workforceTemplates } from "../../src/modules/organization/workforce-catalogue.js";
// The pure maintained UI registry has no frontend runtime dependency. This verifies
// real API decisions against the exact predicates used by navigation/page guards.
import {
  workforceDestinations,
  workforceAllows,
} from "../../../frontend/lib/workforce-registry.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "current workforce projection, navigation and session policy",
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
    const read = (actor: { headers: Record<string, string> }, path: string) =>
      request(app)
        .get("/api/v1" + path)
        .set(actor.headers);
    const snapshot = async (actor: { headers: Record<string, string> }) => {
      const r = await read(actor, "/staff/workforce/access");
      expect(r.status).toBe(200);
      expect(r.headers["cache-control"]).toContain("no-store");
      return r.body.data;
    };
    const revoke = (userId: string, assignmentId: string, version: number) =>
      request(app)
        .post(
          `/api/v1/admin/workforce/accounts/${userId}/assignments/${assignmentId}/revoke`,
        )
        .set(owner.headers)
        .send({
          receiptVersion: 2,
          expectedVersion: version,
          currentPassword: fixturePassword,
          reason: "Reviewed isolated session continuity",
        });
    it("preserves the protected owner's existing baseline even when a business-position record exists", async () => {
      await prisma.workforceAccess.upsert({
        where: { userId: f.owner.id },
        create: { userId: f.owner.id, position: "CEO_MD", updatedByUserId: f.owner.id },
        update: {},
      });
      const ownerSession = await read(owner, "/auth/session");
      expect(ownerSession.status).toBe(200);
      expect(ownerSession.body.data).toMatchObject({
        workforceManaged: false,
        user: { role: "SUPER_ADMIN" },
      });
      const managedAdmin = await read(f.operations, "/auth/session");
      expect(managedAdmin.status).toBe(200);
      expect(managedAdmin.body.data.workforceManaged).toBe(true);
      const overview = "/staff/overview?from=2026-10-01&to=2026-10-26";
      expect((await read(f.operations, overview)).status).toBe(403);
      expect((await read(owner, overview)).status).toBe(200);
    });

    it.each(Object.keys(workforceTemplates) as (keyof typeof workforceTemplates)[])(
      "%s navigation predicates agree with actual authenticated queues",
      async (template) => {
        const person = await f.account(template),
          access = await snapshot(person);
        expect(access.accessRevision).toMatch(/^[a-f0-9]{64}$/);
        expect(access.nextChangeAt).toBeNull();
        expect(access.permissions).toEqual(
          [...workforceTemplates[template].actions].sort(),
        );
        for (const entry of workforceDestinations.filter((d) =>
          [
            "jobs",
            "bookings",
            "enquiries",
            "complaints",
            "orders",
            "finance",
            "fitment",
          ].includes(d.id),
        )) {
          const endpoint =
            entry.id === "fitment"
              ? "/staff/fitment/rules"
              : `/staff/workforce/${entry.id}`;
          const response = await read(person, endpoint);
          expect(response.status, `${template}: ${entry.href}`).toBe(
            workforceAllows(access, entry.predicate) ? 200 : 403,
          );
        }
        const again = await snapshot(person);
        expect(again.accessRevision).toBe(access.accessRevision);
        expect(again.capabilityScopes).toEqual(access.capabilityScopes);
      },
    );
    it("revokes one overlapping source without losing valid care access, then rejects the same session after the final grant is revoked", async () => {
      const person = await f.account("CUSTOMER_SERVICE"),
        extra = await f.assignment(person.user.id, "CUSTOMER_SERVICE");
      const before = await snapshot(person),
        first = before.assignments.find((a: { id: string }) => a.id !== extra.id);
      expect((await revoke(person.user.id, first.id, 0)).status).toBe(200);
      const retained = await snapshot(person);
      expect(retained.permissions).toEqual(before.permissions);
      expect(retained.accessRevision).not.toBe(before.accessRevision);
      expect((await read(person, "/staff/workforce/enquiries")).status).toBe(200);
      expect((await revoke(person.user.id, extra.id, 1)).status).toBe(200);
      const removed = await snapshot(person);
      expect(removed.permissions).toEqual([]);
      expect(removed.capabilityScopes).toEqual([]);
      expect((await read(person, "/staff/workforce/enquiries")).status).toBe(403);
      expect(
        await prisma.enquiry.findUnique({
          where: { id: f.generalEnquiry.id },
          select: { id: true, message: true },
        }),
      ).toMatchObject({ id: f.generalEnquiry.id, message: "Synthetic question" });
    });
    it("announces future starts and expiry, changing effective revision without an assignment version change", async () => {
      const person = await f.account("ACCOUNTANT");
      const assignment = await prisma.workforceAssignment.findFirstOrThrow({
        where: { userId: person.user.id },
      });
      const startsAt = new Date(Date.now() + 60000),
        expiresAt = new Date(Date.now() + 120000);
      await prisma.workforceAssignment.update({
        where: { id: assignment.id },
        data: { startsAt, expiresAt },
      });
      const future = await snapshot(person);
      expect(future.permissions).toEqual([]);
      expect(future.nextChangeAt).toBe(startsAt.toISOString());
      await prisma.workforceAssignment.update({
        where: { id: assignment.id },
        data: { startsAt: new Date(Date.now() - 1000) },
      });
      const active = await snapshot(person);
      expect(active.version).toBe(future.version);
      expect(active.accessRevision).not.toBe(future.accessRevision);
      expect(active.permissions).toEqual(["FINANCE_READ"]);
      expect(active.nextChangeAt).toBe(expiresAt.toISOString());
      await prisma.workforceAssignment.update({
        where: { id: assignment.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      const expired = await snapshot(person);
      expect(expired.version).toBe(active.version);
      expect(expired.accessRevision).not.toBe(active.accessRevision);
      expect(expired.permissions).toEqual([]);
      expect(expired.nextChangeAt).toBeNull();
      expect((await read(person, "/staff/workforce/finance")).status).toBe(403);
    });
    it("keeps each branch scoped and removes a deactivated branch without inventing company access", async () => {
      const person = await f.account("CUSTOMER_SERVICE");
      await f.assignment(person.user.id, "ACCOUNTANT", false, f.other.id);
      const before = await snapshot(person);
      expect(
        before.capabilityScopes.find(
          (g: { capability: string }) => g.capability === "FINANCE_READ",
        ),
      ).toMatchObject({ branchId: f.other.id, scope: "BRANCH" });
      expect(
        before.capabilityScopes.filter(
          (g: { capability: string }) => g.capability === "CUSTOMER_ENQUIRIES",
        ),
      ).toEqual([expect.objectContaining({ branchId: f.home.id, scope: "BRANCH" })]);
      await prisma.branch.update({
        where: { id: f.other.id },
        data: { isActive: false },
      });
      const after = await snapshot(person);
      expect(after.version).toBe(before.version);
      expect(after.accessRevision).not.toBe(before.accessRevision);
      expect(after.permissions).not.toContain("FINANCE_READ");
      expect(after.permissions).toContain("CUSTOMER_ENQUIRIES");
      expect((await read(person, "/staff/workforce/finance")).status).toBe(403);
      expect((await read(person, "/staff/workforce/enquiries")).status).toBe(200);
    });
    it("preserves role/MFA/ownership boundaries and never treats the opaque revision as authority", async () => {
      const unassured = await f.session(f.care.user.id, "STAFF", false);
      expect((await read(unassured, "/staff/workforce/access")).status).toBe(403);
      expect((await read(f.customer, "/staff/workforce/access")).status).toBe(403);
      const own = await snapshot(f.mechanical1);
      const forged = await request(app)
        .get("/api/v1/staff/workforce/finance")
        .set(f.mechanical1.headers)
        .set("X-Workforce-Revision", own.accessRevision);
      expect(forged.status).toBe(403);
      expect(
        (await read(f.mechanical1, "/staff/workforce/jobs/" + f.job2.id)).status,
      ).toBe(404);
    });
  },
);
