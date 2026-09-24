import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import { createApp } from "../../src/app.js";
import { issueBookingActionToken } from "../../src/common/security/booking-action-token.js";

const endpoint = "/api/v1/public/booking-response";
const app = createApp({ checkReadiness: async () => undefined });

describe("booking reminder validation without a database", () => {
  it("renders safe recovery on an unavailable database and never claims an uncertain POST failed", async () => {
    const token = issueBookingActionToken({
      bookingId: randomUUID(),
      userId: randomUUID(),
      scheduleVersion: 0,
      expiresAt: Date.now() + 60000,
    });
    const lookup = vi
      .spyOn(prisma.booking, "findFirst")
      .mockRejectedValue(new Error("private-database-diagnostic"));
    try {
      const read = await request(app).get(endpoint).query({ token });
      expect(read.status).toBe(500);
      expect(read.text).not.toContain("private-database-diagnostic");
      expect(read.text).not.toContain(token);
      const write = await request(app)
        .post(endpoint)
        .set("Origin", "http://localhost:3000")
        .type("form")
        .send({ token, action: "CONFIRM" });
      expect(write.status).toBe(500);
      expect(write.text).toContain(
        "Check your booking in your account before submitting another action.",
      );
      expect(write.text).not.toContain("<form");
      expect(write.text).not.toContain("private-database-diagnostic");
    } finally {
      lookup.mockRestore();
    }
  });
  it("returns private, safe HTML for missing, repeated and invalid tokens and malformed actions", async () => {
    for (const query of ["", "?token=a&token=b", "?token="]) {
      const response = await request(app).get(endpoint + query);
      expect(response.status).toBe(422);
      expect(response.type).toBe("text/html");
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["referrer-policy"]).toBe("strict-origin");
      expect(response.headers["x-robots-tag"]).toContain("noindex");
      expect(response.headers["content-security-policy"]).toContain("script-src 'none'");
      expect(response.text).toContain("Check my bookings");
      expect(response.text).not.toContain('name="token"');
    }
    const invalid = await request(app)
      .get(endpoint)
      .query({ token: "private-invalid-token" });
    expect(invalid.status).toBe(409);
    expect(invalid.text).not.toContain("private-invalid-token");
    expect(
      (
        await request(app)
          .post(endpoint)
          .set("Origin", "http://localhost:3000")
          .type("form")
          .send({ token: "invalid", action: "OTHER" })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post(endpoint)
          .type("form")
          .send({ token: "invalid", action: "CANCEL" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(endpoint)
          .set("Origin", "http://localhost:3000")
          .set("Sec-Fetch-Site", "cross-site")
          .type("form")
          .send({ token: "invalid", action: "CANCEL" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(endpoint)
          .set("Origin", "http://localhost:3000")
          .type("form")
          .send({ token: "x".repeat(5000), action: "CANCEL" })
      ).status,
    ).toBe(413);
  });
});

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "signed reminder database boundaries",
  () => {
    afterAll(() => prisma.$disconnect());
    async function fixture() {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable-test-only",
          emailVerifiedAt: new Date(),
          profile: {
            create: {
              firstName: "Private",
              lastName: "Customer",
              phone: "+2348000000000",
            },
          },
        },
        include: { profile: true },
      });
      const service = await prisma.service.create({
        data: {
          name: '<img src=x onerror="alert(1)"> Diagnostics',
          slug: randomUUID(),
          pricingType: "FIXED",
          priceKobo: 10000n,
          durationMinutes: 60,
        },
      });
      const booking = await prisma.booking.create({
        data: {
          customerId: user.profile!.id,
          serviceId: service.id,
          scheduledAt: new Date(Date.now() + 86400000),
          status: "CONFIRMED",
          confirmedAt: new Date(),
          staffNotes: "Private staff note",
        },
      });
      const claims = {
        bookingId: booking.id,
        userId: user.id,
        scheduleVersion: 0,
        expiresAt: Date.now() + 3600000,
      };
      return { user, booking, claims, token: issueBookingActionToken(claims) };
    }
    const submit = (token: string, action: string) =>
      request(app)
        .post(endpoint)
        .set("Origin", "http://localhost:3000")
        .type("form")
        .send({ token, action });
    it("keeps GET/HEAD read-only, escapes content, scopes accounts/schedules and makes successful POST repeats harmless", async () => {
      const f = await fixture();
      const url = `${endpoint}?token=${encodeURIComponent(f.token)}`;
      const page = await request(app).get(url);
      expect(page.status).toBe(200);
      expect(page.text).toContain("&lt;img");
      expect(page.text).not.toContain("<img");
      expect(page.text).not.toContain(f.user.email);
      expect(page.text).not.toContain("Private staff note");
      expect((await request(app).head(url)).status).toBe(200);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }))
          .attendanceConfirmedAt,
      ).toBeNull();
      for (const claims of [
        { ...f.claims, expiresAt: Date.now() - 1000 },
        { ...f.claims, scheduleVersion: 1 },
        { ...f.claims, userId: randomUUID() },
      ]) {
        const token = issueBookingActionToken(claims);
        expect((await request(app).get(endpoint).query({ token })).status).toBe(409);
        expect((await submit(token, "CANCEL")).status).toBe(409);
      }
      for (const action of ["CONFIRM", "CONFIRM", "CANCEL", "CANCEL"])
        expect((await submit(f.token, action)).status).toBe(200);
      expect((await submit(f.token, "CONFIRM")).status).toBe(409);
      const final = await request(app).get(url);
      expect(final.text).toContain("Appointment cancelled");
      expect(final.text).not.toContain("<form");
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
      expect(row.status).toBe("CANCELLED");
      expect(row.depositForfeitedAt).toBeNull();
      expect(row.version).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityId: row.id, entityType: "BOOKING" },
        }),
      ).toBe(2);
    });
    it("rejects links after suspension, lost verification, role change or reschedule, without changing the appointment", async () => {
      const f = await fixture();
      for (const data of [
        { status: "SUSPENDED" as const },
        { status: "ACTIVE" as const, emailVerifiedAt: null },
        { emailVerifiedAt: new Date(), role: "STAFF" as const },
      ]) {
        await prisma.user.update({ where: { id: f.user.id }, data });
        expect((await request(app).get(endpoint).query({ token: f.token })).status).toBe(
          409,
        );
        expect((await submit(f.token, "CONFIRM")).status).toBe(409);
        expect((await submit(f.token, "CANCEL")).status).toBe(409);
      }
      await prisma.user.update({ where: { id: f.user.id }, data: { role: "CUSTOMER" } });
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { scheduleVersion: 1, version: 1 },
      });
      expect((await submit(f.token, "CANCEL")).status).toBe(409);
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
      expect(row.status).toBe("CONFIRMED");
      expect(row.attendanceConfirmedAt).toBeNull();
    });
  },
);
