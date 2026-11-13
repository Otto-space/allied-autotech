import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { auditPageResponseSchema } from "../../src/modules/audit/audit-response.schemas.js";
import { operationsAccount } from "../helpers/operations-paging.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "recorded access-change history",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    const reference = `access-history-${randomUUID()}`;
    let admin: Awaited<ReturnType<typeof operationsAccount>>,
      owner: typeof admin,
      staff: typeof admin,
      customer: typeof admin,
      other: typeof admin;
    let branchId: string,
      staffProfileId: string,
      ownInvite: string,
      foreignInvite: string;
    const ids: string[] = [];
    const read = (identity = admin, query: Record<string, string | number> = {}) =>
      request(app)
        .get("/api/v1/admin/audit")
        .set(identity.headers)
        .query({ requestId: reference, view: "ACCESS_CHANGES", ...query });
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      admin = await operationsAccount();
      owner = await operationsAccount("SUPER_ADMIN");
      staff = await operationsAccount("STAFF");
      customer = await operationsAccount("CUSTOMER");
      other = await operationsAccount();
      branchId = (
        await prisma.branch.create({
          data: {
            code: `H-${randomUUID().slice(0, 8)}`,
            name: "Current synthetic branch name",
            address: "Synthetic",
            city: "Synthetic",
            state: "Synthetic",
          },
        })
      ).id;
      await prisma.staffProfile.create({
        data: {
          userId: admin.user.id,
          firstName: "Current",
          lastName: "Administrator",
          branchId,
        },
      });
      // IDs are unique within each table, not across tables. Keep actor and profile
      // identity resolution separate even when these two namespaces collide.
      staffProfileId = (
        await prisma.staffProfile.create({
          data: {
            id: admin.user.id,
            userId: staff.user.id,
            firstName: "Current",
            lastName: "Person",
            branchId,
          },
        })
      ).id;
      await prisma.staffProfile.create({
        data: {
          userId: customer.user.id,
          firstName: "PRIVATE_STALE_STAFF_NAME",
          lastName: "Must stay excluded",
          branchId,
        },
      });
      const invitation = (invitedById: string) =>
        prisma.privilegedInvitation.create({
          data: {
            email: staff.user.email,
            role: "ADMIN",
            recipientId: staff.user.id,
            invitedById,
            tokenHash: hashToken("privileged-invitation", randomUUID()),
            revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
      ownInvite = (await invitation(admin.user.id)).id;
      foreignInvite = (await invitation(other.user.id)).id;
      const events = [
        {
          action: "UPDATE",
          entityType: "USER",
          entityId: staff.user.id,
          newValues: {
            workforceAction: "ASSIGN",
            template: "CUSTOMER_SERVICE",
            templateVersion: 1,
            scope: "BRANCH",
            branchId,
            temporary: true,
            startsAt: "2026-11-13T09:00:00Z",
            expiresAt: "2026-11-14T09:00:00Z",
            reason: "Recorded synthetic cover",
          },
        },
        {
          action: "ROLE_CHANGE",
          entityType: "USER",
          entityId: staff.user.id,
          oldValues: { role: "CUSTOMER" },
          newValues: { role: "ADMIN" },
        },
        {
          action: "BRANCH_ASSIGNED",
          entityType: "STAFF_PROFILE",
          entityId: staffProfileId,
          oldValues: { branchId: null },
          newValues: { branchId },
        },
        {
          action: "UPDATE",
          entityType: "PRIVILEGED_INVITATION",
          entityId: ownInvite,
          newValues: { revoked: true },
        },
        {
          action: "UPDATE",
          entityType: "PRIVILEGED_INVITATION",
          entityId: foreignInvite,
          newValues: { revoked: true },
        },
        {
          action: "ROLE_CHANGE",
          entityType: "USER",
          entityId: customer.user.id,
          oldValues: { role: "STAFF" },
          newValues: { role: "CUSTOMER" },
        },
        {
          action: "UPDATE",
          entityType: "USER",
          entityId: staff.user.id,
          newValues: { workforceAction: "ACCESS_PREVIEW" },
        },
        {
          action: "READ",
          entityType: "USER",
          entityId: staff.user.id,
          newValues: { resource: "AUDIT_LOG" },
        },
        {
          action: "UPDATE",
          entityType: "USER",
          entityId: staff.user.id,
          newValues: { workforceAction: ["ASSIGN"] },
        },
        {
          action: "ACCOUNT_SUSPENDED",
          entityType: "USER",
          entityId: customer.user.id,
          newValues: { status: "SUSPENDED" },
        },
      ] as const;
      for (const event of events) {
        const row = await prisma.auditLog.create({
          data: {
            ...event,
            userId: admin.user.id,
            requestId: reference,
            createdAt: new Date("2026-11-13T10:00:00Z"),
            ipAddress: "127.0.0.2",
            userAgent: "PRIVATE-HISTORY-AGENT",
          },
        });
        ids.push(row.id);
      }
    }, 30000);
    afterAll(() => prisma.$disconnect());

    it("selects only supported changes, keeps raw evidence and separates current identity from history", async () => {
      const before = await prisma.auditLog.findMany({
        where: { id: { in: ids } },
        orderBy: { id: "asc" },
      });
      const response = await read();
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      const data = auditPageResponseSchema.parse(response.body.data);
      expect(data.items).toHaveLength(6);
      const role = data.items.find((row) => row.id === ids[1])!;
      expect(role.newValues).toEqual({ role: "ADMIN" });
      expect(role.currentContext?.subject).toMatchObject({
        id: staff.user.id,
        name: "Current Person",
        role: "STAFF",
      });
      const branch = data.items.find((row) => row.id === ids[2])!;
      expect(branch.currentContext?.actor).toMatchObject({
        id: admin.user.id,
        name: "Current Administrator",
      });
      expect(branch.currentContext?.subject).toMatchObject({
        id: staff.user.id,
        name: "Current Person",
      });
      expect(branch.currentContext?.branches).toEqual([
        { id: branchId, name: "Current synthetic branch name" },
      ]);
      expect(
        data.items.find((row) => row.id === ids[5])?.currentContext?.subject,
      ).toBeNull();
      expect(JSON.stringify(response.body)).not.toMatch(
        /PRIVATE_STALE_STAFF_NAME|PRIVATE-HISTORY-AGENT|passwordHash|tokenHash|csrfTokenHash|ipAddress|userAgent|staffProfile|customerProfile/,
      );
      expect(
        await prisma.auditLog.findMany({
          where: { id: { in: ids } },
          orderBy: { id: "asc" },
        }),
      ).toEqual(before);
    });
    it("resolves invitation recipients only within existing own/all visibility", async () => {
      const adminRows = auditPageResponseSchema.parse((await read()).body.data).items;
      expect(
        adminRows.find((row) => row.entityId === ownInvite)?.currentContext?.subject?.id,
      ).toBe(staff.user.id);
      expect(
        adminRows.find((row) => row.entityId === foreignInvite)?.currentContext?.subject,
      ).toBeNull();
      const ownerRows = auditPageResponseSchema.parse(
        (await read(owner)).body.data,
      ).items;
      expect(
        ownerRows.find((row) => row.entityId === foreignInvite)?.currentContext?.subject
          ?.id,
      ).toBe(staff.user.id);
    });
    it("leaves the original full audit response unchanged and omits unrequested identity context", async () => {
      const response = await request(app)
        .get("/api/v1/admin/audit")
        .set(admin.headers)
        .query({ requestId: reference });
      expect(response.status).toBe(200);
      const rows = auditPageResponseSchema.parse(response.body.data).items;
      expect(rows).toHaveLength(10);
      expect(rows.every((row) => !("currentContext" in row))).toBe(true);
    });
    it("pages tied timestamps within the selected changes and preserves additional exact filters", async () => {
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const response = await read(admin, { limit: 2, ...(cursor ? { cursor } : {}) });
        expect(response.status).toBe(200);
        const data = auditPageResponseSchema.parse(response.body.data);
        seen.push(...data.items.map((row) => row.id));
        cursor = data.nextCursor;
      } while (cursor);
      expect(new Set(seen).size).toBe(6);
      expect(seen).toHaveLength(6);
      const filtered = await read(admin, { action: "ROLE_CHANGE" });
      expect(filtered.status).toBe(200);
      expect(filtered.body.data.items).toHaveLength(2);
      expect((await read(admin, { view: "UNKNOWN" })).status).toBe(422);
    });
    it("rechecks current administrator, MFA and session authority before protected history reads", async () => {
      expect(
        (await request(app).get("/api/v1/admin/audit?view=ACCESS_CHANGES")).status,
      ).toBe(401);
      expect((await read(staff)).status).toBe(403);
      expect((await read(customer)).status).toBe(403);
      const unassured = await operationsAccount("ADMIN", false);
      expect((await read(unassured)).status).toBe(403);
      const revoked = await operationsAccount();
      await prisma.session.update({
        where: { id: revoked.session.id },
        data: { revokedAt: new Date() },
      });
      expect((await read(revoked)).status).toBe(401);
    });
  },
);
