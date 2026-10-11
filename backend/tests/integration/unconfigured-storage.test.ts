import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/config/env.js")>();
  return { ...original, env: { ...original.env, OBJECT_STORAGE_BUCKET: undefined } };
});

import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { issueVehicleAssetTicket } from "../../src/common/security/asset-tickets.js";
import { issuePaymentEvidenceTicket } from "../../src/common/security/payment-evidence-tickets.js";
import { VehiclesService } from "../../src/modules/vehicles/vehicles.service.js";
import { VehicleSalesService } from "../../src/modules/vehicle-sales/vehicle-sales.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";

const context = { requestId: "unconfigured-storage", ipAddress: null, userAgent: null };
const file = {
  mimeType: "application/pdf" as const,
  sizeBytes: 128,
  checksumSha256: "a".repeat(64),
};
async function account(role: "ADMIN" | "CUSTOMER") {
  const user = await prisma.user.create({
    data: {
      email: `storage-disabled-${randomUUID()}@example.test`,
      passwordHash: "unusable",
      role,
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Storage", lastName: "Test", phone: "+2348000000000" },
      },
    },
    include: { profile: true },
  });
  const actor: AuthenticatedActor = {
    userId: user.id,
    email: user.email,
    role,
    sessionId: randomUUID(),
    mfaRequired: role === "ADMIN",
    mfaVerifiedAt: role === "ADMIN" ? new Date() : null,
  };
  return { user, actor };
}
const branch = () =>
  prisma.branch.create({
    data: {
      code: `SC-${randomUUID().slice(0, 8)}`,
      name: "Storage verification",
      address: "Test",
      city: "Lagos",
      state: "Lagos",
    },
  });

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "missing storage cannot create evidence",
  () => {
    afterAll(async () => prisma.$disconnect());
    it("rejects document and handover tickets without inserting private asset records", async () => {
      const { actor } = await account("ADMIN");
      const location = await branch();
      const vehicle = await prisma.vehicle.create({
        data: {
          branchId: location.id,
          stockNumber: randomUUID(),
          make: "Toyota",
          model: "Corolla",
          year: 2025,
        },
      });
      const service = new VehiclesService();
      await expect(
        service.createUpload(actor, vehicle.id, { ...file, kind: "DOCUMENT" }, context),
      ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", statusCode: 503 });
      const ticket = issueVehicleAssetTicket({
        actorUserId: actor.userId,
        vehicleId: vehicle.id,
        kind: "DOCUMENT",
        ...file,
      });
      await expect(
        service.addDocument(
          actor,
          vehicle.id,
          { assetToken: ticket.ticket, type: "OWNERSHIP" },
          context,
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", statusCode: 503 });
      expect(
        await prisma.vehicleDocument.count({ where: { vehicleId: vehicle.id } }),
      ).toBe(0);
      expect(await prisma.auditLog.count({ where: { entityId: vehicle.id } })).toBe(0);
      const listing = await prisma.vehicleListing.create({
        data: {
          vehicleId: vehicle.id,
          branchId: location.id,
          title: "Storage test listing",
          slug: `storage-${randomUUID()}`,
          priceKobo: 100000n,
        },
      });
      const sale = await prisma.vehicleTransaction.create({
        data: {
          vehicleListingId: listing.id,
          transactionNumber: `SC-${randomUUID()}`,
          customerName: "Storage Test",
          customerPhone: "+2348000000000",
          askingPriceKobo: 100000n,
          agreedPriceKobo: 100000n,
          status: "PAID",
          paidAt: new Date(),
          ...(await testReservationAcceptance()),
        },
      });
      const handover = issueVehicleAssetTicket({
        actorUserId: actor.userId,
        vehicleId: vehicle.id,
        kind: "HANDOVER",
        ...file,
      });
      await expect(
        new VehicleSalesService().createHandover(
          actor,
          sale.id,
          {
            assetToken: handover.ticket,
            recipientName: "Storage Test",
            recipientPhone: "+2348000000000",
            odometerKm: 100,
            keysDelivered: 2,
          },
          context,
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", statusCode: 503 });
      expect(
        await prisma.vehicleHandover.count({ where: { vehicleTransactionId: sale.id } }),
      ).toBe(0);
      expect(
        (await prisma.vehicleTransaction.findUniqueOrThrow({ where: { id: sale.id } }))
          .status,
      ).toBe("PAID");
    });

    it("rejects payment evidence without creating an attempt, review or settlement", async () => {
      const { actor, user } = await account("CUSTOMER");
      const location = await branch();
      const order = await prisma.order.create({
        data: {
          customerId: user.profile!.id,
          branchId: location.id,
          orderNumber: `SC-${randomUUID()}`,
          subtotalKobo: 10000n,
          totalKobo: 10000n,
          customerName: "Storage Test",
          customerEmail: actor.email,
          customerPhone: "+2348000000000",
          paymentDueAt: new Date(Date.now() + 3_600_000),
        },
      });
      const service = new PaymentsService();
      await service.createIntent(
        actor,
        { targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" },
        randomUUID(),
        context,
      );
      const payment = await prisma.payment.findFirstOrThrow({
        where: { orderId: order.id },
      });
      await expect(
        service.createEvidenceUpload(actor, payment.id, file),
      ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", statusCode: 503 });
      const ticket = issuePaymentEvidenceTicket({
        actorUserId: actor.userId,
        paymentId: payment.id,
        ...file,
      });
      await expect(
        service.submitManual(
          actor,
          payment.id,
          {
            evidenceToken: ticket.ticket,
            method: "BANK_TRANSFER",
            payerName: "Storage Test",
            transferredAt: new Date().toISOString(),
            bankReference: "SYNTHETIC-ONLY",
          },
          randomUUID(),
          context,
        ),
      ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", statusCode: 503 });
      expect(
        await prisma.paymentAttempt.count({ where: { paymentId: payment.id } }),
      ).toBe(0);
      expect(
        await prisma.manualPaymentReview.count({
          where: { paymentAttempt: { paymentId: payment.id } },
        }),
      ).toBe(0);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status,
      ).toBe(payment.status);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paidAt,
      ).toBeNull();
    });
  },
);
import { testReservationAcceptance } from "../helpers/reservation-terms.js";
