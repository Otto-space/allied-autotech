import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { createApp } from "../../src/app.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { issueBookingActionToken } from "../../src/common/security/booking-action-token.js";
import {
  ServiceOperationsService,
  bookingPolicy,
} from "../../src/modules/service-operations/service-operations.service.js";
import { BookingReminderWorker } from "../../src/workers/booking-reminder.worker.js";
import {
  quoteCreateBodySchema,
  quoteReplaceBodySchema,
} from "../../src/modules/service-operations/service-operations.schemas.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function account(role: "CUSTOMER" | "ADMIN", branchId: string) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-test-only",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Owner",
                lastName: "Booking",
                phone: "+2348000000000",
              },
            },
          }
        : {
            staffProfile: { create: { firstName: "Owner", lastName: "Staff", branchId } },
          }),
    },
    include: { profile: true, staffProfile: true },
  });
  const actor: AuthenticatedActor = {
    userId: user.id,
    email: user.email,
    role,
    sessionId: randomUUID(),
    mfaRequired: role !== "CUSTOMER",
    mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
  };
  return { user, actor };
}
async function fixture() {
  const branch = await prisma.branch.create({
    data: {
      code: `BP-${randomUUID().slice(0, 8)}`,
      name: "Owner booking test",
      address: "Test only",
      city: "Port Harcourt",
      state: "Rivers",
    },
  });
  const admin = await account("ADMIN", branch.id);
  const customer = await account("CUSTOMER", branch.id);
  const service = await prisma.service.create({
    data: {
      name: "Owner booking",
      slug: randomUUID(),
      pricingType: "FIXED",
      priceKobo: 10000n,
      durationMinutes: 60,
    },
  });
  const startsAt = new Date(Date.now() + 8 * 86_400_000);
  startsAt.setUTCHours(9, 0, 0, 0);
  const slot = await prisma.bookingSlot.create({
    data: {
      branchId: branch.id,
      serviceId: service.id,
      staffId: admin.user.staffProfile!.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3_600_000),
    },
  });
  await prisma.userCapability.create({
    data: {
      userId: admin.user.id,
      capability: "BOOKING_CONFIRM",
      grantedByUserId: admin.user.id,
    },
  });
  const operations = new ServiceOperationsService(prisma);
  const created = (await operations.createBooking(
    customer.actor,
    { slotId: slot.id, policyVersion: bookingPolicy.version },
    randomUUID(),
    context(),
  )) as {
    booking: { id: string; version: number; status: string; depositPayment: unknown };
  };
  return {
    branch,
    admin,
    customer,
    service,
    slot,
    startsAt,
    operations,
    booking: created.booking,
  };
}
async function capacity(f: Awaited<ReturnType<typeof fixture>>) {
  await prisma.businessPolicyVersion.create({
    data: {
      key: `booking-capacity:${f.branch.id}`,
      version: 1,
      approvalStatus: "APPROVED",
      source: "Disposable integration-test assumption: one booking per day",
      sourceQuestion: "Q5 test fixture",
      approvedByUserId: f.admin.user.id,
      effectiveAt: new Date(),
      settings: {
        dailyLimit: 1,
        openingDays: [0, 1, 2, 3, 4, 5, 6],
        opensAt: "08:00",
        closesAt: "18:00",
        holidays: [],
        timezone: "Africa/Lagos",
      },
    },
  });
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Owner booking requests and one-hour reminders",
  () => {
    afterAll(() => prisma.$disconnect());
    it("calculates quote tax without a browser tax field and ignores legacy overrides on replacement", async () => {
      const f = await fixture();
      const input = {
        items: [
          {
            type: "LABOUR",
            description: "Synthetic tax rounding example",
            quantity: 1,
            unitPriceKobo: "20",
          },
        ],
        notes: null,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      };
      const created = await f.operations.createQuote(
        f.admin.actor,
        f.booking.id,
        quoteCreateBodySchema.parse(input),
        context(),
      );
      expect(created).toMatchObject({
        subtotalKobo: "20",
        taxKobo: "2",
        totalKobo: "22",
        status: "DRAFT",
      });
      const original = await prisma.serviceQuote.findFirstOrThrow({
        where: { bookingId: f.booking.id },
      });
      const replaced = await f.operations.replaceQuote(
        f.admin.actor,
        f.booking.id,
        original.id,
        quoteReplaceBodySchema.parse({
          ...input,
          items: [{ ...input.items[0], unitPriceKobo: "6" }],
          taxKobo: "999999",
          expectedRevision: original.revision,
        }),
        context(),
      );
      expect(replaced).toMatchObject({
        subtotalKobo: "6",
        taxKobo: "0",
        totalKobo: "6",
        status: "DRAFT",
        version: original.version + 1,
      });
      expect(
        (await prisma.serviceQuote.findUniqueOrThrow({ where: { id: original.id } }))
          .status,
      ).toBe("VOID");
      const current = await prisma.serviceQuote.findFirstOrThrow({
        where: { bookingId: f.booking.id, status: "DRAFT" },
      });
      await f.operations.issueQuote(
        f.admin.actor,
        f.booking.id,
        current.id,
        { expectedRevision: current.revision },
        context(),
      );
      const issued = await prisma.serviceQuote.findUniqueOrThrow({
        where: { id: current.id },
      });
      expect(issued.status).toBe("ISSUED");
      expect(issued.expiresAt!.getTime() - issued.issuedAt!.getTime()).toBe(
        7 * 86_400_000,
      );
      expect(issued.policySnapshot).toMatchObject({ key: "finance" });
    });
    it("takes a request without payment and requires approved capacity before staff confirmation", async () => {
      const f = await fixture();
      expect(f.booking).toMatchObject({ status: "REQUESTED", depositPayment: null });
      const confirm = () =>
        f.operations.transitionBooking(
          f.admin.actor,
          f.booking.id,
          {
            status: "CONFIRMED",
            expectedVersion: 0,
            resourceReviewNote: "Mechanic, bay and required equipment reviewed",
          },
          context(),
        );
      await expect(confirm()).rejects.toMatchObject({ statusCode: 409 });
      await capacity(f);
      await confirm();
      const reminders = await prisma.bookingReminder.findMany({
        where: { bookingId: f.booking.id },
      });
      expect(reminders).toHaveLength(1);
      expect(reminders[0]!.kind).toBe("ONE_HOUR");
      expect(reminders[0]!.scheduledFor.getTime()).toBe(f.startsAt.getTime() - 3_600_000);
      await prisma.bookingReminder.update({
        where: { id: reminders[0]!.id },
        data: { scheduledFor: new Date(Date.now() - 1000) },
      });
      await new BookingReminderWorker(prisma).runOnce();
      await new BookingReminderWorker(prisma).runOnce();
      expect(
        await prisma.notification.count({
          where: { resourceId: f.booking.id, title: "Appointment reminder: 1 hour" },
        }),
      ).toBe(1);
    });
    it("offers free cancellation or a replacement request after a no-deposit disruption", async () => {
      for (const transfer of [false, true]) {
        const f = await fixture();
        await capacity(f);
        await f.operations.transitionBooking(
          f.admin.actor,
          f.booking.id,
          {
            status: "CONFIRMED",
            expectedVersion: 0,
            resourceReviewNote: "Mechanic and service equipment reviewed",
          },
          context(),
        );
        await f.operations.reportBusinessDisruption(
          f.admin.actor,
          f.booking.id,
          {
            expectedVersion: 1,
            reason: "Required workshop equipment is unavailable.",
          },
          context(),
        );
        let current = await prisma.booking.findUniqueOrThrow({
          where: { id: f.booking.id },
        });
        expect(current.disruptionResolution).toBe("PENDING");
        expect(current.depositPaidAt).toBeNull();
        if (transfer) {
          const replacement = await prisma.bookingSlot.create({
            data: {
              branchId: f.branch.id,
              serviceId: f.service.id,
              staffId: f.admin.user.staffProfile!.id,
              startsAt: new Date(f.startsAt.getTime() + 7_200_000),
              endsAt: new Date(f.startsAt.getTime() + 10_800_000),
            },
          });
          await f.operations.resolveBusinessDisruption(
            f.customer.actor,
            f.booking.id,
            {
              expectedVersion: current.version,
              resolution: "TRANSFER",
              slotId: replacement.id,
            },
            randomUUID(),
            context(),
          );
          current = await prisma.booking.findUniqueOrThrow({
            where: { id: f.booking.id },
          });
          expect(current).toMatchObject({
            status: "REQUESTED",
            customerRescheduleCount: 0,
            resourceReviewNote: null,
            capacityPolicyVersionId: null,
            bookingSlotId: replacement.id,
          });
          await f.operations.transitionBooking(
            f.admin.actor,
            f.booking.id,
            {
              status: "CONFIRMED",
              expectedVersion: current.version,
              resourceReviewNote: "Replacement appointment resources reviewed",
            },
            context(),
          );
          current = await prisma.booking.findUniqueOrThrow({
            where: { id: f.booking.id },
          });
          await f.operations.reportBusinessDisruption(
            f.admin.actor,
            f.booking.id,
            {
              expectedVersion: current.version,
              reason: "A second disruption affects the replacement appointment.",
            },
            context(),
          );
          current = await prisma.booking.findUniqueOrThrow({
            where: { id: f.booking.id },
          });
          expect(current.disruptionResolution).toBe("PENDING");
          await expect(
            f.operations.reportBusinessDisruption(
              f.admin.actor,
              f.booking.id,
              {
                expectedVersion: current.version,
                reason: "Duplicate unresolved disruption must be rejected.",
              },
              context(),
            ),
          ).rejects.toMatchObject({ statusCode: 409 });
        }
        await f.operations.cancelBooking(
          f.customer.actor,
          f.booking.id,
          {
            expectedVersion: current.version,
            reason: "Customer cancellation after workshop disruption.",
          },
          context(),
        );
        const cancelled = await prisma.booking.findUniqueOrThrow({
          where: { id: f.booking.id },
        });
        expect(cancelled).toMatchObject({
          status: "CANCELLED",
          depositForfeitedAt: null,
          depositPaidAt: null,
        });
      }
    });
    it("records an owned vehicle and customer notes, and rejects another customer's vehicle", async () => {
      const f = await fixture();
      const customer = await account("CUSTOMER", f.branch.id);
      const slot = await prisma.bookingSlot.create({
        data: {
          branchId: f.branch.id,
          serviceId: f.service.id,
          staffId: f.admin.user.staffProfile!.id,
          startsAt: new Date(f.startsAt.getTime() + 7_200_000),
          endsAt: new Date(f.startsAt.getTime() + 10_800_000),
        },
      });
      const vehicle = await prisma.customerVehicle.create({
        data: {
          customerId: customer.user.profile!.id,
          make: "Test",
          model: "Saved vehicle",
          year: 2022,
        },
      });
      await expect(
        f.operations.createBooking(
          f.customer.actor,
          {
            slotId: slot.id,
            policyVersion: bookingPolicy.version,
            vehicleId: vehicle.id,
          },
          randomUUID(),
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      const response = await f.operations.createBooking(
        customer.actor,
        {
          slotId: slot.id,
          policyVersion: bookingPolicy.version,
          vehicleId: vehicle.id,
          customerNotes: "Please inspect the selected vehicle.",
        },
        randomUUID(),
        context(),
      );
      expect(response).toMatchObject({
        booking: {
          status: "REQUESTED",
          vehicle: { id: vehicle.id, make: "Test", model: "Saved vehicle" },
          customerNotes: "Please inspect the selected vehicle.",
          depositPayment: null,
        },
      });
    });
    it("serializes simultaneous confirmations against a daily limit", async () => {
      const f = await fixture();
      await capacity(f);
      const customer2 = await account("CUSTOMER", f.branch.id);
      const slot2 = await prisma.bookingSlot.create({
        data: {
          branchId: f.branch.id,
          serviceId: f.service.id,
          staffId: f.admin.user.staffProfile!.id,
          startsAt: new Date(f.startsAt.getTime() + 3_600_000),
          endsAt: new Date(f.startsAt.getTime() + 7_200_000),
        },
      });
      const second = (await f.operations.createBooking(
        customer2.actor,
        { slotId: slot2.id, policyVersion: bookingPolicy.version },
        randomUUID(),
        context(),
      )) as { booking: { id: string } };
      const results = await Promise.allSettled(
        [f.booking.id, second.booking.id].map((id) =>
          f.operations.transitionBooking(
            f.admin.actor,
            id,
            {
              status: "CONFIRMED",
              expectedVersion: 0,
              resourceReviewNote: "People and workshop equipment checked",
            },
            context(),
          ),
        ),
      );
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        await prisma.booking.count({
          where: { branchId: f.branch.id, status: "CONFIRMED" },
        }),
      ).toBe(1);
    });
    it("GET email links never mutate; explicit POST attendance and free cancellation are repeat-safe", async () => {
      const f = await fixture();
      await capacity(f);
      await f.operations.transitionBooking(
        f.admin.actor,
        f.booking.id,
        {
          status: "CONFIRMED",
          expectedVersion: 0,
          resourceReviewNote: "Mechanic and service bay checked",
        },
        context(),
      );
      const token = issueBookingActionToken({
        bookingId: f.booking.id,
        userId: f.customer.user.id,
        scheduleVersion: 0,
        expiresAt: Date.now() + 3_600_000,
      });
      const app = createApp({ checkReadiness: async () => undefined });
      expect(
        (await request(app).get(`/api/v1/public/booking-response?token=${token}`)).status,
      ).toBe(200);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }))
          .attendanceConfirmedAt,
      ).toBeNull();
      for (const action of ["CONFIRM", "CONFIRM", "CANCEL", "CANCEL"]) {
        const response = await request(app)
          .post("/api/v1/public/booking-response")
          .set("Origin", "http://localhost:3000")
          .type("form")
          .send({ token, action });
        expect(response.status).toBe(200);
      }
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      expect(booking.status).toBe("CANCELLED");
      expect(booking.depositForfeitedAt).toBeNull();
      expect(
        await prisma.bookingReminder.count({
          where: { bookingId: booking.id, status: "PENDING" },
        }),
      ).toBe(0);
    });
  },
);
