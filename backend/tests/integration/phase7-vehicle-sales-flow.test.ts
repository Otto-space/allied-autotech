import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { prisma } from "../../src/config/database.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const origin = "http://localhost:3000";

async function createUser(role: UserRole, branchId?: string) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: `${role.toLowerCase()}-${id}@example.test`,
      passwordHash: await hashPassword(`phase seven passphrase ${id}`),
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Phase",
                lastName: id.slice(0, 8),
                phone: `+23482${id.replaceAll("-", "").slice(0, 8)}`,
              },
            },
          }
        : {
            staffProfile: {
              create: { firstName: "Phase", lastName: role, branchId: branchId ?? null },
            },
          }),
    },
    select: { id: true, role: true, profile: { select: { id: true } } },
  });
}

async function createSession(userId: string, role: UserRole) {
  const token = generateOpaqueToken();
  const csrf = generateOpaqueToken();
  const now = new Date();
  const expiry = new Date(now.getTime() + 3_600_000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt: expiry,
      idleExpiresAt: expiry,
      createdAt: now,
      lastRotatedAt: now,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" ? null : now,
    },
  });
  return { cookie: `${sessionCookieName}=${token}`, csrf };
}

const mutation = (
  session: Awaited<ReturnType<typeof createSession>>,
  idempotencyKey?: string,
) => ({
  Origin: origin,
  Cookie: session.cookie,
  "X-CSRF-Token": session.csrf,
  ...(idempotencyKey === undefined ? {} : { "Idempotency-Key": idempotencyKey }),
});

