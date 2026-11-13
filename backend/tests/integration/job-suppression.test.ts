import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { AuditOperationsService } from "../../src/modules/audit/audit.service.js";
import { supportDeliverySuppressionReasons } from "../../src/modules/audit/job-delivery-diagnostic.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "support job suppression boundary",
  () => {
    const operations = new AuditOperationsService(prisma);
    const jobs: string[] = [];
    const context = {
      requestId: "synthetic-job-suppression",
      ipAddress: null,
      userAgent: null,
    };
    let actor: AuthenticatedActor;
    let cookie: string;
    let verifiedTarget = false;
    beforeAll(async () => {
      const target = await prisma.$queryRaw<
        { database: string; host: string }[]
      >`SELECT current_database() AS database, host(inet_server_addr()) AS host`;
      expect(target[0]?.database).toMatch(/_(test|ci)$/);
      expect(target[0]?.database).toBe(process.env.TEST_DB_NAME);
      expect(["127.0.0.1", "::1"]).toContain(target[0]?.host);
      verifiedTarget = true;
      const user = await prisma.user.create({
        data: {
          email: `suppression-${randomUUID()}@example.test`,
          passwordHash: "unusable",
          role: "ADMIN",
          emailVerifiedAt: new Date(),
        },
      });
      const now = new Date(),
        expiry = new Date(Date.now() + 3600000);
      const token = randomUUID();
      cookie = `${sessionCookieName}=${token}`;
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", randomUUID()),
          createdAt: now,
          lastRotatedAt: now,
          expiresAt: expiry,
          idleExpiresAt: expiry,
          mfaRequired: true,
          mfaVerifiedAt: now,
        },
      });
      actor = {
        userId: user.id,
        email: user.email,
        role: "ADMIN",
        sessionId: session.id,
        mfaRequired: true,
        mfaVerifiedAt: now,
      };
    });
    afterEach(async () => {
      if (!verifiedTarget) return;
      // Only task-owned synthetic jobs in the verified isolated target; keep history.
      await prisma.outboxEvent.updateMany({
        where: { id: { in: jobs }, status: "PENDING" },
        data: { status: "DEAD_LETTER" },
      });
    });
    afterAll(async () => {
      await prisma.$disconnect();
    });
    async function fixture(
      lastError: string | null,
      eventType = "support.customer-email.requested",
    ) {
      const row = await prisma.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "SupportCustomerEmail",
          aggregateId: randomUUID(),
          eventType,
          status: "DEAD_LETTER",
          attempts: 0,
          lastError,
          payload: { privateCanary: "DO-NOT-RETURN" },
        },
      });
      jobs.push(row.id);
      return row;
    }
    const retry = (row: { id: string; updatedAt: Date }) =>
      operations.retryJob(
        actor,
        "outbox",
        row.id,
        {
          expectedAttempts: 0,
          expectedUpdatedAt: row.updatedAt.toISOString(),
          reason: "Synthetic isolated reviewed retry",
        },
        context,
      );
    it("preserves legacy HTTP shape and accepts only the explicit safe diagnostic query", async () => {
      const row = await fixture("CONSENT_WITHDRAWN");
      const app = createApp({ checkReadiness: async () => undefined });
      const path = "/api/v1/admin/operations/jobs/outbox/" + row.id;
      const get = () => request(app).get(path).set("Cookie", cookie);
      const legacy = await get();
      expect(legacy.status).toBe(200);
      expect(legacy.body.data).not.toHaveProperty("deliverySuppressionReason");
      const scoped = await get().query({ diagnostics: "safe_delivery" });
      expect(scoped.status).toBe(200);
      expect(scoped.body.data.deliverySuppressionReason).toBe("CONSENT_WITHDRAWN");
      expect(scoped.body.data).not.toHaveProperty("lastError");
      expect(JSON.stringify(scoped.body.data)).not.toContain("DO-NOT-RETURN");
      expect((await get().query({ diagnostics: "raw" })).status).toBe(422);
      expect((await get().query({ diagnostics: ["safe_delivery", "raw"] })).status).toBe(
        422,
      );
    });
    it.each(supportDeliverySuppressionReasons)(
      "explains %s and preserves the restriction on retry",
      async (reason) => {
        const row = await fixture(reason);
        const inspected = await operations.job(actor, "outbox", row.id, context, true);
        expect(inspected).toMatchObject({ deliverySuppressionReason: reason });
        expect(inspected).not.toHaveProperty("lastError");
        expect(JSON.stringify(inspected)).not.toContain("DO-NOT-RETURN");
        await expect(retry(row)).rejects.toMatchObject({ statusCode: 409 });
        const after = await prisma.outboxEvent.findUniqueOrThrow({
          where: { id: row.id },
        });
        expect(after).toMatchObject({
          status: "DEAD_LETTER",
          lastError: reason,
          attempts: 0,
          updatedAt: row.updatedAt,
        });
      },
    );
    it.each([null, "PRIVATE-UNKNOWN-ERROR"])(
      "keeps unknown reason %s private without inventing suppression",
      async (reason) => {
        const row = await fixture(reason);
        expect(await operations.job(actor, "outbox", row.id, context)).toMatchObject({
          deliverySuppressionReason: null,
        });
        await expect(retry(row)).resolves.toMatchObject({ status: "RETRY_REQUESTED" });
      },
    );
    it("rechecks suppression atomically even when the caller omits a legacy revision", async () => {
      const row = await fixture(null);
      await operations.job(actor, "outbox", row.id, context);
      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: { lastError: "CONSENT_WITHDRAWN" },
      });
      await expect(
        operations.retryJob(
          actor,
          "outbox",
          row.id,
          { expectedAttempts: 0, reason: "Legacy stale review" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("does not classify unrelated events or allow lower-role inspection", async () => {
      const row = await fixture("CONSENT_WITHDRAWN", "synthetic.other-event");
      expect(await operations.job(actor, "outbox", row.id, context)).toMatchObject({
        deliverySuppressionReason: null,
      });
      await expect(retry(row)).resolves.toMatchObject({ status: "RETRY_REQUESTED" });
      for (const role of ["CUSTOMER", "STAFF"] as const) {
        await expect(
          operations.job({ ...actor, role }, "outbox", row.id, context, true),
        ).rejects.toMatchObject({ statusCode: 403 });
      }
    });
  },
);
