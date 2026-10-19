import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
const sessions: string[] = [],
  app = createApp({ checkReadiness: async () => undefined });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "workshop support discovery",
  () => {
    let branch: string,
      other: string,
      admin: { id: string; cookie: string },
      staff: { id: string; cookie: string; profile: string },
      customer: { id: string; cookie: string; customerProfileId: string | null },
      unverified: { id: string; cookie: string };
    async function account(role: "ADMIN" | "STAFF" | "CUSTOMER", verified = true) {
      const u = await prisma.user.create({
          data: {
            email: `queue-${randomUUID()}@example.test`,
            passwordHash: "unusable-qa-only",
            role,
            emailVerifiedAt: new Date(),
            ...(role === "CUSTOMER"
              ? {
                  profile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Queue",
                      phone: "+2348000000000",
                    },
                  },
                }
              : {
                  staffProfile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Operator",
                      branchId: branch,
                    },
                  },
                }),
          },
          include: { staffProfile: true, profile: true },
        }),
        token = randomUUID(),
        expiry = new Date(Date.now() + 3600000),
        session = await prisma.session.create({
          data: {
            userId: u.id,
            createdAt: new Date(Date.now() - 1000),
            tokenHash: hashToken("session", token),
            expiresAt: expiry,
            idleExpiresAt: expiry,
            mfaRequired: role !== "CUSTOMER",
            mfaVerifiedAt: verified && role !== "CUSTOMER" ? new Date() : null,
          },
        });
      sessions.push(session.id);
      return {
        id: u.id,
        cookie: `${sessionCookieName}=${token}`,
        profile: u.staffProfile?.id ?? "",
        customerProfileId: u.profile?.id ?? null,
      };
    }
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(actual).toEqual({
        database: env.DB_NAME,
        host: env.DB_HOST,
        port: env.DB_PORT,
      });
      expect(actual?.database).toMatch(/_(test|ci)$/);
      const make = async () =>
        (
          await prisma.branch.create({
            data: {
              code: randomUUID().slice(0, 8),
              name: "Synthetic queue workshop",
              address: "Synthetic",
              city: "Synthetic",
              state: "Synthetic",
            },
          })
        ).id;
      branch = await make();
      other = await make();
      admin = await account("ADMIN");
      staff = await account("STAFF");
      customer = await account("CUSTOMER");
      unverified = await account("STAFF", false);
      for (let n = 0; n < 28; n++) {
        await prisma.enquiry.create({
          data: {
            branchId: branch,
            type: "GENERAL",
            status: "OPEN",
            subject: `Synthetic queue enquiry ${n}`,
            message: "Synthetic private message",
            name: "Synthetic contact",
            email: `queue-${n}@example.test`,
            phone: "+2348000000000",
            assignedStaffId: n === 0 ? staff.profile : null,
            createdAt: new Date(Date.UTC(2026, 9, 18, 9, 0, n, 123)),
          },
        });
        await prisma.complaint.create({
          data: {
            branchId: branch,
            subject: `Synthetic queue complaint ${n}`,
            description: "Synthetic private complaint",
            priority: n === 0 ? "URGENT" : "MEDIUM",
            name: n === 0 ? null : "Synthetic contact",
            customerId: n === 0 ? customer.customerProfileId : null,
            email: n === 0 ? null : `complaint-${n}@example.test`,
            assignedStaffId: n === 0 ? staff.profile : null,
            acknowledgementDueAt: new Date("2026-10-19T09:00:37.123Z"),
            createdAt: new Date(Date.UTC(2026, 9, 18, 9, 0, n, 123)),
          },
        });
      }
      await prisma.enquiry.create({
        data: {
          branchId: other,
          type: "GENERAL",
          subject: "Foreign queue",
          message: "Synthetic",
          name: "Foreign",
          email: "foreign-queue@example.test",
        },
      });
    }, 60000);
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    const get = (kind: string, q: Record<string, string> = {}, cookie = admin.cookie) =>
      request(app)
        .get(`/api/v1/staff/support/${kind}`)
        .query({ limit: "25", ...q })
        .set("Cookie", cookie);
    it("pages both private collections with complete contacts, null legacy fields and read audits", async () => {
      for (const kind of ["enquiries", "complaints"]) {
        const before = await prisma.auditLog.count({
            where: {
              userId: admin.id,
              action: "READ",
              entityType: kind === "enquiries" ? "ENQUIRY" : "COMPLAINT",
            },
          }),
          first = await get(kind, { branchId: branch }).expect(200);
        expect(first.headers["cache-control"]).toBe("private, no-store");
        expect(first.body.data.items).toHaveLength(25);
        const second = await get(kind, {
          branchId: branch,
          cursor: first.body.data.nextCursor,
        }).expect(200);
        expect(second.body.data.items).toHaveLength(3);
        expect(
          new Set(
            [...first.body.data.items, ...second.body.data.items].map(
              (r: { id: string }) => r.id,
            ),
          ).size,
        ).toBe(28);
        expect(second.body.data).not.toHaveProperty("nextCursor");
        expect(second.body.data.items.at(-1).createdAt).toBe("2026-10-18T09:00:00.123Z");
        if (kind === "complaints") {
          expect(second.body.data.items.at(-1).name).toBeNull();
          expect(second.body.data.items.at(-1).email).toBeNull();
        }
        expect(
          await prisma.auditLog.count({
            where: {
              userId: admin.id,
              action: "READ",
              entityType: kind === "enquiries" ? "ENQUIRY" : "COMPLAINT",
            },
          }),
        ).toBe(before + 2);
      }
    });
    it("combines supported filters and enforces current Staff branch and assignment", async () => {
      const enquiry = await get("enquiries", {
        branchId: branch,
        type: "GENERAL",
        status: "OPEN",
        assignedStaffId: staff.profile,
      }).expect(200);
      expect(enquiry.body.data.items).toHaveLength(1);
      const complaint = await get("complaints", {
        branchId: branch,
        priority: "URGENT",
        assignedStaffId: staff.profile,
      }).expect(200);
      expect(complaint.body.data.items).toHaveLength(1);
      expect(complaint.body.data.items[0].acknowledgementDueAt).toBe(
        "2026-10-19T09:00:37.123Z",
      );
      const scoped = await get("enquiries", { branchId: other }, staff.cookie).expect(
        200,
      );
      expect(
        scoped.body.data.items.every((r: { branchId: string }) => r.branchId === branch),
      ).toBe(true);
      await prisma.staffProfile.update({
        where: { id: staff.profile },
        data: { branchId: other },
      });
      const reassigned = await get("enquiries", {}, staff.cookie).expect(200);
      expect(
        reassigned.body.data.items.every(
          (r: { branchId: string }) => r.branchId === other,
        ),
      ).toBe(true);
    });
    it("rejects anonymous/Customer/unverified-MFA and unsupported filters without exposing records", async () => {
      for (const kind of ["enquiries", "complaints"]) {
        await request(app).get(`/api/v1/staff/support/${kind}`).expect(401);
        await get(kind, {}, customer.cookie).expect(403);
        await get(kind, {}, unverified.cookie).expect(403);
      }
      await get("complaints", { type: "GENERAL" }).expect(422);
      await get("enquiries", { search: "private" }).expect(422);
    });
  },
);
