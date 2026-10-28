import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { WorkforceWorkService } from "../../src/modules/organization/workforce-work.service.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { SupportService } from "../../src/modules/support/support.service.js";
import { SupportCustomerEmailWorker } from "../../src/workers/support-customer-email.worker.js";
import type { TransactionalEmail } from "../../src/providers/messaging/email-provider.port.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "support replies and durable customer email",
  () => {
    const service = new SupportService(prisma);
    const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
    const original = { ...env };
    let admin: AuthenticatedActor,
      customer: AuthenticatedActor,
      otherStaff: AuthenticatedActor;
    let branchId: string, customerId: string;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Synthetic email workshop",
          address: "Synthetic",
          city: "Synthetic",
          state: "Synthetic",
        },
      });
      branchId = branch.id;
      async function user(role: "ADMIN" | "CUSTOMER" | "STAFF") {
        const row = await prisma.user.create({
          data: {
            email: `${randomUUID()}@example.test`,
            passwordHash: "unusable-synthetic",
            role,
            emailVerifiedAt: new Date(),
          },
        });
        return {
          userId: row.id,
          email: row.email,
          role,
          sessionId: randomUUID(),
          mfaRequired: role !== "CUSTOMER",
          mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
        };
      }
      admin = await user("ADMIN");
      customer = await user("CUSTOMER");
      otherStaff = await user("STAFF");
      customerId = (
        await prisma.customerProfile.create({
          data: {
            userId: customer.userId,
            firstName: "Synthetic",
            lastName: "Customer",
            phone: "+2348000000000",
          },
        })
      ).id;
      const otherBranch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Other synthetic",
          address: "Synthetic",
          city: "Synthetic",
          state: "Synthetic",
        },
      });
      await prisma.staffProfile.create({
        data: {
          userId: otherStaff.userId,
          firstName: "Other",
          lastName: "Staff",
          branchId: otherBranch.id,
        },
      });
      Object.assign(env, {
        EMAIL_DELIVERY_ENABLED: true,
        DEPARTMENT_SUPPORT_EMAIL: "support@example.test",
      });
    });
    afterAll(async () => {
      Object.assign(env, original);
      await prisma.$disconnect();
    });
    async function enquiry(linked = false) {
      return prisma.enquiry.create({
        data: {
          branchId,
          type: "GENERAL",
          name: "Synthetic",
          email: "guest@example.test",
          subject: "Synthetic email check",
          message: "Synthetic question",
          ...(linked ? { customerId } : {}),
        },
      });
    }
    it("atomically saves a guest reply, sends its body with Support Reply-To, and reports provider acceptance", async () => {
      const row = await enquiry();
      await service.addStaffMessage(
        admin,
        "enquiry",
        row.id,
        { message: "Guest answer <script>escaped</script>", visibility: "CUSTOMER" },
        context,
      );
      expect(
        (await service.emailDeliveries(admin, "enquiry", row.id, context)).items[0]
          ?.status,
      ).toBe("QUEUED");
      const sent: TransactionalEmail[] = [];
      const worker = new SupportCustomerEmailWorker(
        {
          send: async (message) => {
            sent.push(message);
          },
        },
        prisma,
      );
      await worker.runOnce();
      const email = sent.find((m) => m.text.includes(row.id));
      expect(email).toMatchObject({
        to: "guest@example.test",
        replyTo: "support@example.test",
      });
      expect(email?.text).toContain("Guest answer");
      expect(email?.html).toContain("&lt;script&gt;");
      const receipt = (await service.emailDeliveries(admin, "enquiry", row.id, context))
        .items[0];
      expect(receipt?.status).toBe("SENT");
      expect(receipt?.sentAt).toBeTruthy();
      await worker.runOnce();
      expect(sent.filter((m) => m.text.includes(row.id))).toHaveLength(1);
    });
    it("saves internal notes and assignments without customer email", async () => {
      const row = await enquiry();
      await service.addStaffMessage(
        admin,
        "enquiry",
        row.id,
        { message: "Staff-only note", visibility: "INTERNAL" },
        context,
      );
      await service.assign(
        admin,
        "enquiry",
        row.id,
        { expectedVersion: 0, assignedStaffId: null },
        context,
      );
      expect(
        (await service.emailDeliveries(admin, "enquiry", row.id, context)).items,
      ).toEqual([]);
    });
    it("queues one combined resolution and rejects stale repeats without another email", async () => {
      const row = await enquiry();
      const input = {
        expectedVersion: 0,
        status: "RESOLVED" as const,
        response: "This is the final response",
      };
      await service.transitionEnquiry(admin, row.id, input, context);
      await expect(
        service.transitionEnquiry(admin, row.id, input, context),
      ).rejects.toThrow();
      expect(
        (await service.emailDeliveries(admin, "enquiry", row.id, context)).items,
      ).toHaveLength(1);
      expect(await prisma.supportMessage.count({ where: { enquiryId: row.id } })).toBe(1);
    });
    it("creates an account notification but suppresses email when the customer opts out", async () => {
      const row = await enquiry(true);
      await prisma.notificationPreference.create({
        data: {
          userId: customer.userId,
          category: "OPERATIONAL",
          channel: "EMAIL",
          enabled: false,
        },
      });
      await service.addStaffMessage(
        admin,
        "enquiry",
        row.id,
        { message: "Account-only response", visibility: "CUSTOMER" },
        context,
      );
      expect(
        (await service.emailDeliveries(admin, "enquiry", row.id, context)).items[0],
      ).toMatchObject({ status: "NOT_SENT", reason: "CONSENT_WITHDRAWN" });
      expect(
        await prisma.notification.count({
          where: { userId: customer.userId, resourceId: row.id },
        }),
      ).toBe(1);
      expect(
        await prisma.notificationDelivery.count({
          where: { notification: { resourceId: row.id } },
        }),
      ).toBe(0);
    });
    it("does not expose delivery metadata to customers or another branch", async () => {
      const row = await enquiry();
      await expect(
        service.emailDeliveries(customer, "enquiry", row.id, context),
      ).rejects.toThrow();
      await expect(
        service.emailDeliveries(otherStaff, "enquiry", row.id, context),
      ).rejects.toThrow();
    });
    it("notifies from the responsibility-based staff workspace and keeps its delivery view scoped", async () => {
      await prisma.session.create({
        data: {
          id: admin.sessionId,
          userId: admin.userId,
          tokenHash: hashToken("session", randomUUID()),
          createdAt: new Date(Date.now() - 1000),
          expiresAt: new Date(Date.now() + 3600000),
          idleExpiresAt: new Date(Date.now() + 3600000),
          mfaRequired: true,
          mfaVerifiedAt: new Date(),
        },
      });
      await prisma.workforceAccess.create({
        data: {
          userId: admin.userId,
          position: "CUSTOMER_SERVICE",
          updatedByUserId: admin.userId,
          assignments: {
            create: {
              template: "CUSTOMER_SERVICE",
              branchId,
              scope: "BRANCH",
              startsAt: new Date(Date.now() - 1000),
              reason: "Synthetic customer care test",
              assignedByUserId: admin.userId,
            },
          },
        },
      });
      const workforce = new WorkforceWorkService();
      const row = await enquiry();
      await workforce.reply(
        admin,
        row.id,
        { expectedVersion: 0, body: "Role-scoped staff reply" },
        context,
      );
      const result = await workforce.enquiry(admin, row.id, { limit: 25 }, context);
      expect(result.emailDeliveries.items).toHaveLength(1);
      expect(result.emailDeliveries.items[0]?.status).toBe("QUEUED");
      await expect(
        workforce.reply(
          admin,
          row.id,
          { expectedVersion: 0, body: "Stale repeated reply" },
          context,
        ),
      ).rejects.toThrow();
      expect(
        (await workforce.enquiry(admin, row.id, { limit: 25 }, context)).emailDeliveries
          .items,
      ).toHaveLength(1);
    });
    it("sends one complaint acknowledgement and records failed delivery for manual follow-up", async () => {
      const row = await prisma.complaint.create({
        data: {
          branchId,
          name: "Synthetic",
          email: "guest@example.test",
          subject: "Synthetic complaint",
          description: "Synthetic complaint text",
        },
      });
      await service.acknowledgeComplaint(
        admin,
        row.id,
        "We received your complaint",
        context,
      );
      await service.acknowledgeComplaint(
        admin,
        row.id,
        "Repeated acknowledgement",
        context,
      );
      expect(
        (await service.emailDeliveries(admin, "complaint", row.id, context)).items,
      ).toHaveLength(1);
      // Force the final permitted attempt on this synthetic outbox record only.
      await prisma.outboxEvent.updateMany({
        where: { aggregateType: "SupportCustomerEmail", aggregateId: row.id },
        data: { attempts: 7 },
      });
      await new SupportCustomerEmailWorker(
        {
          send: async () => {
            throw Error("Synthetic provider outage");
          },
        },
        prisma,
      ).runOnce();
      expect(
        (await service.emailDeliveries(admin, "complaint", row.id, context)).items[0]
          ?.status,
      ).toBe("FAILED");
    });
  },
);
