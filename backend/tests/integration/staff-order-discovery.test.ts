import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { testOwner } from "../helpers/owner.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
const app = createApp({ checkReadiness: async () => undefined });
const endpoint = "/api/v1/staff/orders",
  sessions: string[] = [];
async function account(role: UserRole, branchId?: string, verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-qa-only")
      : await prisma.user.create({
          data: {
            email: `order-discovery-${randomUUID()}@example.test`,
            passwordHash: "unusable-qa-only",
            role,
            emailVerifiedAt: new Date(),
            ...(role === "CUSTOMER"
              ? {
                  profile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Discovery",
                      phone: "+2348000000000",
                    },
                  },
                }
              : {
                  staffProfile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Discovery",
                      ...(branchId ? { branchId } : {}),
                    },
                  },
                }),
          },
        });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken(),
    expiry = new Date(Date.now() + 3600000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt: expiry,
      idleExpiresAt: expiry,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: verified && role !== "CUSTOMER" ? new Date() : null,
    },
  });
  sessions.push(session.id);
  return {
    user,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: env.FRONTEND_URL[0]!,
      "x-csrf-token": csrf,
    },
  };
}
const branch = (active = true) =>
  prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 10),
      name: "Synthetic discovery workshop",
      address: "Test",
      city: "Test",
      state: "Test",
      isActive: active,
    },
  });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "staff order discovery",
  () => {
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database, host(inet_server_addr()) AS host, inet_server_port() AS port`;
      expect(actual).toEqual({
        database: env.DB_NAME,
        host: env.DB_HOST,
        port: env.DB_PORT,
      });
      expect(actual?.database).toMatch(/_(test|ci)$/);
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    it("finds a full reference beyond page one while enforcing branch, customer and status filters", async () => {
      const own = await branch(),
        foreign = await branch(),
        customer = await account("CUSTOMER"),
        other = await account("CUSTOMER");
      const customerProfile = await prisma.customerProfile.findUniqueOrThrow({
        where: { userId: customer.user.id },
      });
      const otherProfile = await prisma.customerProfile.findUniqueOrThrow({
        where: { userId: other.user.id },
      });
      const prefix = `ORD-${randomUUID().slice(0, 8)}`;
      await prisma.order.createMany({
        data: Array.from({ length: 28 }, (_, n) => ({
          orderNumber: `${prefix}-${String(n).padStart(2, "0")}`,
          branchId: n === 27 ? foreign.id : own.id,
          customerId: customerProfile.id,
          customerName: "Synthetic discovery",
          customerEmail: customer.user.email,
          customerPhone: "+2348000000000",
          subtotalKobo: 10000n,
          totalKobo: 10000n,
          createdAt: new Date(Date.now() - n * 1000),
        })),
      });
      const staff = await account("STAFF", own.id),
        target = `${prefix}-26`;
      const first = await request(app)
        .get(endpoint)
        .query({ limit: 25 })
        .set(staff.headers);
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.data.items).toHaveLength(25);
      expect(first.body.data.nextCursor).toBeTypeOf("string");
      expect(
        first.body.data.items.every(
          (row: { invoice?: unknown; branch: { id: string } }) =>
            !("invoice" in row) && row.branch.id === own.id,
        ),
      ).toBe(true);
      const second = await request(app)
        .get(endpoint)
        .query({ limit: 25, cursor: first.body.data.nextCursor })
        .set(staff.headers);
      expect(second.body.data.items).toHaveLength(2);
      const found = await request(app)
        .get(endpoint)
        .query({
          orderNumber: ` ${target} `,
          status: "PENDING",
          customerId: customerProfile.id,
        })
        .set(staff.headers);
      expect(found.status).toBe(200);
      expect(found.body.data.items).toHaveLength(1);
      expect(found.body.data.items[0].orderNumber).toBe(target);
      for (const query of [
        { orderNumber: target.toLowerCase() },
        { orderNumber: `${prefix}-27`, branchId: foreign.id },
        { orderNumber: target, status: "COMPLETED" },
        { orderNumber: target, customerId: otherProfile.id },
      ]) {
        const res = await request(app).get(endpoint).query(query).set(staff.headers);
        expect(res.status).toBe(200);
        expect(res.body.data.items).toEqual([]);
      }
      for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
        const actor = await account(role),
          res = await request(app)
            .get(endpoint)
            .query({ orderNumber: `${prefix}-27`, branchId: foreign.id })
            .set(actor.headers);
        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0]).toHaveProperty("invoice");
      }
    });
    it("rejects customer, unassigned staff, inactive branch, missing MFA and anonymous access", async () => {
      const inactive = await branch(false),
        active = await branch();
      for (const actor of [
        await account("CUSTOMER"),
        await account("STAFF"),
        await account("STAFF", inactive.id),
        await account("STAFF", active.id, false),
      ])
        expect(
          (
            await request(app)
              .get(endpoint)
              .query({ orderNumber: "ORD-PRIVATE" })
              .set(actor.headers)
          ).status,
        ).toBe(403);
      expect((await request(app).get(endpoint)).status).toBe(401);
    });
    it("reports available transitions and preserves reviewed, versioned, branch-authorized writes", async () => {
      const own = await branch(),
        foreign = await branch(),
        customer = await account("CUSTOMER"),
        staff = await account("STAFF", own.id),
        otherStaff = await account("STAFF", foreign.id);
      const profile = await prisma.customerProfile.findUniqueOrThrow({
        where: { userId: customer.user.id },
      });
      const make = (
        status:
          "PENDING" | "CONFIRMED" | "PROCESSING" | "READY" | "COMPLETED" | "CANCELLED",
        paid: boolean,
      ) =>
        prisma.order.create({
          data: {
            orderNumber: `ORD-${randomUUID().slice(0, 16)}`,
            branchId: own.id,
            customerId: profile.id,
            customerName: "Synthetic detail",
            customerEmail: customer.user.email,
            customerPhone: "+2348000000000",
            subtotalKobo: 10000n,
            totalKobo: 10000n,
            status,
            paidAt: paid ? new Date() : null,
            confirmedAt: ["CONFIRMED", "PROCESSING", "READY", "COMPLETED"].includes(
              status,
            )
              ? new Date()
              : null,
            processingAt: ["PROCESSING", "READY", "COMPLETED"].includes(status)
              ? new Date()
              : null,
            readyAt: ["READY", "COMPLETED"].includes(status) ? new Date() : null,
            completedAt: status === "COMPLETED" ? new Date() : null,
            cancelledAt: status === "CANCELLED" ? new Date() : null,
            cancellationReason: status === "CANCELLED" ? "Synthetic cancellation" : null,
          },
        });
      for (const [status, paid, expected] of [
        ["PENDING", false, ["CANCELLED"]],
        ["PENDING", true, ["CONFIRMED", "CANCELLED"]],
        ["CONFIRMED", true, ["PROCESSING"]],
        ["PROCESSING", true, ["READY"]],
        ["READY", true, ["COMPLETED"]],
        ["COMPLETED", true, []],
        ["CANCELLED", false, []],
      ] as const) {
        const order = await make(status, paid),
          res = await request(app).get(`${endpoint}/${order.id}`).set(staff.headers);
        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toBe("private, no-store");
        expect(res.body.data.allowedTransitions).toEqual(expected);
        expect(res.body.data).not.toHaveProperty("invoice");
      }
      const order = await make("CONFIRMED", true),
        url = `${endpoint}/${order.id}`;
      expect((await request(app).get(url).set(otherStaff.headers)).status).toBe(403);
      expect((await request(app).get(url).set(customer.headers)).status).toBe(403);
      expect(
        (
          await request(app).post(`${url}/status`).set(staff.headers).send({
            status: "CANCELLED",
            expectedVersion: 0,
            reason: "No approved review",
          })
        ).status,
      ).toBe(409);
      await prisma.orderAftercareRequest.create({
        data: {
          orderId: order.id,
          customerId: profile.id,
          kind: "CANCELLATION",
          status: "APPROVED",
          reason: "Synthetic reviewed cancellation",
          reviewReason: "Synthetic approval basis",
          items: [],
          policySnapshot: {},
          approvedFeeKobo: 0n,
          reviewedAt: new Date(),
        },
      });
      expect(
        (await request(app).get(url).set(staff.headers)).body.data.allowedTransitions,
      ).toEqual(["PROCESSING", "CANCELLED"]);
      const changed = await request(app)
        .post(`${url}/status`)
        .set(staff.headers)
        .send({ status: "PROCESSING", expectedVersion: 0 });
      expect(changed.status).toBe(200);
      expect(changed.headers["cache-control"]).toBe("private, no-store");
      expect(changed.body.data.version).toBe(1);
      expect(changed.body.data.allowedTransitions).toEqual(["READY", "CANCELLED"]);
      expect(
        (
          await request(app)
            .post(`${url}/status`)
            .set(staff.headers)
            .send({ status: "READY", expectedVersion: 0 })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .post(`${url}/status`)
            .set({ Cookie: staff.headers.Cookie, Origin: staff.headers.Origin })
            .send({ status: "READY", expectedVersion: 1 })
        ).status,
      ).toBe(403);
      expect(
        await prisma.auditLog.count({
          where: { entityId: order.id, action: "STATUS_CHANGE" },
        }),
      ).toBe(1);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).version,
      ).toBe(1);
    });
    it("validates queries before reading orders", async () => {
      const admin = await account("ADMIN");
      for (const query of [
        "orderNumber=",
        `orderNumber=${"a".repeat(121)}`,
        "orderNumber=a%00b",
        "orderNumber=a&orderNumber=b",
        "branchId=no",
        "status=PAID",
        "limit=101",
        "unexpected=true",
      ])
        expect(
          (await request(app).get(`${endpoint}?${query}`).set(admin.headers)).status,
        ).toBe(422);
    });
  },
);
