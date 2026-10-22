import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { issueCsrfToken } from "../../src/common/security/csrf-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";

const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "managed job detail changes",
  () => {
    const evidence = process.env.WORKFORCE_JOB_DETAIL_ACTION_EVIDENCE!;
    const fixturePath = process.env.WORKFORCE_JOB_DETAIL_ACTION_FIXTURES!;
    const sessions: string[] = [],
      owned: string[] = [];
    const identities: Record<number, Record<string, string>> = {};
    let guarded = false,
      beforeHash = "",
      auditsBefore = 0,
      successfulWrites = 0;
    let counts: number[] = [],
      users: { userId: string }[];
    let fixture: {
      ownIds: string[];
      otherId: string;
      foreignId: string;
      branchId: string;
    };
    let tech: { id: string; firstName: string; lastName: string }, lead: typeof tech;
    const rows = () =>
      Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
        prisma.booking.findMany({
          where: { id: { notIn: owned } },
          orderBy: { id: "asc" },
        }),
        prisma.workOrder.findMany({
          where: { bookingId: { notIn: owned } },
          orderBy: { id: "asc" },
        }),
        prisma.bookingReminder.findMany({ orderBy: { id: "asc" } }),
        prisma.service.findMany({ orderBy: { id: "asc" } }),
        prisma.customerVehicle.findMany({ orderBy: { id: "asc" } }),
        prisma.order.findMany({ orderBy: { id: "asc" } }),
        prisma.payment.findMany({ orderBy: { id: "asc" } }),
        prisma.refund.findMany({ orderBy: { id: "asc" } }),
        prisma.invoice.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({ orderBy: { id: "asc" } }),
      ]);
    const digest = (value: unknown) =>
      createHash("sha256")
        .update(
          JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        )
        .digest("hex");
    async function change(
      index: number,
      id: string,
      action: "work" | "quality" | "assignment",
      body: Record<string, unknown>,
      csrf = true,
    ) {
      const headers = { ...identities[index] };
      if (!csrf) delete headers["x-csrf-token"];
      const call = request(app)[action === "quality" ? "post" : "patch"](
        `/api/v1/staff/workforce/jobs/${id}/${action}`,
      );
      const response = await call.set(headers).send(body);
      if (response.status === 200) {
        successfulWrites++;
        expect(workforceResponseSchema("job").safeParse(response.body.data).success).toBe(
          true,
        );
        expect(response.body.data.id).toBe(id);
        expect(response.body.data.access.userId).toBe(users[index]!.userId);
        expect(response.body.data.branch.id).toBe(fixture.branchId);
        expect(response.body.data.generatedAt).toBeTruthy();
        for (const field of ["customerId", "staffNotes", "quotedPriceKobo", "email"])
          expect(response.body.data).not.toHaveProperty(field);
      }
      return response;
    }
    beforeAll(async () => {
      expect(env.NODE_ENV).toBe("test");
      expect(
        await prisma.$queryRaw`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`,
      ).toEqual([
        {
          database: "allied_work_staff_workforce_20261019_test",
          host: "127.0.0.1",
          port: 55480,
        },
      ]);
      expect(
        await prisma.$queryRaw`SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS elevated, EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_database, EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) OR has_table_privilege(current_user,c.oid,'TRUNCATE'))) AS unsafe_tables FROM pg_roles WHERE rolname=current_user`,
      ).toEqual([{ elevated: false, owns_database: false, unsafe_tables: false }]);
      const resumeSetup = process.env.WORKFORCE_JOB_DETAIL_RESUME_SETUP === "true";
      if (existsSync(evidence) || (existsSync(fixturePath) && !resumeSetup))
        throw Error(
          "Dedicated action evidence/fixtures exist; inspect before repeating writes",
        );
      if (resumeSetup) {
        const retained = JSON.parse(readFileSync(fixturePath, "utf8"));
        expect(retained.setupComplete).toBe(false);
        owned.push(...retained.owned);
      }
      fixture = JSON.parse(readFileSync(process.env.WORKFORCE_JOBS_FIXTURES!, "utf8"));
      users = JSON.parse(
        readFileSync(process.env.WORKFORCE_NOTIFICATIONS_FIXTURES!, "utf8"),
      ).users;
      const before = await rows();
      beforeHash = digest(before);
      counts = before.map((table) => table.length);
      auditsBefore = await prisma.auditLog.count();
      guarded = true;
      for (const index of [0, 5, 6, 7, 10]) {
        const token = randomUUID(),
          csrf = issueCsrfToken(),
          expiresAt = new Date(Date.now() + 3600000);
        const session = await prisma.session.create({
          data: {
            userId: users[index]!.userId,
            tokenHash: hashToken("session", token),
            csrfTokenHash: csrf.hash,
            expiresAt,
            idleExpiresAt: expiresAt,
            mfaRequired: true,
            mfaVerifiedAt: new Date(),
            createdAt: new Date(Date.now() - 1000),
          },
        });
        sessions.push(session.id);
        identities[index] = {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: "http://localhost:3000",
          "x-csrf-token": csrf.raw,
        };
      }
      tech = await prisma.staffProfile.findUniqueOrThrow({
        where: { userId: users[6]!.userId },
        select: { id: true, firstName: true, lastName: true },
      });
      lead = await prisma.staffProfile.findUniqueOrThrow({
        where: { userId: users[5]!.userId },
        select: { id: true, firstName: true, lastName: true },
      });
      const source = await prisma.booking.findUniqueOrThrow({
        where: { id: fixture.ownIds[0] },
      });
      // Dedicated synthetic rows only. Original queue fixtures remain unchanged.
      for (let index = 0; index < 3; index++) {
        const id = owned[index] ?? randomUUID();
        if (!owned[index]) owned.push(id);
        writeFileSync(fixturePath, JSON.stringify({ owned, setupComplete: false }));
        const retained = await prisma.booking.findUnique({
          where: { id },
          include: { workOrder: true },
        });
        if (retained) {
          expect(retained).toMatchObject({
            customerId: source.customerId,
            branchId: source.branchId,
            serviceId: source.serviceId,
            version: 0,
            status: "CONFIRMED",
            customerNotes: "Synthetic milestone 105 action verification.",
            workOrder: { status: "APPROVED", version: 0 },
          });
          expect(index).toBe(0);
          continue;
        }
        await prisma.booking.create({
          data: {
            id,
            customerId: source.customerId,
            branchId: source.branchId,
            serviceId: source.serviceId,
            vehicleId: source.vehicleId,
            assignedStaffId: index === 1 ? lead.id : tech.id,
            scheduledAt: new Date("2026-10-20T09:00:00Z"),
            status: index === 0 ? "CONFIRMED" : "IN_PROGRESS",
            confirmedAt: new Date(),
            ...(index > 0 ? { startedAt: new Date() } : {}),
            customerNotes: "Synthetic milestone 105 action verification.",
            staffNotes: "Restricted fixture note",
            workOrder: {
              create: {
                workOrderNumber: `Q105-${index}-${randomUUID().slice(0, 20)}`,
                status: index === 0 ? "APPROVED" : "QUALITY_CHECK",
                openedAt: new Date(),
                workedByUserIds: index === 1 ? [users[5]!.userId] : [],
              },
            },
          },
        });
      }
      writeFileSync(fixturePath, JSON.stringify({ owned, setupComplete: true }));
    }, 30000);
    it("rejects CSRF, wrong responsibility, foreign jobs and invalid bodies without changing records", async () => {
      const before = await prisma.booking.findMany({
        where: { id: { in: owned } },
        include: { workOrder: true },
        orderBy: { id: "asc" },
      });
      expect(
        (
          await change(
            6,
            owned[0]!,
            "work",
            { expectedVersion: 0, diagnosis: "Synthetic findings" },
            false,
          )
        ).status,
      ).toBe(403);
      for (const index of [0, 7, 10])
        expect(
          (
            await change(index, owned[0]!, "work", {
              expectedVersion: 0,
              diagnosis: "Synthetic findings",
            })
          ).status,
        ).toBe(403);
      expect(
        (
          await change(6, fixture.foreignId, "work", {
            expectedVersion: 0,
            diagnosis: "Synthetic findings",
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await change(6, fixture.otherId, "work", {
            expectedVersion: 0,
            diagnosis: "Synthetic findings",
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await change(6, owned[0]!, "assignment", {
            expectedVersion: 0,
            staffId: lead.id,
            reason: "Synthetic assignment",
          })
        ).status,
      ).toBe(403);
      for (const body of [
        { expectedVersion: 0 },
        { expectedVersion: 0, diagnosis: " " },
        { expectedVersion: 0, diagnosis: "x".repeat(5001) },
        { expectedVersion: 0, diagnosis: "Synthetic findings", staffNotes: "Forbidden" },
      ])
        expect((await change(6, owned[0]!, "work", body)).status).toBe(422);
      expect(
        await prisma.booking.findMany({
          where: { id: { in: owned } },
          include: { workOrder: true },
          orderBy: { id: "asc" },
        }),
      ).toEqual(before);
    });
    it("returns exact technical changes, versions and attribution through the permitted lifecycle", async () => {
      let response = await change(6, owned[0]!, "work", {
        expectedVersion: 0,
        diagnosis: "Verified synthetic ignition fault.",
        status: "IN_PROGRESS",
      });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        version: 1,
        status: "IN_PROGRESS",
        assignedStaff: tech,
        workOrder: {
          version: 1,
          status: "IN_PROGRESS",
          diagnosis: "Verified synthetic ignition fault.",
          workedByUserIds: [users[6]!.userId],
        },
      });
      expect(
        (
          await change(6, owned[0]!, "work", {
            expectedVersion: 0,
            diagnosis: "Stale overwrite",
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await change(6, owned[0]!, "work", {
            expectedVersion: 1,
            status: "IN_PROGRESS",
          })
        ).status,
      ).toBe(409);
      response = await change(6, owned[0]!, "work", {
        expectedVersion: 1,
        internalNotes: "Synthetic replacement part required.",
        status: "AWAITING_PARTS",
      });
      expect(response.status).toBe(200);
      expect(response.body.data.workOrder).toMatchObject({
        version: 2,
        status: "AWAITING_PARTS",
        diagnosis: "Verified synthetic ignition fault.",
        internalNotes: "Synthetic replacement part required.",
      });
      response = await change(6, owned[0]!, "work", {
        expectedVersion: 2,
        status: "IN_PROGRESS",
      });
      expect(response.status).toBe(200);
      expect(response.body.data.version).toBe(1);
      response = await change(6, owned[0]!, "work", {
        expectedVersion: 3,
        status: "QUALITY_CHECK",
      });
      expect(response.status).toBe(200);
      expect(response.body.data.workOrder.version).toBe(4);
    });
    it("assigns eligible staff with fresh references and preserves work versions", async () => {
      const response = await change(5, owned[0]!, "assignment", {
        expectedVersion: 1,
        staffId: lead.id,
        reason: "Synthetic lead takes temporary assignment.",
      });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        version: 2,
        assignedStaffId: lead.id,
        assignedStaff: lead,
        workOrder: { version: 4 },
      });
      expect(
        (
          await change(5, owned[0]!, "assignment", {
            expectedVersion: 1,
            staffId: tech.id,
            reason: "Reject stale assignment revision.",
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await change(5, owned[0]!, "quality", {
            expectedVersion: 4,
            reason: "Assigned lead cannot approve own job.",
          })
        ).status,
      ).toBe(403);
      const returned = await change(5, owned[0]!, "assignment", {
        expectedVersion: 2,
        staffId: tech.id,
        reason: "Synthetic assignment returned to technician.",
      });
      expect(returned.status).toBe(200);
      expect(returned.body.data).toMatchObject({
        version: 3,
        assignedStaffId: tech.id,
        assignedStaff: tech,
        workOrder: { version: 4 },
      });
    });
    it("requires independent attributed review and atomically completes both records", async () => {
      expect(
        (
          await change(5, owned[1]!, "quality", {
            expectedVersion: 0,
            reason: "Self review must remain unavailable.",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await change(5, owned[2]!, "quality", {
            expectedVersion: 0,
            reason: "Unattributed review must remain unavailable.",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await change(5, owned[0]!, "quality", {
            expectedVersion: 3,
            reason: "Stale quality revision must be rejected.",
          })
        ).status,
      ).toBe(409);
      const response = await change(5, owned[0]!, "quality", {
        expectedVersion: 4,
        reason: "Synthetic independent quality inspection passed.",
      });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        version: 4,
        status: "COMPLETED",
        workOrder: {
          version: 5,
          status: "COMPLETED",
          qualityApprovedByUserId: users[5]!.userId,
          workedByUserIds: [users[6]!.userId],
        },
      });
      expect(response.body.data.workOrder.qualityApprovedAt).toBeTruthy();
      const persisted = await prisma.booking.findUniqueOrThrow({
        where: { id: owned[0] },
        include: { workOrder: true },
      });
      expect(persisted.completedAt).not.toBeNull();
      expect(persisted.workOrder!.completedAt).toEqual(persisted.completedAt);
      expect(
        (
          await change(5, owned[0]!, "quality", {
            expectedVersion: 5,
            reason: "Duplicate completion must be rejected.",
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await change(5, owned[0]!, "assignment", {
            expectedVersion: 4,
            staffId: lead.id,
            reason: "Closed booking cannot be reassigned.",
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await change(6, owned[0]!, "work", {
            expectedVersion: 5,
            diagnosis: "Closed job cannot be changed.",
          })
        ).status,
      ).toBe(409);
      const logs = await prisma.auditLog.findMany({
        where: { entityId: { in: [owned[0]!, persisted.workOrder!.id] } },
      });
      expect(logs).toHaveLength(7);
      expect(
        logs.some((log) =>
          JSON.stringify(log.newValues).includes(
            "Synthetic independent quality inspection passed.",
          ),
        ),
      ).toBe(true);
      expect(
        logs.some((log) =>
          JSON.stringify(log.newValues).includes(
            "Synthetic assignment returned to technician.",
          ),
        ),
      ).toBe(true);
    });
    afterAll(async () => {
      try {
        if (guarded) {
          await prisma.session.deleteMany({ where: { id: { in: sessions } } });
          const originalRowsUnchanged = digest(await rows()) === beforeHash;
          const auditDelta = (await prisma.auditLog.count()) - auditsBefore;
          const temporarySessionsRemaining = await prisma.session.count({
            where: { id: { in: sessions } },
          });
          writeFileSync(
            evidence,
            JSON.stringify({
              originalRowsUnchanged,
              originalCounts: counts,
              successfulWrites,
              auditDelta,
              temporarySessionsRemaining,
              retainedSyntheticBookings: owned.length,
            }),
          );
          expect(originalRowsUnchanged).toBe(true);
          expect(auditDelta).toBe(successfulWrites);
          expect(temporarySessionsRemaining).toBe(0);
        }
      } finally {
        await prisma.$disconnect();
      }
    });
  },
);
