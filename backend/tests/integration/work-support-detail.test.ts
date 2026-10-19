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
  "workshop support conversation",
  () => {
    let branch: string,
      other: string,
      admin: { id: string; headers: Record<string, string> },
      staff: { id: string; headers: Record<string, string>; profile: string };
    async function account(role: "ADMIN" | "STAFF", branchId = branch) {
      const user = await prisma.user.create({
          data: {
            email: `conversation-${randomUUID()}@example.test`,
            passwordHash: "unusable-qa-only",
            role,
            emailVerifiedAt: new Date(),
            staffProfile: {
              create: { firstName: "Synthetic", lastName: "Conversation", branchId },
            },
          },
          include: { staffProfile: true },
        }),
        token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiry = new Date(Date.now() + 3600000),
        session = await prisma.session.create({
          data: {
            userId: user.id,
            createdAt: new Date(Date.now() - 1000),
            tokenHash: hashToken("session", token),
            csrfTokenHash: hashToken("csrf", csrf),
            expiresAt: expiry,
            idleExpiresAt: expiry,
            mfaRequired: true,
            mfaVerifiedAt: new Date(),
          },
        });
      sessions.push(session.id);
      return {
        id: user.id,
        profile: user.staffProfile!.id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "x-csrf-token": csrf,
        },
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
              name: "Synthetic conversation workshop",
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
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    const enquiry = async () =>
        prisma.enquiry.create({
          data: {
            branchId: branch,
            type: "GENERAL",
            subject: "Synthetic conversation enquiry",
            message: "Synthetic original body",
            name: "Synthetic contact",
            email: "conversation@example.test",
            createdAt: new Date(Date.now() - 5000),
          },
        }),
      complaint = async () =>
        prisma.complaint.create({
          data: {
            branchId: branch,
            subject: "Synthetic conversation complaint",
            description: "Synthetic original complaint",
            name: "Synthetic contact",
            email: "conversation@example.test",
            createdAt: new Date(Date.now() - 5000),
          },
        }),
      base = (kind: string, id: string) => `/api/v1/staff/support/${kind}/${id}`;
    it("returns direct private scoped facts and independent message pages without exposing foreign Staff records", async () => {
      const row = await enquiry(),
        path = base("enquiries", row.id);
      await prisma.supportMessage.createMany({
        data: Array.from({ length: 53 }, (_, n) => ({
          enquiryId: row.id,
          authorUserId: admin.id,
          authorType: "STAFF" as const,
          visibility: n % 2 ? ("INTERNAL" as const) : ("CUSTOMER" as const),
          body: `Synthetic message ${n}`,
          createdAt: new Date(Date.now() - 1000 + n),
        })),
      });
      const detail = await request(app).get(path).set(staff.headers).expect(200);
      expect(detail.headers["cache-control"]).toBe("private, no-store");
      expect(detail.body.data.id).toBe(row.id);
      const first = await request(app)
        .get(path + "/messages?limit=50")
        .set(staff.headers)
        .expect(200);
      expect(first.body.data.items).toHaveLength(50);
      expect(first.body.data.hasMore).toBe(true);
      const next = await request(app)
        .get(path + "/messages?limit=50&cursor=" + first.body.data.cursor)
        .set(staff.headers)
        .expect(200);
      expect(next.body.data.items).toHaveLength(3);
      expect(next.body.data.hasMore).toBe(false);
      expect(
        new Set(
          [...first.body.data.items, ...next.body.data.items].map(
            (r: { id: string }) => r.id,
          ),
        ).size,
      ).toBe(53);
      await prisma.staffProfile.update({
        where: { id: staff.profile },
        data: { branchId: other },
      });
      await request(app).get(path).set(staff.headers).expect(403);
      await request(app)
        .get(path + "/messages")
        .set(staff.headers)
        .expect(403);
      await prisma.staffProfile.update({
        where: { id: staff.profile },
        data: { branchId: branch },
      });
    });
    it("returns exact scoped message receipts beyond the capped embedded history and retains CAS versions", async () => {
      const row = await enquiry(),
        path = base("enquiries", row.id);
      await prisma.supportMessage.createMany({
        data: Array.from({ length: 501 }, (_, n) => ({
          enquiryId: row.id,
          authorUserId: admin.id,
          authorType: "STAFF" as const,
          visibility: "CUSTOMER" as const,
          body: `Old synthetic message ${n}`,
          createdAt: new Date(Date.now() - 86400000 + n),
        })),
      });
      const reply = await request(app)
        .post(path + "/messages")
        .set(admin.headers)
        .send({ message: "New private internal note", visibility: "INTERNAL" })
        .expect(201);
      expect(reply.body.data).toMatchObject({
        conversationId: row.id,
        conversationKind: "enquiries",
        body: "New private internal note",
        visibility: "INTERNAL",
        authorType: "STAFF",
      });
      const status = await request(app)
        .post(path + "/status")
        .set(admin.headers)
        .send({
          expectedVersion: 0,
          status: "RESOLVED",
          response: "Reviewed public enquiry resolution",
        })
        .expect(200);
      expect(status.body.data.version).toBe(1);
      expect(status.body.data.messageReceipt).toMatchObject({
        conversationId: row.id,
        conversationKind: "enquiries",
        body: "Reviewed public enquiry resolution",
        visibility: "CUSTOMER",
        authorType: "STAFF",
      });
      expect(status.body.data.messages).toHaveLength(500);
      expect(
        status.body.data.messages.some(
          (r: { id: string }) => r.id === status.body.data.messageReceipt.id,
        ),
      ).toBe(false);
      await request(app)
        .post(path + "/assignment")
        .set(admin.headers)
        .send({ expectedVersion: 0, assignedStaffId: staff.profile })
        .expect(409);
      expect(await prisma.supportMessage.count({ where: { enquiryId: row.id } })).toBe(
        503,
      );
    });
    it("acknowledges once with exact message/outcome metadata and forbids a new acknowledgement after closure", async () => {
      const row = await complaint(),
        path = base("complaints", row.id),
        body = { message: "Reviewed customer acknowledgement response" };
      const first = await request(app)
        .post(path + "/acknowledge")
        .set(admin.headers)
        .send(body)
        .expect(200);
      expect(first.body.data).toMatchObject({
        acknowledgedNow: true,
        version: 0,
        messageReceipt: {
          conversationId: row.id,
          conversationKind: "complaints",
          body: body.message,
          visibility: "CUSTOMER",
          authorType: "STAFF",
        },
      });
      const repeated = await request(app)
        .post(path + "/acknowledge")
        .set(admin.headers)
        .send({ message: "Different text is not added on repeat" })
        .expect(200);
      expect(repeated.body.data).toMatchObject({
        acknowledgedNow: false,
        messageReceipt: null,
        version: 0,
      });
      expect(await prisma.supportMessage.count({ where: { complaintId: row.id } })).toBe(
        1,
      );
      const closed = await complaint();
      await prisma.complaint.update({
        where: { id: closed.id },
        data: {
          status: "CLOSED",
          resolution: "Synthetic completed resolution",
          resolvedAt: new Date(Date.now() - 2000),
          closedAt: new Date(),
        },
      });
      await request(app)
        .post(base("complaints", closed.id) + "/acknowledge")
        .set(admin.headers)
        .send(body)
        .expect(409);
      expect(
        await prisma.supportMessage.count({ where: { complaintId: closed.id } }),
      ).toBe(0);
      expect(
        (await prisma.complaint.findUniqueOrThrow({ where: { id: closed.id } }))
          .acknowledgedAt,
      ).toBeNull();
    });
    it("serializes staff replies behind a concurrent closure without a later message or audit", async () => {
      const row = await enquiry();
      await prisma.enquiry.update({
        where: { id: row.id },
        data: { status: "RESOLVED", resolvedAt: new Date(Date.now() - 2000) },
      });
      let ready!: () => void, release!: () => void;
      const locked = new Promise<void>((r) => {
          ready = r;
        }),
        hold = new Promise<void>((r) => {
          release = r;
        });
      const closing = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id"=${row.id}::uuid FOR UPDATE`;
        await tx.enquiry.update({
          where: { id: row.id },
          data: { status: "CLOSED", closedAt: new Date() },
        });
        ready();
        await hold;
      });
      await locked;
      const writing = request(app)
        .post(base("enquiries", row.id) + "/messages")
        .set(admin.headers)
        .send({ message: "Must not appear after closure", visibility: "CUSTOMER" })
        .then((r) => r);
      try {
        expect(
          await Promise.race([
            writing.then(() => "finished"),
            new Promise((r) => setTimeout(() => r("waiting"), 100)),
          ]),
        ).toBe("waiting");
      } finally {
        release();
      }
      await closing;
      expect((await writing).status).toBe(409);
      expect(await prisma.supportMessage.count({ where: { enquiryId: row.id } })).toBe(0);
      expect(
        await prisma.auditLog.count({ where: { entityId: row.id, action: "CREATE" } }),
      ).toBe(0);
    });
    it("keeps assignment/priority/status versions independent from replies and returns complaint resolution text", async () => {
      const row = await complaint(),
        path = base("complaints", row.id);
      const assignment = await request(app)
        .post(path + "/assignment")
        .set(admin.headers)
        .send({ expectedVersion: 0, assignedStaffId: staff.profile })
        .expect(200);
      expect(assignment.body.data.version).toBe(1);
      const priority = await request(app)
        .post(path + "/priority")
        .set(admin.headers)
        .send({ expectedVersion: 1, priority: "HIGH" })
        .expect(200);
      expect(priority.body.data.version).toBe(2);
      const status = await request(app)
        .post(path + "/status")
        .set(admin.headers)
        .send({
          expectedVersion: 2,
          status: "RESOLVED",
          resolution: "Exact reviewed complaint resolution",
        })
        .expect(200);
      expect(status.body.data).toMatchObject({
        version: 3,
        resolution: "Exact reviewed complaint resolution",
        messageReceipt: {
          conversationId: row.id,
          conversationKind: "complaints",
          body: "Exact reviewed complaint resolution",
          visibility: "CUSTOMER",
        },
      });
      await request(app)
        .post(path + "/messages")
        .set(admin.headers)
        .send({
          message: "Reply remains permitted while resolved",
          visibility: "CUSTOMER",
        })
        .expect(201);
      expect(
        (await prisma.complaint.findUniqueOrThrow({ where: { id: row.id } })).version,
      ).toBe(3);
    });
  },
);
