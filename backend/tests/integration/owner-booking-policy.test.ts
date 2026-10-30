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
import { ExpirationWorker } from "../../src/workers/expiration.worker.js";
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
    for (const disrupted of [false, true])
      it(`alternative proposal preserves ownership, quota and concurrent acceptance (disrupted=${disrupted})`, async () => {
        const f = await fixture();
        await capacity(f);
        await f.operations.transitionBooking(
          f.admin.actor,
          f.booking.id,
          {
            status: "CONFIRMED",
            expectedVersion: f.booking.version,
            resourceReviewNote: "Test staff and workshop capacity reviewed.",
          },
          context(),
        );
        if (disrupted) {
          const confirmed = await prisma.booking.findUniqueOrThrow({
            where: { id: f.booking.id },
          });
          await f.operations.reportBusinessDisruption(
            f.admin.actor,
            f.booking.id,
            {
              expectedVersion: confirmed.version,
              reason: "Required workshop equipment is unavailable.",
            },
            context(),
          );
        }
        const before = await prisma.booking.findUniqueOrThrow({
          where: { id: f.booking.id },
        });
        const startsAt = new Date(before.scheduledAt.getTime() + 86400000).toISOString();
        const input = {
          preferredAt: startsAt,
          reason: "The workshop proposes a later visit for review.",
          expectedVersion: before.version,
        };
        await f.operations.proposeBookingAlternative(
          f.admin.actor,
          f.booking.id,
          input,
          context(),
        );
        const proposed = await prisma.booking.findUniqueOrThrow({
          where: { id: f.booking.id },
        });
        expect(proposed.scheduledAt).toEqual(before.scheduledAt);
        expect(proposed.status).toBe("CONFIRMED");
        expect(proposed.alternativeVersion).toBe(proposed.version);
        await expect(
          f.operations.proposeBookingAlternative(
            f.admin.actor,
            f.booking.id,
            input,
            context(),
          ),
        ).rejects.toBeDefined();
        const other = await account("CUSTOMER", f.branch.id);
        await expect(
          f.operations.respondToBookingAlternative(
            other.actor,
            f.booking.id,
            { decision: "ACCEPT", expectedVersion: proposed.version },
            context(),
          ),
        ).rejects.toBeDefined();
        const replies = await Promise.allSettled(
          [1, 2].map(() =>
            f.operations.respondToBookingAlternative(
              f.customer.actor,
              f.booking.id,
              { decision: "ACCEPT", expectedVersion: proposed.version },
              context(),
            ),
          ),
        );
        expect(replies.filter((x) => x.status === "fulfilled")).toHaveLength(1);
        const accepted = await prisma.booking.findUniqueOrThrow({
          where: { id: f.booking.id },
        });
        expect(accepted.status).toBe("REQUESTED");
        expect(accepted.scheduledAt.toISOString()).toBe(startsAt);
        expect(accepted.alternativeStartsAt).toBeNull();
        expect(accepted.bookingSlotId).toBeNull();
        expect(accepted.assignedStaffId).toBeNull();
        expect(accepted.customerRescheduleCount).toBe(before.customerRescheduleCount);
        expect(accepted.depositAmountKobo).toBe(before.depositAmountKobo);
        expect(accepted.depositForfeitedAt).toBeNull();
        expect(accepted.disruptionResolution).toBe(disrupted ? "TRANSFERRED" : null);
        expect(
          await prisma.bookingReminder.count({
            where: { bookingId: f.booking.id, status: "PENDING" },
          }),
        ).toBe(0);
        await f.operations.proposeBookingAlternative(
          f.admin.actor,
          f.booking.id,
          {
            ...input,
            preferredAt: new Date(
              before.scheduledAt.getTime() + 2 * 86400000,
            ).toISOString(),
            expectedVersion: accepted.version,
          },
          context(),
        );
        const second = await prisma.booking.findUniqueOrThrow({
          where: { id: f.booking.id },
        });
        await f.operations.respondToBookingAlternative(
          f.customer.actor,
          f.booking.id,
          { decision: "DECLINE", expectedVersion: second.version },
          context(),
        );
        const declined = await prisma.booking.findUniqueOrThrow({
          where: { id: f.booking.id },
        });
        expect(declined.scheduledAt).toEqual(accepted.scheduledAt);
        expect(declined.status).toBe(accepted.status);
        expect(declined.alternativeVersion).toBeNull();
      });

    it("rejects alternatives after MFA, capability or branch access is lost", async () => {
      const f = await fixture();
      const input = {
        preferredAt: new Date(f.startsAt.getTime() + 86400000).toISOString(),
        reason: "Please review the later workshop time.",
        expectedVersion: f.booking.version,
      };
      const propose = (actor: AuthenticatedActor) =>
        f.operations.proposeBookingAlternative(actor, f.booking.id, input, context());
      await expect(
        propose({ ...f.admin.actor, mfaVerifiedAt: null }),
      ).rejects.toMatchObject({ statusCode: 403 });
      await prisma.userCapability.updateMany({
        where: { userId: f.admin.user.id, capability: "BOOKING_CONFIRM" },
        data: { revokedAt: new Date() },
      });
      await expect(propose(f.admin.actor)).rejects.toMatchObject({ statusCode: 403 });
      await prisma.userCapability.updateMany({
        where: { userId: f.admin.user.id, capability: "BOOKING_CONFIRM" },
        data: { revokedAt: null },
      });
      await prisma.user.update({
        where: { id: f.admin.user.id },
        data: { role: "STAFF" },
      });
      const staff = { ...f.admin.actor, role: "STAFF" as const };
      const other = await prisma.branch.create({
        data: {
          code: `ALT-${randomUUID().slice(0, 8)}`,
          name: "Other isolated branch",
          address: "Test only",
          city: "Port Harcourt",
          state: "Rivers",
        },
      });
      await prisma.staffProfile.update({
        where: { id: f.admin.user.staffProfile!.id },
        data: { branchId: other.id },
      });
      await expect(propose(staff)).rejects.toMatchObject({ statusCode: 403 });
      const unchanged = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      expect(unchanged).toMatchObject({
        version: f.booking.version,
        alternativeStartsAt: null,
        status: "REQUESTED",
      });
      expect(unchanged.scheduledAt).toEqual(f.startsAt);
    });

    it("rejects out-of-window proposals and acceptance while allowing an expired proposal to be declined", async () => {
      const f = await fixture();
      const propose = (preferredAt: Date) =>
        f.operations.proposeBookingAlternative(
          f.admin.actor,
          f.booking.id,
          {
            preferredAt: preferredAt.toISOString(),
            reason: "Please review the later workshop time.",
            expectedVersion: 0,
          },
          context(),
        );
      for (const days of [1, 15]) {
        await expect(
          propose(new Date(Date.now() + days * 86400000)),
        ).rejects.toMatchObject({ statusCode: 409 });
      }
      await propose(new Date(f.startsAt.getTime() + 86400000));
      // Advance only the isolated fixture's proposal into the expired window.
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { alternativeStartsAt: new Date(Date.now() - 60000) },
      });
      const before = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      await expect(
        f.operations.respondToBookingAlternative(
          f.customer.actor,
          f.booking.id,
          { decision: "ACCEPT", expectedVersion: before.version },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toEqual(before);
      await f.operations.respondToBookingAlternative(
        f.customer.actor,
        f.booking.id,
        { decision: "DECLINE", expectedVersion: before.version },
        context(),
      );
      const after = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      expect(after.scheduledAt).toEqual(before.scheduledAt);
      expect(after).toMatchObject({
        status: before.status,
        alternativeStartsAt: null,
        customerRescheduleCount: before.customerRescheduleCount,
      });
    });

    it("invalidates a proposal after a separate booking change even with the newest version", async () => {
      const f = await fixture();
      await f.operations.proposeBookingAlternative(
        f.admin.actor,
        f.booking.id,
        {
          preferredAt: new Date(f.startsAt.getTime() + 86400000).toISOString(),
          reason: "Please review the later workshop time.",
          expectedVersion: 0,
        },
        context(),
      );
      // Simulate an independent committed booking revision; a fresh client version
      // must not make the earlier proposal valid again.
      const revised = await prisma.booking.update({
        where: { id: f.booking.id },
        data: { version: { increment: 1 } },
      });
      for (const decision of ["ACCEPT", "DECLINE"] as const) {
        await expect(
          f.operations.respondToBookingAlternative(
            f.customer.actor,
            f.booking.id,
            { decision, expectedVersion: revised.version },
            context(),
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
      }
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toEqual(revised);
    });

    it("saves a concern once without a fabricated service, price or capacity and requires classification before confirmation", async () => {
      const f = await fixture();
      const customer = await account("CUSTOMER", f.branch.id);
      const key = randomUUID();
      const input = {
        customerConcern: "The engine shakes when starting from cold.",
        branchId: f.branch.id,
        preferredAt: new Date(f.startsAt.getTime() + 2 * 3600000).toISOString(),
        policyVersion: bookingPolicy.version,
      };
      const before = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      const results = await Promise.all(
        [1, 2].map(() =>
          f.operations.createBooking(customer.actor, input, key, context()),
        ),
      );
      expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
      const saved = await prisma.booking.findFirstOrThrow({
        where: { customerId: customer.user.profile!.id },
      });
      expect(saved).toMatchObject({
        serviceId: null,
        customerConcern: input.customerConcern,
        quotedPriceKobo: null,
        assignedStaffId: null,
        bookingSlotId: null,
        status: "REQUESTED",
        depositAmountKobo: null,
        capacityPolicyVersionId: null,
      });
      expect(await f.operations.customerBooking(customer.actor, saved.id)).toMatchObject({
        service: null,
        customerConcern: input.customerConcern,
      });
      await expect(
        f.operations.customerBooking(f.customer.actor, saved.id),
      ).rejects.toThrow();
      await expect(
        f.operations.transitionBooking(
          f.admin.actor,
          saved.id,
          {
            expectedVersion: saved.version,
            status: "CONFIRMED",
            resourceReviewNote: "Reviewed equipment and staffing",
          },
          context(),
        ),
      ).rejects.toThrow("Choose the service");
      await expect(
        f.operations.assignBooking(
          f.admin.actor,
          saved.id,
          {
            expectedVersion: saved.version,
            assignedStaffId: f.admin.user.staffProfile!.id,
          },
          context(),
        ),
      ).rejects.toThrow("Choose the service");
      const assigned = await f.operations.assignBooking(
        f.admin.actor,
        saved.id,
        {
          expectedVersion: saved.version,
          assignedStaffId: f.admin.user.staffProfile!.id,
          serviceId: f.service.id,
        },
        context(),
      );
      expect(assigned).toMatchObject({
        service: { id: f.service.id },
        customerConcern: input.customerConcern,
        status: "REQUESTED",
      });
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: saved.id } }),
      ).toMatchObject({
        quotedPriceKobo: f.service.priceKobo,
        serviceId: f.service.id,
        customerConcern: input.customerConcern,
      });
      await capacity(f);
      await f.operations.transitionBooking(
        f.admin.actor,
        saved.id,
        {
          expectedVersion: saved.version + 1,
          status: "CONFIRMED",
          resourceReviewNote: "Reviewed equipment and staffing",
        },
        context(),
      );
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: saved.id } }),
      ).toMatchObject({ status: "CONFIRMED" });
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toEqual(before);
    });

    it("saves one canonical preferred-time request under concurrent retries without a slot", async () => {
      const f = await fixture();
      const customer = await account("CUSTOMER", f.branch.id);
      const key = randomUUID();
      const input = {
        serviceId: f.service.id,
        branchId: f.branch.id,
        preferredAt: f.startsAt.toISOString(),
        policyVersion: bookingPolicy.version,
      };
      const results = await Promise.all(
        [1, 2].map(() =>
          f.operations.createBooking(customer.actor, input, key, context()),
        ),
      );
      expect(results.map((value) => value.replayed).sort()).toEqual([false, true]);
      const records = await prisma.booking.findMany({
        where: { customerId: customer.user.profile!.id },
      });
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        bookingSlotId: null,
        assignedStaffId: null,
        status: "REQUESTED",
        quotedPriceKobo: 10000n,
        depositAmountKobo: null,
        scheduledAt: f.startsAt,
      });
      expect(
        await prisma.auditLog.count({
          where: { entityType: "BOOKING", entityId: records[0]!.id, action: "CREATE" },
        }),
      ).toBe(1);
      await expect(
        f.operations.createBooking(
          customer.actor,
          {
            ...input,
            preferredAt: new Date(f.startsAt.getTime() + 3600000).toISOString(),
          },
          key,
          context(),
        ),
      ).rejects.toThrow();
    });
    it("accepts an unpriced quotation preference without inventing duration or capacity", async () => {
      const f = await fixture();
      const customer = await account("CUSTOMER", f.branch.id);
      await prisma.service.update({
        where: { id: f.service.id },
        data: { pricingType: "QUOTE_REQUIRED", priceKobo: null, durationMinutes: null },
      });
      await f.operations.createBooking(
        customer.actor,
        {
          serviceId: f.service.id,
          branchId: f.branch.id,
          preferredAt: f.startsAt.toISOString(),
          policyVersion: bookingPolicy.version,
        },
        randomUUID(),
        context(),
      );
      const saved = await prisma.booking.findFirstOrThrow({
        where: { customerId: customer.user.profile!.id },
      });
      expect(saved).toMatchObject({
        status: "REQUESTED",
        quotedPriceKobo: null,
        bookingSlotId: null,
        assignedStaffId: null,
        capacityPolicyVersionId: null,
        depositAmountKobo: null,
      });
    });
    it("rejects withdrawn services and times outside the existing booking window", async () => {
      const f = await fixture();
      const input = {
        serviceId: f.service.id,
        branchId: f.branch.id,
        preferredAt: new Date().toISOString(),
        policyVersion: bookingPolicy.version,
      };
      await expect(
        f.operations.createBooking(f.customer.actor, input, randomUUID(), context()),
      ).rejects.toThrow();
      await prisma.service.update({
        where: { id: f.service.id },
        data: { isActive: false },
      });
      await expect(
        f.operations.createBooking(
          f.customer.actor,
          { ...input, preferredAt: f.startsAt.toISOString() },
          randomUUID(),
          context(),
        ),
      ).rejects.toThrow();
    });
    it("reschedules a confirmed preference once with replay protection and fresh staff review", async () => {
      const f = await fixture();
      await capacity(f);
      await f.operations.transitionBooking(
        f.admin.actor,
        f.booking.id,
        {
          status: "CONFIRMED",
          expectedVersion: 0,
          resourceReviewNote: "Mechanic and workshop bay checked",
        },
        context(),
      );
      const original = await prisma.booking.update({
        where: { id: f.booking.id },
        data: { bookingSlotId: null },
      });
      const input = {
        preferredAt: new Date(f.startsAt.getTime() + 86_400_000).toISOString(),
        expectedVersion: original.version,
      };
      const stranger = await account("CUSTOMER", f.branch.id);
      await expect(
        f.operations.rescheduleBooking(
          stranger.actor,
          original.id,
          input,
          randomUUID(),
          context(),
        ),
      ).rejects.toThrow();
      const key = randomUUID();
      await Promise.all(
        [1, 2].map(() =>
          f.operations.rescheduleBooking(
            f.customer.actor,
            original.id,
            input,
            key,
            context(),
          ),
        ),
      );
      const saved = await prisma.booking.findUniqueOrThrow({
        where: { id: original.id },
      });
      expect(saved).toMatchObject({
        status: "REQUESTED",
        bookingSlotId: null,
        assignedStaffId: null,
        customerRescheduleCount: 1,
        scheduleVersion: 1,
        confirmedAt: null,
        resourceReviewNote: null,
        capacityPolicyVersionId: null,
      });
      expect(saved.scheduledAt.toISOString()).toBe(input.preferredAt);
      expect(
        await prisma.bookingReminder.count({
          where: { bookingId: original.id, status: "PENDING" },
        }),
      ).toBe(0);
      await expect(
        f.operations.rescheduleBooking(
          f.customer.actor,
          original.id,
          { ...input, expectedVersion: saved.version },
          randomUUID(),
          context(),
        ),
      ).rejects.toThrow();
    });
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
    it("expires an issued quotation once without changing its immutable document version or amounts", async () => {
      const f = await fixture();
      const quote = await prisma.serviceQuote.create({
        data: {
          bookingId: f.booking.id,
          createdByStaffId: f.admin.user.staffProfile!.id,
          quoteNumber: `EXP-${randomUUID().slice(0, 30)}`,
          version: 3,
          revision: 4,
          status: "ISSUED",
          subtotalKobo: 10000n,
          taxKobo: 750n,
          totalKobo: 10750n,
          createdAt: new Date(Date.now() - 62 * 86_400_000),
          issuedAt: new Date(Date.now() - 61 * 86_400_000),
          expiresAt: new Date(Date.now() - 60 * 86_400_000),
        },
      });
      const worker = new ExpirationWorker(prisma);
      await worker.runOnce();
      await worker.runOnce();
      expect(
        await prisma.serviceQuote.findUniqueOrThrow({ where: { id: quote.id } }),
      ).toMatchObject({
        status: "EXPIRED",
        version: 3,
        revision: 5,
        subtotalKobo: 10000n,
        taxKobo: 750n,
        totalKobo: 10750n,
      });
      const audits = await prisma.auditLog.findMany({
        where: { entityType: "QUOTE", entityId: quote.id, action: "STATUS_CHANGE" },
      });
      expect(audits).toHaveLength(1);
      expect(audits[0]!.oldValues).toMatchObject({
        status: "ISSUED",
        version: 3,
        revision: 4,
      });
      expect(audits[0]!.newValues).toMatchObject({
        status: "EXPIRED",
        version: 3,
        revision: 5,
      });
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
