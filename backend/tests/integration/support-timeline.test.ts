import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
describe.skipIf(process.env.RUN_SUPPORT_TIMELINE_TESTS !== "true")(
  "support timeline events",
  () => {
    let branch: string;
    let admin: Awaited<ReturnType<typeof account>>,
      customer: Awaited<ReturnType<typeof account>>,
      other: Awaited<ReturnType<typeof account>>;
    async function account(role: "ADMIN" | "CUSTOMER") {
      const user = await prisma.user.create({
        data: {
          email: `timeline-${randomUUID()}@example.test`,
          role,
          emailVerifiedAt: new Date(),
          passwordHash: "unusable-synthetic-fixture",
          ...(role === "CUSTOMER"
            ? {
                profile: {
                  create: {
                    firstName: "Synthetic",
                    lastName: "Timeline",
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
        include: { profile: true },
      });
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiry = new Date(Date.now() + 3600000);
      await prisma.session.create({
        data: {
          createdAt: new Date(Date.now() - 1000),
          userId: user.id,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt: expiry,
          idleExpiresAt: expiry,
          mfaRequired: role === "ADMIN",
          mfaVerifiedAt: role === "ADMIN" ? new Date() : null,
        },
      });
      return {
        user,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "X-CSRF-Token": csrf,
        },
      };
    }
    const staffPath = (kind: string, id: string) => `/api/v1/staff/support/${kind}/${id}`;
    const customerPath = (kind: string, id: string) =>
      `/api/v1/customers/support/${kind}/${id}/messages`;
    const enquiry = () =>
      prisma.enquiry.create({
        data: {
          branchId: branch,
          customerId: customer.user.profile!.id,
          type: "GENERAL",
          name: "Synthetic",
          email: "timeline@example.test",
          subject: "Synthetic enquiry",
          message: "Original question",
        },
      });
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      const actual = await prisma.$queryRaw<
        { name: string }[]
      >`SELECT current_database() AS name`;
      expect(actual[0]?.name).toBe(env.DB_NAME);
      branch = (
        await prisma.branch.create({
          data: {
            code: randomUUID().slice(0, 8),
            name: "Synthetic workshop",
            address: "Synthetic",
            city: "Synthetic",
            state: "Synthetic",
          },
        })
      ).id;
      admin = await account("ADMIN");
      customer = await account("CUSTOMER");
      other = await account("CUSTOMER");
    });
    afterAll(async () => {
      await prisma.$disconnect();
    });
    it("records a status event even without explanation, distinguishes replies/notes and notifies only customer-visible changes", async () => {
      const row = await enquiry(),
        base = staffPath("enquiries", row.id);
      const status = await request(app)
        .post(`${base}/status`)
        .set(admin.headers)
        .send({ expectedVersion: 0, status: "IN_PROGRESS" })
        .expect(200);
      const event = status.body.data.messageReceipt;
      expect(event).toMatchObject({
        kind: "STATUS_CHANGE",
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        body: "No additional explanation was provided.",
        visibility: "CUSTOMER",
      });
      const reply = await request(app)
        .post(`${base}/messages`)
        .set(admin.headers)
        .send({ message: "Please send a photo", visibility: "CUSTOMER" })
        .expect(201);
      const note = await request(app)
        .post(`${base}/messages`)
        .set(admin.headers)
        .send({ message: "Private staff coordination", visibility: "INTERNAL" })
        .expect(201);
      expect(reply.body.data.kind).toBe("REPLY");
      expect(note.body.data.kind).toBe("INTERNAL_NOTE");
      const visible = await request(app)
        .get(customerPath("enquiries", row.id))
        .set(customer.headers)
        .expect(200);
      expect(visible.body.data.items.map((m: { kind: string }) => m.kind)).toEqual([
        "STATUS_CHANGE",
        "REPLY",
      ]);
      expect(JSON.stringify(visible.body)).not.toContain("Private staff coordination");
      const staff = await request(app)
        .get(`${base}/messages`)
        .set(admin.headers)
        .expect(200);
      expect(staff.body.data.items).toHaveLength(3);
      const notifications = await prisma.notification.findMany({
        where: { resourceId: row.id, userId: customer.user.id },
        orderBy: { createdAt: "asc" },
      });
      expect(notifications.map((n) => n.title)).toEqual([
        "Your enquiry is now in progress",
        "New support reply",
      ]);
      expect(notifications.map((n) => n.supportMessageId)).toEqual([
        event.id,
        reply.body.data.id,
      ]);
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateType: "SupportCustomerEmail",
            aggregateId: row.id,
          },
        }),
      ).toBe(2);
      expect(
        await prisma.notificationDelivery.count({
          where: {
            notificationId: { in: notifications.map((n) => n.id) },
          },
        }),
      ).toBe(0);
      await request(app)
        .get(customerPath("enquiries", row.id))
        .query({ messageId: note.body.data.id })
        .set(customer.headers)
        .expect(404);
    });
    it("opens an exact entry beyond the first page while rejecting foreign records and forged event fields", async () => {
      const row = await enquiry(),
        foreign = await enquiry();
      await prisma.supportMessage.createMany({
        data: Array.from({ length: 55 }, (_, i) => ({
          enquiryId: row.id,
          authorType: "STAFF" as const,
          authorUserId: admin.user.id,
          body: `Historical ${i}`,
          createdAt: new Date(Date.now() - 100000 + i),
        })),
      });
      const reply = await request(app)
        .post(`${staffPath("enquiries", row.id)}/messages`)
        .set(admin.headers)
        .send({ message: "Target reply" })
        .expect(201);
      const selected = await request(app)
        .get(customerPath("enquiries", row.id))
        .query({ messageId: reply.body.data.id, limit: 1 })
        .set(customer.headers)
        .expect(200);
      expect(selected.body.data.items[0].id).toBe(reply.body.data.id);
      await request(app)
        .get(customerPath("enquiries", foreign.id))
        .query({ messageId: reply.body.data.id })
        .set(customer.headers)
        .expect(404);
      await request(app)
        .get(customerPath("enquiries", row.id))
        .query({ messageId: reply.body.data.id })
        .set(other.headers)
        .expect(404);
      await request(app)
        .post(`${staffPath("enquiries", row.id)}/messages`)
        .set(admin.headers)
        .send({
          message: "Forged",
          kind: "STATUS_CHANGE",
          fromStatus: "OPEN",
          toStatus: "CLOSED",
        })
        .expect(422);
      await request(app)
        .post(`${staffPath("enquiries", row.id)}/status`)
        .set(customer.headers)
        .send({ expectedVersion: 0, status: "IN_PROGRESS" })
        .expect(403);
      const history = await request(app)
        .get(customerPath("enquiries", row.id))
        .set(customer.headers)
        .expect(200);
      expect(history.body.data.items[0]).toMatchObject({
        kind: "LEGACY",
        fromStatus: null,
        toStatus: null,
        body: "Historical 0",
      });
    });
    it("stores the complaint resolution with its status event and prevents duplicate events from stale transitions", async () => {
      const row = await prisma.complaint.create({
        data: {
          branchId: branch,
          customerId: customer.user.profile!.id,
          subject: "Synthetic complaint",
          description: "Original concern",
        },
      });
      const base = staffPath("complaints", row.id);
      const responses = await Promise.all(
        [0, 1].map(() =>
          request(app).post(`${base}/status`).set(admin.headers).send({
            expectedVersion: 0,
            status: "RESOLVED",
            resolution: "Repair verified with customer",
          }),
        ),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await prisma.supportMessage.count({ where: { complaintId: row.id } })).toBe(
        1,
      );
      expect(await prisma.notification.count({ where: { resourceId: row.id } })).toBe(1);
      const saved = responses.find((r) => r.status === 200)!.body.data;
      expect(saved.resolution).toBe("Repair verified with customer");
      expect(saved.messageReceipt).toMatchObject({
        kind: "STATUS_CHANGE",
        fromStatus: "OPEN",
        toStatus: "RESOLVED",
        body: saved.resolution,
      });
      await request(app)
        .post(`${base}/status`)
        .set(admin.headers)
        .send({ expectedVersion: 1, status: "CLOSED" })
        .expect(200);
      const visible = await request(app)
        .get(customerPath("complaints", row.id))
        .set(customer.headers)
        .expect(200);
      expect(visible.body.data.items.at(-1)).toMatchObject({
        kind: "STATUS_CHANGE",
        fromStatus: "RESOLVED",
        toStatus: "CLOSED",
      });
    });
    it("enforces event shape in the database without rewriting legacy content", async () => {
      const row = await enquiry();
      await expect(
        prisma.supportMessage.create({
          data: {
            enquiryId: row.id,
            authorType: "CUSTOMER",
            authorUserId: customer.user.id,
            kind: "STATUS_CHANGE",
            fromStatus: "OPEN",
            toStatus: "IN_PROGRESS",
            body: "Forged event",
          },
        }),
      ).rejects.toThrow("SupportMessage_event_shape_check");
      await expect(
        prisma.supportMessage.create({
          data: {
            enquiryId: row.id,
            authorType: "STAFF",
            authorUserId: admin.user.id,
            visibility: "CUSTOMER",
            kind: "INTERNAL_NOTE",
            body: "Wrong visibility",
          },
        }),
      ).rejects.toThrow("SupportMessage_event_shape_check");
      const legacy = await prisma.supportMessage.create({
        data: {
          enquiryId: row.id,
          authorType: "STAFF",
          authorUserId: admin.user.id,
          body: "Original historical wording",
        },
      });
      expect(legacy).toMatchObject({
        kind: "LEGACY",
        body: "Original historical wording",
        fromStatus: null,
        toStatus: null,
      });
    });
    it("preserves event types in managed staff views and notifies customers about managed replies", async () => {
      const operator = await account("ADMIN");
      await prisma.workforceAccess.create({
        data: {
          userId: operator.user.id,
          position: "CUSTOMER_SERVICE",
          updatedByUserId: admin.user.id,
          assignments: {
            create: {
              template: "CUSTOMER_SERVICE",
              branchId: branch,
              scope: "BRANCH",
              startsAt: new Date(Date.now() - 1000),
              reason: "Synthetic responsibility",
              assignedByUserId: admin.user.id,
            },
          },
        },
      });
      const row = await enquiry();
      await request(app)
        .post(`${staffPath("enquiries", row.id)}/status`)
        .set(admin.headers)
        .send({
          expectedVersion: 0,
          status: "IN_PROGRESS",
          response: "Investigation underway",
        })
        .expect(200);
      const detail = await request(app)
        .get(`/api/v1/staff/workforce/enquiries/${row.id}`)
        .set(operator.headers)
        .expect(200);
      expect(detail.body.data.messages.items[0]).toMatchObject({
        kind: "STATUS_CHANGE",
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
      });
      const reply = await request(app)
        .post(`/api/v1/staff/workforce/enquiries/${row.id}/replies`)
        .set(operator.headers)
        .send({
          expectedVersion: 1,
          body: "Managed staff reply",
          expectedLatestMessageId: detail.body.data.latestMessageId,
        })
        .expect(200);
      expect(reply.body.data.messageReceipt.kind).toBe("REPLY");
      expect(
        await prisma.notification.findFirst({
          where: { supportMessageId: reply.body.data.messageReceipt.id },
        }),
      ).toMatchObject({ userId: customer.user.id, title: "New support reply" });
      const complaint = await prisma.complaint.create({
        data: {
          branchId: branch,
          customerId: customer.user.profile!.id,
          subject: "Managed complaint",
          description: "Synthetic concern",
        },
      });
      const complaintReply = await request(app)
        .post(`/api/v1/staff/workforce/complaints/${complaint.id}/replies`)
        .set(operator.headers)
        .send({
          expectedVersion: 0,
          body: "Managed complaint reply",
          expectedLatestMessageId: null,
        })
        .expect(200);
      expect(complaintReply.body.data.messageReceipt.kind).toBe("REPLY");
      expect(
        await prisma.notification.findFirst({
          where: { supportMessageId: complaintReply.body.data.messageReceipt.id },
        }),
      ).toMatchObject({ userId: customer.user.id, title: "New support reply" });
    });
  },
);
