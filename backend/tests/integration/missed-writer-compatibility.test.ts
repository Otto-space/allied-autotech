import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { verifyDatabaseSchema } from "../../src/common/database/schema-safety.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "missed-appointment writer compatibility",
  () => {
    const app = createApp({ rateLimit: 10000 });
    let fixture: Awaited<ReturnType<typeof workforceFixture>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      // Exercise the same read-only scalar probe as the actual API/worker startup.
      await verifyDatabaseSchema(prisma);
      fixture = await workforceFixture();
    }, 60000);
    afterAll(() => prisma.$disconnect());

    it("rejects legacy raw missed writes for assigned Staff, Admin and Super Admin without altering the appointment", async () => {
      const assigned = await fixture.account(null, "STAFF");
      const admin = await fixture.account(null, "ADMIN");
      const owner = await fixture.session(fixture.owner.id, "SUPER_ADMIN");
      for (const headers of [assigned.headers, admin.headers, owner.headers]) {
        const booking = await prisma.booking.create({
          data: {
            customerId: fixture.customer.user.profile!.id,
            branchId: fixture.home.id,
            serviceId: fixture.job1.serviceId,
            assignedStaffId: assigned.user.staffProfile!.id,
            scheduledAt: new Date(Date.now() - 20 * 60000),
            status: "CONFIRMED",
            confirmedAt: new Date(),
          },
        });
        await request(app)
          .post(`/api/v1/staff/bookings/${booking.id}/status`)
          .set(headers)
          .send({ status: "NO_SHOW", expectedVersion: booking.version })
          .expect(409);
        const after = await prisma.booking.findUniqueOrThrow({
          where: { id: booking.id },
        });
        expect(after.status).toBe("CONFIRMED");
        expect(after.version).toBe(booking.version);
        expect(after.scheduledAt).toEqual(booking.scheduledAt);
        expect(after.startedAt).toBeNull();
        expect(after.customerRescheduleCount).toBe(booking.customerRescheduleCount);
      }
    });
  },
);
