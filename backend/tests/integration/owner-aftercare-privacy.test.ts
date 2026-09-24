import { sessionWindow } from "../helpers/session-window.js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { createApp } from "../../src/app.js";
import {
  hashToken,
  generateOpaqueToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { testCapability } from "../helpers/owner-policy.js";
import { OrderAftercareService } from "../../src/modules/orders/order-aftercare.service.js";
import { SupportService } from "../../src/modules/support/support.service.js";
import { assignComplaintDeadline } from "../../src/modules/support/complaint-sla.js";
import { OperationalAlertsWorker } from "../../src/workers/operational-alerts.worker.js";

const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
async function user(role: "CUSTOMER" | "ADMIN") {
  const record = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-isolated-test-hash",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Synthetic",
                lastName: "Aftercare",
                phone: "+2348000000000",
              },
            },
          }
        : { staffProfile: { create: { firstName: "Synthetic", lastName: "Reviewer" } } }),
    },
    include: { profile: true },
  });
  const actor: AuthenticatedActor = {
    userId: record.id,
    email: record.email,
    role,
    sessionId: randomUUID(),
    mfaRequired: role !== "CUSTOMER",
    mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
  };
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken();
  await prisma.session.create({
    data: {
      createdAt: new Date(Date.now() - 1000),
      userId: record.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      ...sessionWindow(3600000),
      mfaRequired: actor.mfaRequired,
      mfaVerifiedAt: actor.mfaVerifiedAt,
    },
  });
  return {
    record,
    actor,
    headers: {
      Origin: "http://localhost:3000",
      Cookie: `${sessionCookieName}=${token}`,
      "X-CSRF-Token": csrf,
    },
  };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Owner aftercare, privacy and complaint controls",
  () => {
    afterAll(() => prisma.$disconnect());
    it("accepts exceptional return timing for review and requires receipt/inspection without restocking", async () => {
      const customer = await user("CUSTOMER"),
        admin = await user("ADMIN");
      await testCapability(admin.record.id, "FINANCE_POLICY_APPROVE");
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Synthetic returns",
          address: "Isolated test",
          city: "Test",
          state: "Test",
        },
      });
      const category = await prisma.category.create({
        data: { name: "Synthetic", slug: randomUUID() },
      });
      const product = await prisma.product.create({
        data: {
          categoryId: category.id,
          name: "Synthetic part",
          slug: randomUUID(),
          sku: randomUUID(),
          priceKobo: 10000n,
        },
      });
      const order = await prisma.order.create({
        data: {
          branchId: branch.id,
          customerId: customer.record.profile!.id,
          orderNumber: randomUUID(),
          customerName: "Synthetic Customer",
          customerEmail: customer.record.email,
          customerPhone: "+2348000000000",
          subtotalKobo: 10000n,
          totalKobo: 10000n,
          status: "COMPLETED",
          completedAt: new Date(Date.now() - 15 * 86400000),
          paidAt: new Date(Date.now() - 20 * 86400000),
          confirmedAt: new Date(Date.now() - 20 * 86400000),
          createdAt: new Date(Date.now() - 20 * 86400000),
          fulfillmentMethod: "DELIVERY",
          deliveryName: "Synthetic Customer",
          deliveryPhone: "+2348000000000",
          deliveryAddress: "Synthetic fixture address",
          deliveryCity: "Test",
          deliveryState: "Test",
          deliveryCountry: "NG",
          fulfillmentEvidenceAt: new Date(Date.now() - 15 * 86400000),
          items: {
            create: {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              quantity: 1,
              unitPriceKobo: 10000n,
              subtotalKobo: 10000n,
            },
          },
        },
      });
      const service = new OrderAftercareService(prisma);
      const record = await service.request(
        customer.actor,
        order.id,
        "Synthetic defective item exception review",
        context,
      );
      expect(record.reviewReason).toContain("MANDATORY_RIGHTS");
      const approve = () =>
        service.process(
          admin.actor,
          record.id,
          {
            stage: "APPROVED",
            approvedFeeKobo: "0",
            note: "Synthetic mandatory-rights review accepts this condition",
          },
          context,
        );
      await expect(approve()).rejects.toMatchObject({ statusCode: 409 });
      await service.process(
        admin.actor,
        record.id,
        { stage: "RECEIVED", note: "Synthetic returned goods received" },
        context,
      );
      await service.process(
        admin.actor,
        record.id,
        {
          stage: "INSPECTED",
          goodCondition: false,
          note: "Synthetic defective-item exception retained for review",
        },
        context,
      );
      const approved = await approve();
      expect(approved.refundDueAt).toBeNull();
      expect(
        await prisma.inventoryTransaction.count({
          where: { referenceId: order.id, type: "RESTOCK" },
        }),
      ).toBe(0);
      const stranger = await user("CUSTOMER");
      await expect(service.list(stranger.actor, order.id)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
    it("blocks privacy approval under a hold and never deletes a reviewed account", async () => {
      const customer = await user("CUSTOMER"),
        reviewer = await user("ADMIN");
      await testCapability(reviewer.record.id, "PRIVACY_REVIEW");
      const app = createApp({ checkReadiness: async () => undefined });
      const intake = await request(app)
        .post("/api/v1/customers/privacy-requests")
        .set(customer.headers)
        .send({
          kind: "DELETION",
          reason: "Synthetic customer request for reviewed deletion",
        });
      expect(intake.status).toBe(201);
      const hold = await request(app)
        .post("/api/v1/staff/retention-holds")
        .set(reviewer.headers)
        .send({
          userId: customer.record.id,
          recordType: "PAYMENT",
          reason: "Synthetic unresolved accounting retention obligation",
        });
      expect(hold.status).toBe(201);
      const review = () =>
        request(app)
          .post(`/api/v1/staff/privacy-requests/${intake.body.data.id}/review`)
          .set(reviewer.headers)
          .send({
            status: "APPROVED_PENDING_POLICY",
            note: "Synthetic reviewed request, no destructive execution",
          });
      expect((await review()).status).toBe(409);
      expect(
        (
          await request(app)
            .post(`/api/v1/staff/retention-holds/${hold.body.data.id}/release`)
            .set(reviewer.headers)
            .send({ reason: "Synthetic accounting clearance evidenced in this fixture" })
        ).status,
      ).toBe(200);
      expect((await review()).status).toBe(200);
      expect(
        await prisma.user.findUnique({ where: { id: customer.record.id } }),
      ).not.toBeNull();
    });
    it("escalates urgent overdue complaints without guessing an email and keeps acknowledgement separate", async () => {
      const admin = await user("ADMIN");
      const complaint = await prisma.complaint.create({
        data: {
          name: "Synthetic Complainant",
          email: "synthetic-complaint@example.test",
          subject: "Synthetic urgent issue",
          description: "Synthetic urgent test issue",
          priority: "URGENT",
          createdAt: new Date("2026-09-19T16:30:00Z"),
        },
      });
      await prisma.$transaction((tx) => assignComplaintDeadline(tx, complaint.id));
      await new OperationalAlertsWorker(prisma).runOnce();
      expect(
        await prisma.operationalAlert.findUnique({
          where: { key: `urgent-complaint:${complaint.id}` },
        }),
      ).toMatchObject({ category: "URGENT_COMPLAINT_OVERDUE" });
      await new SupportService(prisma).acknowledgeComplaint(
        admin.actor,
        complaint.id,
        "We acknowledge this synthetic complaint and are reviewing it",
        context,
      );
      const current = await prisma.complaint.findUniqueOrThrow({
        where: { id: complaint.id },
      });
      expect(current.acknowledgedAt).not.toBeNull();
      expect(current.resolvedAt).toBeNull();
      expect(current.status).toBe("OPEN");
      await new OperationalAlertsWorker(prisma).runOnce();
      expect(
        (
          await prisma.operationalAlert.findUniqueOrThrow({
            where: { key: `urgent-complaint:${complaint.id}` },
          })
        ).resolvedAt,
      ).not.toBeNull();
    });
  },
);
