import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { AuditOperationsService } from "../../src/modules/audit/audit.service.js";
import {
  currentOperationalJobResponseSchema,
  operationalJobsResponseSchema,
} from "../../src/modules/audit/operations-response.schemas.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
const path = "/api/v1/admin/operations/jobs",
  context = { requestId: "work-jobs", ipAddress: null, userAgent: null };
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "current processing-job workspace",
  () => {
    const sessions: string[] = [],
      ids = Array.from({ length: 28 }, () => randomUUID())
        .sort()
        .reverse();
    const originals = {
      users: [] as string[],
      outbox: [] as string[],
      webhook: [] as string[],
      audit: [] as string[],
      notifications: [] as string[],
      deliveries: [] as string[],
    };
    const hash = (v: unknown) =>
      createHash("sha256").update(JSON.stringify(v)).digest("hex");
    let admin: Awaited<ReturnType<typeof auth>>,
      owner: Awaited<ReturnType<typeof auth>>,
      staff: Awaited<ReturnType<typeof auth>>,
      before: string,
      counts: number[],
      notificationJob: string,
      mismatchedJob: string,
      deliveryId: string,
      lifecycleWebhookId: string;
    const snapshot = () =>
      Promise.all([
        prisma.user.findMany({
          where: { id: { in: originals.users } },
          orderBy: { id: "asc" },
        }),
        prisma.customerProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.privilegedInvitation.findMany({ orderBy: { id: "asc" } }),
        prisma.outboxEvent.findMany({
          where: { id: { in: originals.outbox } },
          orderBy: { id: "asc" },
        }),
        prisma.paymentWebhookEvent.findMany({
          where: { id: { in: originals.webhook } },
          orderBy: { id: "asc" },
        }),
        prisma.auditLog.findMany({
          where: { id: { in: originals.audit } },
          orderBy: { id: "asc" },
        }),
        prisma.notification.findMany({
          where: { id: { in: originals.notifications } },
          orderBy: { id: "asc" },
        }),
        prisma.notificationDelivery.findMany({
          where: { id: { in: originals.deliveries } },
          orderBy: { id: "asc" },
        }),
        prisma.userCapability.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
      ]);
    async function auth(userId: string, assured = true) {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiresAt = new Date(Date.now() + 3600000);
      const row = await prisma.session.create({
        data: {
          userId,
          createdAt: new Date(Date.now() - 1000),
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt,
          idleExpiresAt: expiresAt,
          mfaRequired: true,
          mfaVerifiedAt: assured ? new Date() : null,
        },
      });
      sessions.push(row.id);
      return {
        userId,
        sessionId: row.id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "X-CSRF-Token": csrf,
        },
      };
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
      const continueLifecycle = process.env.WORK_JOBS_CONTINUE_LIFECYCLE === "true";
      if (existsSync(process.env.WORK_JOBS_FIXTURES!) && !continueLifecycle)
        throw Error("Retained job fixtures exist; use an explicit focused continuation");
      const resumeSetup = process.env.WORK_JOBS_RESUME_SETUP === "true";
      const retainedJobs = resumeSetup
        ? await prisma.outboxEvent.findMany({
            where: { eventType: "synthetic.work.jobs", aggregateType: "SyntheticJobs" },
            select: { id: true, updatedAt: true },
            orderBy: { id: "desc" },
          })
        : [];
      const retainedUsers = resumeSetup
        ? await prisma.user.findMany({
            where: { email: { startsWith: "work-jobs-", endsWith: "@example.test" } },
            select: { id: true },
          })
        : [];
      if (resumeSetup) {
        expect(retainedJobs).toHaveLength(28);
        expect(retainedUsers).toHaveLength(1);
        expect(
          await prisma.paymentWebhookEvent.count({
            where: { id: { in: retainedJobs.map((v) => v.id) } },
          }),
        ).toBe(0);
        ids.splice(0, ids.length, ...retainedJobs.map((v) => v.id));
      }
      const base = JSON.parse(
        readFileSync(process.env.WORK_STAFF_WORKFORCE_FIXTURES!, "utf8"),
      );
      originals.users = (await prisma.user.findMany({ select: { id: true } })).map(
        (v) => v.id,
      );
      originals.outbox = (
        await prisma.outboxEvent.findMany({ select: { id: true } })
      ).map((v) => v.id);
      originals.webhook = (
        await prisma.paymentWebhookEvent.findMany({ select: { id: true } })
      ).map((v) => v.id);
      originals.audit = (await prisma.auditLog.findMany({ select: { id: true } })).map(
        (v) => v.id,
      );
      originals.notifications = (
        await prisma.notification.findMany({ select: { id: true } })
      ).map((v) => v.id);
      originals.deliveries = (
        await prisma.notificationDelivery.findMany({ select: { id: true } })
      ).map((v) => v.id);
      if (resumeSetup) {
        originals.users = originals.users.filter((id) => id !== retainedUsers[0]!.id);
        originals.outbox = originals.outbox.filter((id) => !ids.includes(id));
      }
      if (continueLifecycle) {
        const retained = JSON.parse(
          readFileSync(process.env.WORK_JOBS_FIXTURES!, "utf8"),
        );
        ids.splice(0, ids.length, ...retained.ids);
        originals.outbox = originals.outbox.filter((id) => id !== ids[2]);
        if (retained.lifecycleWebhook)
          throw Error("Lifecycle continuation already created its verified fixture");
        const initial = await snapshot();
        before = hash(initial);
        counts = initial.map((v) => v.length);
        admin = await auth(retained.admin);
        owner = await auth(retained.owner);
        const lifecycleId = randomUUID(),
          now = new Date();
        const verified = await prisma.paymentWebhookEvent.create({
          data: {
            id: lifecycleId,
            provider: "PAYSTACK",
            eventType: "synthetic.work.jobs.lifecycle",
            deduplicationKey: hash(lifecycleId),
            payloadSha256: hash(lifecycleId),
            status: "RECEIVED",
            signatureVerifiedAt: now,
            providerVerifiedAt: now,
          },
        });
        lifecycleWebhookId = verified.id;
        writeFileSync(
          process.env.WORK_JOBS_FIXTURES!,
          JSON.stringify({ ...retained, lifecycleWebhook: verified.id }, null, 2),
        );
        return;
      }
      const initial = await snapshot();
      before = hash(initial);
      counts = initial.map((v) => v.length);
      const user = resumeSetup
        ? retainedUsers[0]!
        : await prisma.user.create({
            data: {
              email: `work-jobs-${randomUUID()}@example.test`,
              role: "ADMIN",
              passwordHash: "unusable-isolated",
              emailVerifiedAt: new Date(),
            },
          });
      admin = await auth(user.id);
      owner = await auth(base.owner);
      staff = await auth(base.staffId);
      const at = resumeSetup
        ? retainedJobs[0]!.updatedAt
        : new Date(Date.now() + 3600000);
      if (!resumeSetup)
        await prisma.outboxEvent.createMany({
          data: ids.map((id) => ({
            id,
            eventId: randomUUID(),
            aggregateType: "SyntheticJobs",
            aggregateId: id,
            eventType: "synthetic.work.jobs",
            payload: { private: "PRIVATE-JOB-CANARY" },
            status: "FAILED",
            attempts: 0,
            availableAt: at,
            updatedAt: at,
            lastError: "PRIVATE-JOB-CANARY",
          })),
        });
      await prisma.paymentWebhookEvent.createMany({
        data: ids.map((id) => ({
          id,
          provider: "PAYSTACK",
          deduplicationKey: hash(id),
          payloadSha256: hash(id),
          redactedPayload: { private: "PRIVATE-JOB-CANARY" },
          eventType: "synthetic.work.jobs",
          status: "FAILED",
          processingAttempts: 0,
          signatureVerifiedAt: at,
          providerVerifiedAt: at,
          failedAt: at,
          updatedAt: at,
          lastErrorMessage: "PRIVATE-JOB-CANARY",
          lastErrorCode: "PRIVATE-JOB-CANARY",
        })),
      });
      lifecycleWebhookId = ids[2]!;
      const note = await prisma.notification.create({
        data: {
          userId: user.id,
          type: "SYSTEM",
          title: "Synthetic retry",
          message: "PRIVATE-JOB-CANARY",
        },
      });
      const createNotificationJob = () =>
        prisma.outboxEvent.create({
          data: {
            eventId: randomUUID(),
            aggregateType: "NOTIFICATION",
            aggregateId: note.id,
            eventType: "notification.delivery.requested",
            payload: { private: "PRIVATE-JOB-CANARY" },
            status: "DEAD_LETTER",
            attempts: 0,
          },
        });
      notificationJob = (await createNotificationJob()).id;
      mismatchedJob = (await createNotificationJob()).id;
      deliveryId = (
        await prisma.notificationDelivery.create({
          data: {
            notificationId: note.id,
            outboxEventId: notificationJob,
            channel: "EMAIL",
            status: "DEAD_LETTER",
            attempts: 0,
          },
        })
      ).id;
      writeFileSync(
        process.env.WORK_JOBS_FIXTURES!,
        JSON.stringify(
          {
            ids,
            admin: user.id,
            owner: base.owner,
            notificationJob,
            mismatchedJob,
            deliveryId,
          },
          null,
          2,
        ),
      );
    });
    afterAll(async () => {
      try {
        if (before) expect(hash(await snapshot())).toBe(before);
      } finally {
        await prisma.session.deleteMany({ where: { id: { in: sessions } } });
        expect(await prisma.session.count({ where: { id: { in: sessions } } })).toBe(0);
      }
      if (before)
        writeFileSync(
          process.env.WORK_JOBS_FIXTURES!.replace("fixtures.json", "preservation.json"),
          JSON.stringify(
            {
              originalCounts: counts,
              originalRowsUnchanged: true,
              ownedSessionsRemaining: 0,
            },
            null,
            2,
          ),
        );
    });
    const read = (source: string, id: string, who = admin) =>
      request(app).get(`${path}/${source}/${id}`).set(who.headers);
    const retry = (source: string, id: string, body: object, who = admin) =>
      request(app).post(`${path}/${source}/${id}/retry`).set(who.headers).send(body);
    it("preserves signed mixed-source paging, safe nullable diagnostic keys and exact READ auditing", async () => {
      const beforeReads = await prisma.auditLog.count({
        where: { userId: admin.userId, action: "READ" },
      });
      let cursor: string | undefined;
      const seen: string[] = [];
      for (let n = 0; n < 3; n++) {
        const response = await request(app)
          .get(path)
          .set(admin.headers)
          .query({ status: "FAILED", limit: 25, ...(cursor ? { cursor } : {}) });
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("private, no-store");
        const data = operationalJobsResponseSchema.parse(response.body.data);
        expect(JSON.stringify(data)).not.toContain("PRIVATE-JOB-CANARY");
        seen.push(
          ...data.items
            .filter((v) => ids.includes(v.id))
            .map((v) => `${v.id}:${v.source}`),
        );
        cursor = data.nextCursor;
        for (const row of data.items)
          expect(
            row.source === "OUTBOX" ? row.lastError : row.lastErrorMessage,
          ).toBeNull();
      }
      expect(seen).toEqual(
        ids.flatMap((id) => [`${id}:PAYMENT_WEBHOOK`, `${id}:OUTBOX`]),
      );
      expect(
        (await prisma.auditLog.count({
          where: { userId: admin.userId, action: "READ" },
        })) - beforeReads,
      ).toBe(3);
      const first = await request(app)
        .get(path)
        .set(admin.headers)
        .query({ source: "OUTBOX", status: "FAILED", limit: 25 });
      expect(first.body.data.items.map((v: { id: string }) => v.id)).toEqual(
        ids.slice(0, 25),
      );
      const next = first.body.data.nextCursor;
      expect(
        (
          await request(app)
            .get(path)
            .set(owner.headers)
            .query({ source: "OUTBOX", status: "FAILED", cursor: next })
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .get(path)
            .set(admin.headers)
            .query({ source: "PAYMENT_WEBHOOK", status: "FAILED", cursor: next })
        ).status,
      ).toBe(422);
      const second = await request(app)
        .get(path)
        .set(admin.headers)
        .query({ source: "OUTBOX", status: "FAILED", cursor: next });
      expect(second.body.data.items.slice(0, 3).map((v: { id: string }) => v.id)).toEqual(
        ids.slice(25),
      );
    });
    it("checks inspected revision and attempts, permits zero and queues once under competing retries", async () => {
      for (const source of ["outbox", "webhook"]) {
        const current = await read(source, ids[0]!);
        expect(current.status).toBe(200);
        const row = currentOperationalJobResponseSchema.parse(current.body.data);
        expect(JSON.stringify(row)).not.toMatch(
          /PRIVATE-JOB-CANARY|lastError|payload|deduplication/,
        );
        const body = {
          expectedAttempts: 0,
          expectedUpdatedAt: row.updatedAt,
          reason: "Previous outcome reconciled",
        };
        expect(
          (
            await retry(source, row.id, {
              ...body,
              expectedUpdatedAt: "2020-01-01T00:00:00Z",
            })
          ).status,
        ).toBe(409);
        const answers = await Promise.all([
          retry(source, row.id, body),
          retry(source, row.id, body),
        ]);
        expect(answers.map((v) => v.status).sort()).toEqual([200, 409]);
        expect(answers.find((v) => v.status === 200)!.body.data).toEqual({
          id: row.id,
          source,
          status: "RETRY_REQUESTED",
          attempts: 0,
        });
        const after = await read(source, row.id);
        expect(after.body.data.status).toBe(source === "outbox" ? "PENDING" : "RECEIVED");
        expect(
          await prisma.auditLog.count({
            where: {
              userId: admin.userId,
              action: "STATUS_CHANGE",
              entityId: row.id,
              entityType: source === "outbox" ? "USER" : "PAYMENT",
            },
          }),
        ).toBe(1);
      }
      expect(
        (await retry("outbox", ids[1]!, { expectedAttempts: 1, reason: "Wrong attempt" }))
          .status,
      ).toBe(409);
      expect(
        (
          await retry("outbox", ids[1]!, {
            expectedAttempts: 0,
            reason: "Legacy caller without revision",
          })
        ).status,
      ).toBe(200);
    });
    it("atomically resets matching notification delivery and rolls back a missing delivery", async () => {
      const beforeMissing = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: mismatchedJob },
      });
      expect(
        (
          await retry("outbox", mismatchedJob, {
            expectedAttempts: 0,
            reason: "Inspect missing delivery",
          })
        ).status,
      ).toBe(409);
      expect(
        await prisma.outboxEvent.findUniqueOrThrow({ where: { id: mismatchedJob } }),
      ).toEqual(beforeMissing);
      expect(
        (
          await retry(
            "outbox",
            notificationJob,
            { expectedAttempts: 0, reason: "Disabled provider reconciled" },
            owner,
          )
        ).status,
      ).toBe(200);
      expect(
        await prisma.notificationDelivery.findUniqueOrThrow({
          where: { id: deliveryId },
        }),
      ).toMatchObject({ status: "PENDING", attempts: 0, deliveredAt: null });
      expect(
        await prisma.outboxEvent.findUniqueOrThrow({ where: { id: notificationJob } }),
      ).toMatchObject({ status: "PENDING", attempts: 0, lockedAt: null });
      expect(
        await prisma.auditLog.count({
          where: { action: "STATUS_CHANGE", entityId: notificationJob },
        }),
      ).toBe(1);
    });
    it("inspects every real lifecycle state without broadening the retryable states", async () => {
      for (const status of [
        "PENDING",
        "PROCESSING",
        "PUBLISHED",
        "FAILED",
        "DEAD_LETTER",
      ] as const) {
        await prisma.outboxEvent.update({
          where: { id: ids[2]! },
          data: {
            status,
            lockedAt: status === "PROCESSING" ? new Date() : null,
            publishedAt: status === "PUBLISHED" ? new Date() : null,
          },
        });
        const response = await read("outbox", ids[2]!, owner);
        expect(response.status).toBe(200);
        expect(currentOperationalJobResponseSchema.parse(response.body.data).status).toBe(
          status,
        );
        if (!["FAILED", "DEAD_LETTER"].includes(status))
          expect(
            (
              await retry("outbox", ids[2]!, {
                expectedAttempts: 0,
                reason: "Unsupported active state",
              })
            ).status,
          ).toBe(409);
      }
      for (const status of [
        "RECEIVED",
        "PROCESSING",
        "PROCESSED",
        "FAILED",
        "DEAD_LETTER",
      ] as const) {
        await prisma.paymentWebhookEvent.update({
          where: { id: lifecycleWebhookId },
          data: {
            status,
            lockedAt: status === "PROCESSING" ? new Date() : null,
            processedAt: status === "PROCESSED" ? new Date() : null,
            failedAt: ["FAILED", "DEAD_LETTER"].includes(status) ? new Date() : null,
          },
        });
        const response = await read("webhook", lifecycleWebhookId);
        expect(response.status).toBe(200);
        expect(currentOperationalJobResponseSchema.parse(response.body.data).status).toBe(
          status,
        );
      }
      expect((await read("outbox", randomUUID())).status).toBe(404);
      expect(
        (await request(app).get(`${path}/outbox/${ids[0]}?extra=true`).set(admin.headers))
          .status,
      ).toBe(422);
    });
    it("enforces Staff/MFA/CSRF and current suspended or revoked actors without changes", async () => {
      expect((await read("outbox", ids[3]!, staff)).status).toBe(403);
      const unverified = await auth(admin.userId, false);
      expect((await read("outbox", ids[3]!, unverified)).status).toBe(403);
      expect(
        (
          await request(app)
            .post(`${path}/outbox/${ids[3]}/retry`)
            .set({ Cookie: admin.headers.Cookie, Origin: admin.headers.Origin })
            .send({ expectedAttempts: 0, reason: "Missing token" })
        ).status,
      ).toBe(403);
      const service = new AuditOperationsService(prisma),
        actor: AuthenticatedActor = {
          userId: admin.userId,
          role: "ADMIN",
          email: "synthetic@example.test",
          sessionId: admin.sessionId,
          mfaRequired: true,
          mfaVerifiedAt: new Date(),
        };
      const beforeAudit = await prisma.auditLog.count({
        where: { userId: admin.userId },
      });
      const check = async () => {
        await expect(service.jobs(actor, { limit: 25 }, context)).rejects.toMatchObject({
          statusCode: 403,
        });
        await expect(
          service.job(actor, "outbox", ids[3]!, context),
        ).rejects.toMatchObject({ statusCode: 403 });
        await expect(
          service.retryJob(
            actor,
            "outbox",
            ids[3]!,
            { expectedAttempts: 0, reason: "Revoked retry" },
            context,
          ),
        ).rejects.toMatchObject({ statusCode: 403 });
      };
      await prisma.user.update({
        where: { id: admin.userId },
        data: { status: "SUSPENDED" },
      });
      try {
        await check();
      } finally {
        await prisma.user.update({
          where: { id: admin.userId },
          data: { status: "ACTIVE" },
        });
      }
      await prisma.session.update({
        where: { id: admin.sessionId },
        data: { revokedAt: new Date() },
      });
      await check();
      expect(await prisma.auditLog.count({ where: { userId: admin.userId } })).toBe(
        beforeAudit,
      );
      expect(
        (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: ids[3]! } })).status,
      ).toBe("FAILED");
    });
  },
);