describe.skipIf(!runDatabaseTests)("Phase 7 vehicles and vehicle sales", () => {
  afterAll(async () => prisma.$disconnect());

  it("enforces branch isolation, private assets, immutable history, and one reservation winner", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const branch = await prisma.branch.create({
      data: {
        code: `P7-${randomUUID().slice(0, 8)}`,
        name: "Phase Seven",
        address: "7 Secure Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const otherBranch = await prisma.branch.create({
      data: {
        code: `P7-${randomUUID().slice(0, 8)}`,
        name: "Other Seven",
        address: "8 Secure Road",
        city: "Abuja",
        state: "FCT",
      },
    });
    const [staff, otherStaff, firstCustomer, secondCustomer] = await Promise.all([
      createUser("STAFF", branch.id),
      createUser("STAFF", otherBranch.id),
      createUser("CUSTOMER"),
      createUser("CUSTOMER"),
    ]);
    const [staffSession, otherStaffSession, firstSession, secondSession] =
      await Promise.all([
        createSession(staff.id, staff.role),
        createSession(otherStaff.id, otherStaff.role),
        createSession(firstCustomer.id, firstCustomer.role),
        createSession(secondCustomer.id, secondCustomer.role),
      ]);

    const vehicleResponse = await request(app)
      .post("/api/v1/staff/vehicles")
      .set(mutation(staffSession))
      .send({
        branchId: branch.id,
        stockNumber: `p7-${randomUUID().slice(0, 8)}`,
        make: "Toyota",
        model: "Land Cruiser",
        year: 2025,
        vin: `JT${randomUUID().replaceAll("-", "").slice(0, 15).toUpperCase()}`,
      });
    expect(vehicleResponse.status).toBe(201);
    const vehicleId = vehicleResponse.body.data.id as string;
    // Seed private financial context; the STAFF mutation below must preserve it.
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { acquisitionCostKobo: 6000000000n },
    });
    const updatedVehicle = await request(app)
      .patch(`/api/v1/staff/vehicles/${vehicleId}`)
      .set(mutation(staffSession))
      .send({
        expectedVersion: 0,
        mileageKm: 15_000,
        transmission: "AUTOMATIC",
        fuelType: "PETROL",
        bodyType: "SUV",
        color: "Black",
        acquiredAt: new Date().toISOString(),
      });
    expect(updatedVehicle.status).toBe(200);
    expect(updatedVehicle.body.data).not.toHaveProperty("acquisitionCostKobo");
    const staleVehicle = await request(app)
      .patch(`/api/v1/staff/vehicles/${vehicleId}`)
      .set(mutation(staffSession))
      .send({ expectedVersion: 0, color: "Red" });
    expect(staleVehicle.status).toBe(409);

    const listingResponse = await request(app)
      .post("/api/v1/staff/vehicles/listings")
      .set(mutation(staffSession))
      .send({
        vehicleId,
        title: "Secure Land Cruiser",
        slug: `secure-land-cruiser-${randomUUID().slice(0, 8)}`,
        priceKobo: "6500000000",
      });
    expect(listingResponse.status).toBe(201);
    const listingId = listingResponse.body.data.id as string;

    const published = await request(app)
      .post(`/api/v1/staff/vehicles/listings/${listingId}/status`)
      .set(mutation(staffSession))
      .send({ expectedVersion: 0, status: "AVAILABLE" });
    expect(published.status).toBe(200);
    const repriced = await request(app)
      .post(`/api/v1/staff/vehicles/listings/${listingId}/price`)
      .set(mutation(staffSession))
      .send({
        expectedVersion: 1,
        priceKobo: "6400000000",
        reason: "Approved market adjustment",
      });
    expect(repriced.status).toBe(200);

    const publicListing = await request(app).get(`/api/v1/public/vehicles/${listingId}`);
    expect(publicListing.status).toBe(200);
    expect(publicListing.body.data.vehicle.vin).toBeUndefined();
    expect(publicListing.body.data.vehicle.acquisitionCostKobo).toBeUndefined();
    const publicSearch = await request(app).get(
      "/api/v1/public/vehicles?search=Land&make=Toyota&model=Land%20Cruiser&year=2025&bodyType=SUV&transmission=AUTOMATIC&fuelType=PETROL&featured=false&minPriceKobo=1&maxPriceKobo=9999999999&sort=price_asc",
    );
    expect(publicSearch.status).toBe(200);
    expect(
      publicSearch.body.data.items.some((item: { id: string }) => item.id === listingId),
    ).toBe(true);
    for (const sort of ["price_desc", "year_desc", "newest"]) {
      const sorted = await request(app).get(`/api/v1/public/vehicles?sort=${sort}`);
      expect(sorted.status).toBe(200);
    }
    const staffSearch = await request(app)
      .get(
        `/api/v1/staff/vehicles?branchId=${branch.id}&search=Toyota&make=Toyota&model=Land%20Cruiser&year=2025&status=AVAILABLE`,
      )
      .set("Cookie", staffSession.cookie);
    expect(staffSearch.status).toBe(200);
    const crossBranchList = await request(app)
      .get(`/api/v1/staff/vehicles?branchId=${otherBranch.id}`)
      .set("Cookie", staffSession.cookie);
    expect(crossBranchList.status).toBe(403);
    const saveVehicle = await request(app)
      .put(`/api/v1/customers/saved-vehicles/${listingId}`)
      .set(mutation(firstSession))
      .send({});
    expect(saveVehicle.status).toBe(200);
    const saveReplay = await request(app)
      .put(`/api/v1/customers/saved-vehicles/${listingId}`)
      .set(mutation(firstSession))
      .send({});
    expect(saveReplay.status).toBe(200);
    const savedVehicles = await request(app)
      .get("/api/v1/customers/saved-vehicles")
      .set("Cookie", firstSession.cookie);
    expect(savedVehicles.status).toBe(200);
    expect(savedVehicles.body.data).toHaveLength(1);

    const checksum = "7".repeat(64);
    const imageUpload = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/assets/upload`)
      .set(mutation(staffSession))
      .send({
        kind: "IMAGE",
        mimeType: "image/webp",
        sizeBytes: 1_024,
        checksumSha256: "6".repeat(64),
      });
    expect(imageUpload.status).toBe(201);
    const imageResponse = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/images`)
      .set(mutation(staffSession))
      .send({ assetToken: imageUpload.body.data.assetToken, isPrimary: true });
    expect(imageResponse.status).toBe(201);
    expect(imageResponse.body.data.url).toMatch(/^\/api\/v1\/public\/vehicles\/images\//);
    const imageAccess = await request(app).get(imageResponse.body.data.url);
    expect(imageAccess.status).toBe(302);
    expect(imageAccess.headers.location).toMatch(/^https:\/\/storage\.invalid\/view\//);

    const documentUpload = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/assets/upload`)
      .set(mutation(staffSession))
      .send({
        kind: "DOCUMENT",
        mimeType: "application/pdf",
        sizeBytes: 4_096,
        checksumSha256: checksum,
      });
    expect(documentUpload.status).toBe(201);
    const documentResponse = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/documents`)
      .set(mutation(staffSession))
      .send({
        assetToken: documentUpload.body.data.assetToken,
        type: "OWNERSHIP",
      });
    expect(documentResponse.status).toBe(201);
    expect(JSON.stringify(documentResponse.body)).not.toContain("objectKey");
    const documentId = documentResponse.body.data.id as string;
    const rejectedDocument = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/documents/${documentId}/review`)
      .set(mutation(staffSession))
      .send({
        expectedVersion: 0,
        status: "REJECTED",
        rejectionReason: "Replacement requested for test coverage",
      });
    expect(rejectedDocument.status).toBe(200);
    const verifiedDocument = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/documents/${documentId}/review`)
      .set(mutation(staffSession))
      .send({ expectedVersion: 1, status: "VERIFIED" });
    expect(verifiedDocument.status).toBe(200);
    const storedDocument = await prisma.vehicleDocument.findUniqueOrThrow({
      where: { id: documentId },
    });
    expect(storedDocument.objectKey).toMatch(/^vehicles\//);

    const crossBranchDocument = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/documents/${documentId}/access`)
      .set(mutation(otherStaffSession))
      .send({});
    expect(crossBranchDocument.status).toBe(403);
    const authorizedDocument = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/documents/${documentId}/access`)
      .set(mutation(staffSession))
      .send({});
    expect(authorizedDocument.status).toBe(200);
    expect(authorizedDocument.body.data.url).not.toContain(storedDocument.objectKey);

    const inspectionResponse = await request(app)
      .post("/api/v1/customers/vehicle-inspections")
      .set(mutation(firstSession))
      .send({
        vehicleListingId: listingId,
        preferredStartAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    expect(inspectionResponse.status).toBe(201);
    const inspectionId = inspectionResponse.body.data.id as string;
    const scheduledStart = new Date(Date.now() + 86_400_000);
    const confirmedInspection = await request(app)
      .post(`/api/v1/staff/vehicle-inspections/${inspectionId}/status`)
      .set(mutation(staffSession))
      .send({
        expectedVersion: 0,
        status: "CONFIRMED",
        scheduledStartAt: scheduledStart.toISOString(),
        scheduledEndAt: new Date(scheduledStart.getTime() + 3_600_000).toISOString(),
      });
    expect(confirmedInspection.status).toBe(200);
    const completedInspection = await request(app)
      .post(`/api/v1/staff/vehicle-inspections/${inspectionId}/status`)
      .set(mutation(staffSession))
      .send({ expectedVersion: 1, status: "COMPLETED" });
    expect(completedInspection.status).toBe(200);
    const customerInspections = await request(app)
      .get("/api/v1/customers/vehicle-inspections?status=COMPLETED&limit=1")
      .set("Cookie", firstSession.cookie);
    expect(customerInspections.status).toBe(200);
    const staffInspections = await request(app)
      .get(
        `/api/v1/staff/vehicle-inspections?branchId=${branch.id}&status=COMPLETED&limit=1`,
      )
      .set("Cookie", staffSession.cookie);
    expect(staffInspections.status).toBe(200);
    const conditionReport = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/condition-reports`)
      .set(mutation(staffSession))
      .send({
        inspectionId,
        odometerKm: 15_000,
        conditionScore: 92,
        summary: "Inspected and road tested",
        inspectedAt: new Date().toISOString(),
      });
    expect(conditionReport.status).toBe(201);

    const firstTransaction = await request(app)
      .post("/api/v1/customers/vehicle-transactions")
      .set(mutation(firstSession))
      .send({ vehicleListingId: listingId, sourceInspectionId: inspectionId });
    const secondTransaction = await request(app)
      .post("/api/v1/customers/vehicle-transactions")
      .set(mutation(secondSession))
      .send({ vehicleListingId: listingId });
    expect(firstTransaction.status).toBe(201);
    expect(secondTransaction.status).toBe(201);
    const firstId = firstTransaction.body.data.id as string;
    const secondId = secondTransaction.body.data.id as string;

    const firstNegotiation = await request(app)
      .post(`/api/v1/staff/vehicle-transactions/${firstId}/negotiate`)
      .set(mutation(staffSession))
      .send({ expectedVersion: 0, agreedPriceKobo: "6300000000" });
    const secondNegotiation = await request(app)
      .post(`/api/v1/staff/vehicle-transactions/${secondId}/negotiate`)
      .set(mutation(staffSession))
      .send({ expectedVersion: 0, agreedPriceKobo: "6300000000" });
    expect(firstNegotiation.status).toBe(200);
    expect(secondNegotiation.status).toBe(200);
    const customerTransactions = await request(app)
      .get("/api/v1/customers/vehicle-transactions?status=NEGOTIATING&limit=1")
      .set("Cookie", firstSession.cookie);
    expect(customerTransactions.status).toBe(200);
    const customerOwnTransaction = await request(app)
      .get(`/api/v1/customers/vehicle-transactions/${firstId}`)
      .set("Cookie", firstSession.cookie);
    expect(customerOwnTransaction.status).toBe(200);
    const crossCustomerTransaction = await request(app)
      .get(`/api/v1/customers/vehicle-transactions/${firstId}`)
      .set("Cookie", secondSession.cookie);
    expect(crossCustomerTransaction.status).toBe(404);
    const staffTransactions = await request(app)
      .get(
        `/api/v1/staff/vehicle-transactions?branchId=${branch.id}&status=NEGOTIATING&limit=1`,
      )
      .set("Cookie", staffSession.cookie);
    expect(staffTransactions.status).toBe(200);
    const staffTransaction = await request(app)
      .get(`/api/v1/staff/vehicle-transactions/${firstId}`)
      .set("Cookie", staffSession.cookie);
    expect(staffTransaction.status).toBe(200);

    const reservations = await Promise.all([
      request(app)
        .post(`/api/v1/customers/vehicle-transactions/${firstId}/reserve`)
        .set(mutation(firstSession, "phase7-first-reservation"))
        .send({ expectedVersion: 1, termsVersion: "v1", termsAccepted: true }),
      request(app)
        .post(`/api/v1/customers/vehicle-transactions/${secondId}/reserve`)
        .set(mutation(secondSession, "phase7-second-reservation"))
        .send({ expectedVersion: 1, termsVersion: "v1", termsAccepted: true }),
    ]);
    expect(reservations.map(({ status }) => status).sort()).toEqual([200, 409]);
    const winningIndex = reservations.findIndex(({ status }) => status === 200);
    const winner = reservations[winningIndex]!;
    const winnerId = winner.body.data.transaction.id as string;
    const winnerSession = winningIndex === 0 ? firstSession : secondSession;
    const winnerKey =
      winningIndex === 0 ? "phase7-first-reservation" : "phase7-second-reservation";
    const replay = await request(app)
      .post(`/api/v1/customers/vehicle-transactions/${winnerId}/reserve`)
      .set(mutation(winnerSession, winnerKey))
      .send({ expectedVersion: 1, termsVersion: "v1", termsAccepted: true });
    expect(replay.status).toBe(200);
    expect(replay.body.data.replayed).toBe(true);
    expect(
      await prisma.vehicleTransaction.count({
        where: { vehicleListingId: listingId, status: "RESERVED" },
      }),
    ).toBe(1);

    const losingId = winnerId === firstId ? secondId : firstId;
    const payment = await prisma.payment.create({
      data: {
        customerId:
          winnerId === firstId ? secondCustomer.profile!.id : firstCustomer.profile!.id,
        vehicleTransactionId: losingId,
        paymentNumber: `P7P-${randomUUID().slice(0, 12)}`,
        purpose: "VEHICLE_FULL_PAYMENT",
        amountKobo: 6_300_000_000n,
        idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        internalReference: `P7A-${randomUUID()}`,
        provider: "PAYSTACK",
        amountKobo: payment.amountKobo,
      },
    });
    const frozenNegotiation = await request(app)
      .post(`/api/v1/staff/vehicle-transactions/${losingId}/negotiate`)
      .set(mutation(staffSession))
      .send({ expectedVersion: 1, agreedPriceKobo: "6200000000" });
    expect(frozenNegotiation.status).toBe(409);
    await expect(
      prisma.vehicleTransaction.update({
        where: { id: losingId },
        data: { agreedPriceKobo: 1n },
      }),
    ).rejects.toThrow(/immutable after payment activity/i);

    await expect(
      prisma.vehicleListing.create({
        data: {
          vehicleId,
          branchId: branch.id,
          title: "Conflicting live listing",
          slug: `conflicting-${randomUUID().slice(0, 8)}`,
          priceKobo: 1n,
          status: "AVAILABLE",
          publishedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
    const priceHistory = await prisma.vehiclePriceHistory.findFirstOrThrow({
      where: { vehicleListingId: listingId },
    });
    await expect(
      prisma.vehiclePriceHistory.update({
        where: { id: priceHistory.id },
        data: { reason: "tampered" },
      }),
    ).rejects.toThrow(/append-only/i);

    const paid = await prisma.vehicleTransaction.update({
      where: { id: winnerId },
      data: { status: "PAID", paidAt: new Date(), version: { increment: 1 } },
    });
    const handoverUpload = await request(app)
      .post(`/api/v1/staff/vehicles/${vehicleId}/assets/upload`)
      .set(mutation(staffSession))
      .send({
        kind: "HANDOVER",
        mimeType: "application/pdf",
        sizeBytes: 2_048,
        checksumSha256: "8".repeat(64),
      });
    expect(handoverUpload.status).toBe(201);
    const createdHandover = await request(app)
      .post(`/api/v1/staff/vehicle-transactions/${winnerId}/handovers`)
      .set(mutation(staffSession))
      .send({
        recipientName: "Authorized Recipient",
        recipientPhone: "+2348100000000",
        odometerKm: 15_001,
        keysDelivered: 2,
        assetToken: handoverUpload.body.data.assetToken,
      });
    expect(createdHandover.status).toBe(201);
    expect(createdHandover.body.data.version).toBe(paid.version + 1);
    const handoverId = createdHandover.body.data.handover.id as string;
    const storedHandover = await prisma.vehicleHandover.findUniqueOrThrow({
      where: { id: handoverId },
    });
    expect(JSON.stringify(createdHandover.body)).not.toContain(
      storedHandover.signedDocumentObjectKey,
    );
    const crossBranchHandover = await request(app)
      .post(
        `/api/v1/staff/vehicle-transactions/${winnerId}/handovers/${handoverId}/access`,
      )
      .set(mutation(otherStaffSession))
      .send({});
    expect(crossBranchHandover.status).toBe(403);
    const handoverAccess = await request(app)
      .post(
        `/api/v1/staff/vehicle-transactions/${winnerId}/handovers/${handoverId}/access`,
      )
      .set(mutation(staffSession))
      .send({});
    expect(handoverAccess.status).toBe(200);
    expect(handoverAccess.body.data.url).not.toContain(
      storedHandover.signedDocumentObjectKey,
    );

    const ready = await request(app)
      .post(
        `/api/v1/staff/vehicle-transactions/${winnerId}/handovers/${handoverId}/status`,
      )
      .set(mutation(staffSession))
      .send({ expectedVersion: 0, status: "READY" });
    expect(ready.status).toBe(200);
    const completed = await request(app)
      .post(
        `/api/v1/staff/vehicle-transactions/${winnerId}/handovers/${handoverId}/status`,
      )
      .set(mutation(staffSession))
      .send({ expectedVersion: 1, status: "COMPLETED" });
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe("COMPLETED");
    expect(completed.body.data.vehicleListing.status).toBe("SOLD");
    await expect(
      prisma.vehicleHandover.update({
        where: { id: handoverId },
        data: { signedDocumentSha256: "9".repeat(64) },
      }),
    ).rejects.toThrow(/immutable/i);
    const removeSaved = await request(app)
      .delete(`/api/v1/customers/saved-vehicles/${listingId}`)
      .set(mutation(firstSession))
      .send({});
    expect(removeSaved.status).toBe(200);
    const removeSavedReplay = await request(app)
      .delete(`/api/v1/customers/saved-vehicles/${listingId}`)
      .set(mutation(firstSession))
      .send({});
    expect(removeSavedReplay.status).toBe(200);
  }, 45_000);
});
