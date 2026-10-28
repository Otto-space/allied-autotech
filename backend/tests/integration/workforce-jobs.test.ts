import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "workforce jobs scoped search and paging",
  () => {
    const evidence = process.env.WORKFORCE_JOBS_EVIDENCE!,
      fixturesPath = process.env.WORKFORCE_JOBS_FIXTURES!,
      sessions: string[] = [];
    let guarded = false,
      beforeHash: string,
      originals: string[][],
      auditBefore = 0,
      successfulReads = 0;
    let identities: Record<string, string>[], weak: Record<string, string>;
    let ownIds: string[] = [],
      otherId: string,
      foreignId: string,
      specialId: string,
      customerId: string,
      branchId: string;
    const statuses = [
      "DRAFT",
      "APPROVED",
      "IN_PROGRESS",
      "AWAITING_PARTS",
      "QUALITY_CHECK",
      "COMPLETED",
      "CANCELLED",
    ] as const;
    const rows = () =>
      Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.service.findMany({ orderBy: { id: "asc" } }),
        prisma.customerVehicle.findMany({ orderBy: { id: "asc" } }),
        prisma.booking.findMany({ orderBy: { id: "asc" } }),
        prisma.workOrder.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({ orderBy: { id: "asc" } }),
        prisma.order.findMany({ orderBy: { id: "asc" } }),
        prisma.payment.findMany({ orderBy: { id: "asc" } }),
        prisma.refund.findMany({ orderBy: { id: "asc" } }),
        prisma.invoice.findMany({ orderBy: { id: "asc" } }),
      ]);
    const digest = (value: unknown) =>
      createHash("sha256")
        .update(
          JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        )
        .digest("hex");
    async function auth(userId: string, mfa = true) {
      const token = randomUUID(),
        expiry = new Date(Date.now() + 3600000);
      const row = await prisma.session.create({
        data: {
          userId,
          tokenHash: hashToken("session", token),
          expiresAt: expiry,
          idleExpiresAt: expiry,
          mfaRequired: true,
          mfaVerifiedAt: mfa ? new Date() : null,
          createdAt: new Date(Date.now() - 1000),
        },
      });
      sessions.push(row.id);
      return { Cookie: `${sessionCookieName}=${token}` };
    }
    async function get(
      identity: Record<string, string>,
      query: Record<string, string | number> = {},
    ) {
      const response = await request(app)
        .get("/api/v1/staff/workforce/jobs")
        .query(query)
        .set(identity);
      if (response.status === 200) successfulReads++;
      return response;
    }
    beforeAll(async () => {
      expect(
        await prisma.$queryRaw`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`,
      ).toEqual([
        {
          database: "allied_work_staff_workforce_20261019_test",
          host: "127.0.0.1",
          port: 55480,
        },
      ]);
      expect(env.NODE_ENV).toBe("test");
      expect(
        await prisma.$queryRaw`SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS elevated FROM pg_roles WHERE rolname=current_user`,
      ).toEqual([{ elevated: false }]);
      const resumeSetup = process.env.WORKFORCE_JOBS_RESUME_SETUP === "true";
      if (resumeSetup) {
        const prior = JSON.parse(readFileSync(evidence, "utf8"));
        expect(prior.originalRowsUnchanged).toBe(true);
        expect(prior.successfulReads).toBe(0);
        expect(prior.temporarySessionsRemaining).toBe(0);
        expect(
          await prisma.service.count({
            where: { name: { in: ["Q104 Engine diagnostics", "Q104 Special%_service"] } },
          }),
        ).toBe(2);
        expect(
          await prisma.customerVehicle.count({
            where: { registrationNumber: "PHC-Q104-TEST" },
          }),
        ).toBe(1);
        expect(
          await prisma.booking.count({
            where: {
              service: {
                name: { in: ["Q104 Engine diagnostics", "Q104 Special%_service"] },
              },
            },
          }),
        ).toBe(prior.retainedJobs);
      }
      if (existsSync(fixturesPath) || (existsSync(evidence) && !resumeSetup))
        throw Error(
          "Jobs fixtures/evidence already exist; inspect before repeating writes",
        );
      const before = await rows();
      beforeHash = digest(before);
      originals = before.map((table, index) =>
        table.map((row) =>
          index === 7 ? (row as { userId: string }).userId : (row as { id: string }).id,
        ),
      );
      auditBefore = await prisma.auditLog.count();
      writeFileSync(
        evidence,
        JSON.stringify({
          phase: "started",
          beforeHash,
          originalCounts: originals.map((ids) => ids.length),
          auditBefore,
        }),
      );
      guarded = true;
      const users = JSON.parse(
        readFileSync(process.env.WORKFORCE_NOTIFICATIONS_FIXTURES!, "utf8"),
      ).users as { userId: string }[];
      identities = [];
      for (const user of users) identities.push(await auth(user.userId));
      weak = await auth(users[6]!.userId, false);
      const technician = await prisma.staffProfile.findUniqueOrThrow({
          where: { userId: users[6]!.userId },
        }),
        other = await prisma.staffProfile.findUniqueOrThrow({
          where: { userId: users[7]!.userId },
        });
      const assignment = await prisma.workforceAssignment.findFirstOrThrow({
        where: { userId: users[6]!.userId, revokedAt: null },
      });
      branchId = assignment.branchId;
      const foreignBranch = await prisma.branch.findFirstOrThrow({
        where: { id: { not: branchId }, isActive: true },
      });
      customerId = (
        await prisma.customerProfile.findUniqueOrThrow({
          where: { userId: users[10]!.userId },
        })
      ).id;
      const service = resumeSetup
        ? await prisma.service.findFirstOrThrow({
            where: { name: "Q104 Engine diagnostics" },
          })
        : await prisma.service.create({
            data: {
              name: "Q104 Engine diagnostics",
              slug: `q104-${randomUUID()}`,
              pricingType: "QUOTE_REQUIRED",
              durationMinutes: 60,
            },
          });
      const special = resumeSetup
        ? await prisma.service.findFirstOrThrow({
            where: { name: "Q104 Special%_service" },
          })
        : await prisma.service.create({
            data: {
              name: "Q104 Special%_service",
              slug: `q104-special-${randomUUID()}`,
              pricingType: "QUOTE_REQUIRED",
              durationMinutes: 60,
            },
          });
      const vehicle = resumeSetup
        ? await prisma.customerVehicle.findFirstOrThrow({
            where: { customerId, registrationNumber: "PHC-Q104-TEST" },
          })
        : await prisma.customerVehicle.create({
            data: {
              customerId,
              make: "Toyota",
              model: "Q104 Corolla",
              year: 2020,
              registrationNumber: "PHC-Q104-TEST",
            },
          });
      const retained = resumeSetup
        ? await prisma.booking.findMany({
            where: { serviceId: { in: [service.id, special.id] } },
            include: { workOrder: true },
          })
        : [];
      const create = async (
        index: number,
        staffId = technician.id,
        branch = branchId,
        serviceId = service.id,
      ) => {
        const scheduledAt = new Date(Date.UTC(2026, 9, 19, 8 + index));
        const matches = retained.filter(
          (job) => job.scheduledAt.getTime() === scheduledAt.getTime(),
        );
        expect(matches.length).toBeLessThanOrEqual(1);
        if (matches[0]) {
          expect(matches[0]).toMatchObject({
            customerId,
            branchId: branch,
            assignedStaffId: staffId,
            serviceId,
            vehicleId: vehicle.id,
            status: "CONFIRMED",
          });
          return matches[0];
        }
        return prisma.booking.create({
          data: {
            customerId,
            branchId: branch,
            assignedStaffId: staffId,
            serviceId,
            vehicleId: vehicle.id,
            scheduledAt,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            staffNotes: "Restricted note must not be projected",
            ...(index === 3
              ? {}
              : {
                  workOrder: {
                    create: {
                      workOrderNumber: `Q104-${index}-${randomUUID().slice(0, 20)}`,
                      status: statuses[index % 7]!,
                      openedAt: new Date(),
                      ...(statuses[index % 7] === "IN_PROGRESS"
                        ? { startedAt: new Date() }
                        : {}),
                      ...(statuses[index % 7] === "COMPLETED"
                        ? { completedAt: new Date() }
                        : {}),
                      ...(statuses[index % 7] === "CANCELLED"
                        ? { cancelledAt: new Date() }
                        : {}),
                    },
                  },
                }),
          },
        });
      };
      for (let index = 0; index < 27; index++) ownIds.push((await create(index)).id);
      specialId = (await create(28, technician.id, branchId, special.id)).id;
      ownIds.push(specialId);
      otherId = (await create(29, other.id)).id;
      foreignId = (await create(30, technician.id, foreignBranch.id)).id;
      writeFileSync(
        fixturesPath,
        JSON.stringify({
          users: users.map((user) => ({ userId: user.userId })),
          ownIds,
          otherId,
          foreignId,
          specialId,
          branchId,
          serviceId: service.id,
          vehicleId: vehicle.id,
        }),
      );
    }, 30000);
    it("pages 25 plus 3 assigned records with matching scope, private responses and minimal projection", async () => {
      const first = await get(identities[6]!, { q: "q104" });
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(workforceResponseSchema("jobs").safeParse(first.body.data).success).toBe(
        true,
      );
      expect(first.body.data.items).toHaveLength(25);
      expect(first.body.data.access.staffId).toBeTruthy();
      const second = await get(identities[6]!, {
        q: "q104",
        cursor: first.body.data.nextCursor,
      });
      expect(second.status).toBe(200);
      expect(second.body.data.items).toHaveLength(3);
      expect(second.body.data.nextCursor).toBeUndefined();
      const items = [...first.body.data.items, ...second.body.data.items];
      expect(items.map((item: { id: string }) => item.id)).toEqual([...ownIds].sort());
      expect(JSON.stringify(items)).not.toContain("Restricted note");
      expect(JSON.stringify(items)).not.toContain("customerId");
      expect(JSON.stringify(items)).not.toContain("passwordHash");
    });
    it("keeps branch lead and assigned technician visibility distinct", async () => {
      const response = await get(identities[5]!, { q: "q104", limit: 50 });
      expect(response.status).toBe(200);
      expect(
        response.body.data.items.map((item: { id: string }) => item.id).sort(),
      ).toEqual([...ownIds, otherId].sort());
      expect(
        response.body.data.items.map((item: { id: string }) => item.id),
      ).not.toContain(foreignId);
    });
    it("searches service, vehicle and work order with literal wildcard characters", async () => {
      for (const q of ["%", "_", "Special%_"]) {
        const response = await get(identities[6]!, { q });
        expect(response.status).toBe(200);
        expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([
          specialId,
        ]);
      }
      for (const q of ["tOyOtA", "q104 corolla", "phc-q104-test"]) {
        const response = await get(identities[6]!, { q, limit: 50 });
        expect(response.body.data.items).toHaveLength(28);
      }
      const job = await prisma.workOrder.findUniqueOrThrow({
        where: { bookingId: ownIds[0]! },
      });
      const response = await get(identities[6]!, {
        q: job.workOrderNumber.toLowerCase(),
      });
      expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([
        ownIds[0],
      ]);
    });
    it("combines all work-order statuses and not-created with search without conflating booking state", async () => {
      for (const workStatus of [...statuses, "NOT_CREATED"]) {
        const response = await get(identities[6]!, { q: "Q104", workStatus, limit: 50 });
        expect(response.status).toBe(200);
        const expected = await prisma.booking.findMany({
          where: {
            id: { in: ownIds },
            workOrder:
              workStatus === "NOT_CREATED"
                ? { is: null }
                : { is: { status: workStatus as (typeof statuses)[number] } },
          },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual(
          expected.map((item) => item.id),
        );
        expect(
          response.body.data.items.every(
            (item: { status: string }) => item.status === "CONFIRMED",
          ),
        ).toBe(true);
      }
      expect((await get(identities[6]!, { q: "absent-Q104" })).body.data.items).toEqual(
        [],
      );
    });
    it("rejects unsupported filters, weak MFA and nontechnical or revoked accounts", async () => {
      for (const query of [
        { branchId },
        { workStatus: "UNKNOWN" },
        { cursor: "invalid" },
        { q: "x".repeat(121) },
        { q: "a\u0000b" },
        { limit: 51 },
      ])
        expect((await get(identities[6]!, query)).status).toBe(422);
      for (const index of [0, 4, 7, 8, 10, 11])
        expect((await get(identities[index]!)).status).toBe(403);
      expect((await get(identities[9]!)).status).toBe(401);
      expect((await get(weak)).status).toBe(403);
    });
    it("preserves the bookings query and response contract", async () => {
      const rejected = await request(app)
        .get("/api/v1/staff/workforce/bookings?q=Q104")
        .set(identities[0]!);
      expect(rejected.status).toBe(422);
      const response = await request(app)
        .get("/api/v1/staff/workforce/bookings")
        .set(identities[0]!);
      expect(response.status).toBe(200);
      successfulReads++;
      expect(response.body.data).not.toHaveProperty("access");
      expect(response.body.data).not.toHaveProperty("generatedAt");
    });
    afterAll(async () => {
      if (guarded) {
        await prisma.session.deleteMany({ where: { id: { in: sessions } } });
        const after = await rows();
        const preserved = after.map((table, index) =>
          table.filter((row) =>
            originals[index]!.includes(
              index === 7
                ? (row as { userId: string }).userId
                : (row as { id: string }).id,
            ),
          ),
        );
        expect(digest(preserved)).toBe(beforeHash);
        const auditDelta = (await prisma.auditLog.count()) - auditBefore;
        expect(auditDelta).toBe(successfulReads);
        const temporarySessionsRemaining = await prisma.session.count({
          where: { id: { in: sessions } },
        });
        expect(temporarySessionsRemaining).toBe(0);
        writeFileSync(
          evidence,
          JSON.stringify({
            originalRowsUnchanged: true,
            originalCounts: originals.map((ids) => ids.length),
            retainedJobs: ownIds.length + (otherId ? 1 : 0) + (foreignId ? 1 : 0),
            successfulReads,
            auditDelta,
            temporarySessionsRemaining,
          }),
        );
      }
      await prisma.$disconnect();
    });
  },
);
