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
import { ExpirationWorker } from "../../src/workers/expiration.worker.js";
import { BookingReminderWorker } from "../../src/workers/booking-reminder.worker.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const origin = "http://localhost:3000";

async function user(role: UserRole, branchId?: string) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: `booking-${role.toLowerCase()}-${id}@example.test`,
      passwordHash: await hashPassword(`booking deposit passphrase ${id}`),
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Booking",
                lastName: "Customer",
                phone: `+23481${id.replaceAll("-", "").slice(0, 8)}`,
              },
            },
          }
        : {
            staffProfile: {
              create: {
                firstName: "Booking",
                lastName: role,
                branchId: branchId ?? null,
              },
            },
          }),
    },
    select: {
      id: true,
      role: true,
      profile: { select: { id: true } },
      staffProfile: { select: { id: true } },
    },
  });
}

async function session(userId: string, role: UserRole) {
  const token = generateOpaqueToken();
  const csrf = generateOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3_600_000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt,
      idleExpiresAt: expiresAt,
      createdAt: now,
      lastRotatedAt: now,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" ? null : now,
    },
  });
  return { cookie: `${sessionCookieName}=${token}`, csrf };
}

const mutation = (value: Awaited<ReturnType<typeof session>>, key?: string) => ({
  Origin: origin,
  Cookie: value.cookie,
  "X-CSRF-Token": value.csrf,
  ...(key === undefined ? {} : { "Idempotency-Key": key }),
});

describe.skipIf(!runDatabaseTests)("deposit-backed booking slots", () => {
  afterAll(async () => prisma.$disconnect());

  it("serializes a slot, rounds the deposit, confirms payment, and reschedules once", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const branch = await prisma.branch.create({
      data: {
        code: `BOOK-${randomUUID().slice(0, 8)}`,
        name: "Booking Test Branch",
        address: "1 Booking Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const [staff, admin, firstCustomer, secondCustomer] = await Promise.all([
      user("STAFF", branch.id),
      user("ADMIN"),
      user("CUSTOMER"),
      user("CUSTOMER"),
    ]);
    const [staffSession, adminSession, firstSession, secondSession] = await Promise.all([
      session(staff.id, staff.role),
      session(admin.id, admin.role),
      session(firstCustomer.id, firstCustomer.role),
      session(secondCustomer.id, secondCustomer.role),
    ]);
    const service = await prisma.service.create({
      data: {
        name: "Booking deposit service",
        slug: `booking-deposit-${randomUUID().slice(0, 8)}`,
        pricingType: "FIXED",
        priceKobo: 1005n,
        durationMinutes: 60,
      },
    });
    const startsAt = new Date(Date.now() + 8 * 24 * 3_600_000);
    const published = await request(app)
      .post("/api/v1/staff/booking-slots")
      .set(mutation(staffSession))
      .send({
        branchId: branch.id,
        serviceId: service.id,
        staffId: staff.staffProfile!.id,
        startsAt: startsAt.toISOString(),
      });
    expect(published.status).toBe(201);
    const slotId = published.body.data.id as string;

    const publicSlots = await request(app).get(
      `/api/v1/public/services/${service.id}/slots?branchId=${branch.id}`,
    );
    expect(publicSlots.status).toBe(200);
    expect(publicSlots.body.data.items).toHaveLength(1);

    const create = (cookie: Awaited<ReturnType<typeof session>>, key: string) =>
      request(app).post("/api/v1/customers/bookings").set(mutation(cookie, key)).send({
        slotId,
        policyVersion: "booking-deposit-v1",
        acceptNonRefundableDeposit: true,
      });
    const [winner, loser] = await Promise.all([
      create(firstSession, `booking-${randomUUID()}`),
      create(secondSession, `booking-${randomUUID()}`),
    ]);
    const successful = [winner, loser].find((response) => response.status === 201)!;
    const conflicted = [winner, loser].find((response) => response.status === 409)!;
    expect(successful).toBeDefined();
    expect(conflicted).toBeDefined();
    expect(successful.body.data.booking.depositAmountKobo).toBe("302");
    expect(successful.body.data.booking.status).toBe("AWAITING_DEPOSIT");
    expect(successful.body.data.booking.depositPayment).not.toHaveProperty(
      "settledAttemptId",
    );

    const winningSession = winner.status === 201 ? firstSession : secondSession;
    const bookingId = successful.body.data.booking.id as string;
    const paymentId = successful.body.data.booking.depositPayment.id as string;
    const manual = await request(app)
      .post(`/api/v1/customers/payments/${paymentId}/manual`)
      .set(mutation(winningSession, "booking-deposit-manual-payment"))
      .send({
        method: "BANK_TRANSFER",
        payerName: "Synthetic Booking Customer",
        transferredAt: new Date().toISOString(),
      });
    expect(manual.status).toBe(201);
    const attemptId = manual.body.data.attempts[0].id as string;
    const approved = await request(app)
      .post(`/api/v1/staff/payments/manual-attempts/${attemptId}/review`)
      .set(mutation(adminSession))
      .send({ decision: "APPROVED", reviewerNote: "Synthetic exact transfer" });
    expect(approved.status).toBe(200);

    const confirmed = await request(app)
      .get(`/api/v1/customers/bookings/${bookingId}`)
      .set("Cookie", winningSession.cookie);
    expect(confirmed.body.data.status).toBe("CONFIRMED");
    expect(confirmed.body.data.reminders).toHaveLength(4);
    expect(confirmed.body.data.depositPaidAt).toBeTruthy();

    const privateDraft = await request(app)
      .post(`/api/v1/staff/bookings/${bookingId}/quotes`)
      .set(mutation(staffSession))
      .send({
        expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        taxKobo: "0",
        items: [
          {
            type: "LABOUR",
            description: "Unpublished estimate",
            quantity: 1,
            unitPriceKobo: "1000",
          },
        ],
      });
    expect(privateDraft.status).toBe(201);

    const replacement = await request(app)
      .post("/api/v1/staff/booking-slots")
      .set(mutation(staffSession))
      .send({
        branchId: branch.id,
        serviceId: service.id,
        staffId: staff.staffProfile!.id,
        startsAt: new Date(Date.now() + 9 * 24 * 3_600_000).toISOString(),
      });
    expect(replacement.status).toBe(201);
    const moved = await request(app)
      .patch(`/api/v1/customers/bookings/${bookingId}/schedule`)
      .set(mutation(winningSession, "booking-reschedule-once"))
      .send({ slotId: replacement.body.data.id, expectedVersion: 1 });
    expect(moved.status).toBe(200);
    expect(moved.body.data.customerRescheduleCount).toBe(1);
    expect(moved.body.data.reminders).toHaveLength(8);
    expect(moved.body.data.quotes).toEqual([]);
    const movedReplay = await request(app)
      .patch(`/api/v1/customers/bookings/${bookingId}/schedule`)
      .set(mutation(winningSession, "booking-reschedule-once"))
      .send({ slotId: replacement.body.data.id, expectedVersion: 1 });
    expect(movedReplay.status).toBe(200);
    expect(movedReplay.body.data.replayed).toBe(true);
    expect(movedReplay.body.data.customerRescheduleCount).toBe(1);
    expect(movedReplay.body.data.quotes).toEqual([]);
    const dueReminder = await prisma.bookingReminder.findUniqueOrThrow({
      where: {
        bookingId_kind_scheduleVersion: {
          bookingId,
          kind: "ONE_DAY",
          scheduleVersion: 1,
        },
      },
    });
    await prisma.bookingReminder.update({
      where: { id: dueReminder.id },
      data: { scheduledFor: new Date(Date.now() - 1_000) },
    });
    expect((await new BookingReminderWorker().runOnce(100)).sent).toBeGreaterThanOrEqual(
      1,
    );
    expect(
      (
        await prisma.bookingReminder.findUniqueOrThrow({
          where: { id: dueReminder.id },
        })
      ).status,
    ).toBe("SENT");
    const secondMove = await request(app)
      .patch(`/api/v1/customers/bookings/${bookingId}/schedule`)
      .set(mutation(winningSession, "booking-reschedule-twice"))
      .send({ slotId, expectedVersion: 2 });
    expect(secondMove.status).toBe(409);
    const disruption = await request(app)
      .post(`/api/v1/staff/bookings/${bookingId}/disruption`)
      .set(mutation(staffSession))
      .send({
        expectedVersion: moved.body.data.version,
        reason: "Synthetic workshop disruption",
      });
    expect(disruption.status).toBe(200);
    expect(disruption.body.data.disruptionResolution).toBe("PENDING");
    expect(disruption.body.data).not.toHaveProperty("depositPayment");
  }, 60_000);

  it("expires an unpaid 30-minute hold and releases the slot", async () => {
    const branch = await prisma.branch.create({
      data: {
        code: `EXP-${randomUUID().slice(0, 8)}`,
        name: "Expiry Branch",
        address: "2 Booking Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const [staff, customer] = await Promise.all([
      user("STAFF", branch.id),
      user("CUSTOMER"),
    ]);
    const service = await prisma.service.create({
      data: {
        name: "Expiry service",
        slug: `expiry-service-${randomUUID().slice(0, 8)}`,
        pricingType: "FIXED",
        priceKobo: 10_000n,
        durationMinutes: 30,
      },
    });
    const slotStartsAt = new Date(Date.now() + 8 * 24 * 3_600_000);
    const slot = await prisma.bookingSlot.create({
      data: {
        branchId: branch.id,
        serviceId: service.id,
        staffId: staff.staffProfile!.id,
        startsAt: slotStartsAt,
        endsAt: new Date(slotStartsAt.getTime() + 30 * 60_000),
      },
    });
    const createdAt = new Date(Date.now() - 10_000);
    const hold = new Date(createdAt.getTime() + 1_000);
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.profile!.id,
        branchId: branch.id,
        serviceId: service.id,
        assignedStaffId: staff.staffProfile!.id,
        bookingSlotId: slot.id,
        scheduledAt: slot.startsAt,
        status: "AWAITING_DEPOSIT",
        quotedPriceKobo: 10_000n,
        paymentHoldExpiresAt: hold,
        depositBaseKobo: 10_000n,
        depositBasisPoints: 3000,
        depositAmountKobo: 3_000n,
        depositPolicyVersion: "booking-deposit-v1",
        depositTermsAcceptedAt: createdAt,
        createdAt,
        depositPayment: {
          create: {
            customerId: customer.profile!.id,
            paymentNumber: `PAY-${randomUUID()}`,
            purpose: "BOOKING_DEPOSIT",
            amountKobo: 3_000n,
            idempotencyKeyHash: hashToken(
              "payment-intent-idempotency",
              `expiry-${randomUUID()}`,
            ),
            expiresAt: hold,
            createdAt,
          },
        },
      },
    });
    const expired = await new ExpirationWorker().runOnce();
    expect(expired.bookingHolds).toBeGreaterThanOrEqual(1);
    const result = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { depositPayment: true },
    });
    expect(result.status).toBe("EXPIRED");
    expect(result.depositPayment?.status).toBe("EXPIRED");
  }, 30_000);
});
