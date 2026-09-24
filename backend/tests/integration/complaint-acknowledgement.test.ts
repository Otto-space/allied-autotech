import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { createApp } from "../../src/app.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionWindow } from "../helpers/session-window.js";

async function account(role: "CUSTOMER" | "STAFF", branchId: string) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-test-only",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Synthetic",
                lastName: "Complainant",
                phone: "+2348000000000",
              },
            },
          }
        : {
            staffProfile: {
              create: { firstName: "Synthetic", lastName: "Handler", branchId },
            },
          }),
    },
    include: { profile: true },
  });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      createdAt: new Date(Date.now() - 1000),
      ...sessionWindow(3600000),
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
    },
  });
  return {
    user,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrf,
    },
  };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Complaint acknowledgement API",
  () => {
    afterAll(() => prisma.$disconnect());
    it("enforces branch and CSRF boundaries and records one acknowledgement under concurrent requests", async () => {
      const app = createApp({ checkReadiness: async () => undefined });
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Synthetic complaint branch",
          address: "Test only",
          city: "Test",
          state: "Test",
        },
      });
      const otherBranch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Other synthetic branch",
          address: "Test only",
          city: "Test",
          state: "Test",
        },
      });
      const customer = await account("CUSTOMER", branch.id),
        first = await account("STAFF", branch.id),
        second = await account("STAFF", branch.id),
        outsider = await account("STAFF", otherBranch.id);
      const complaint = await prisma.complaint.create({
        data: {
          customerId: customer.user.profile!.id,
          branchId: branch.id,
          name: "Synthetic Customer",
          email: customer.user.email,
          subject: "Synthetic acknowledgement issue",
          description: "Synthetic issue for isolated verification",
          priority: "URGENT",
          acknowledgementDueAt: new Date("2026-09-24T10:00:00Z"),
          escalatedAt: new Date("2026-09-24T10:01:00Z"),
        },
      });
      const url = `/api/v1/staff/support/complaints/${complaint.id}/acknowledge`;
      const body = { message: "Synthetic acknowledgement for the customer." };
      expect((await request(app).post(url).set(customer.headers).send(body)).status).toBe(
        403,
      );
      expect((await request(app).post(url).set(outsider.headers).send(body)).status).toBe(
        403,
      );
      expect(
        (
          await request(app)
            .post(url)
            .set({ Cookie: first.headers.Cookie, Origin: first.headers.Origin })
            .send(body)
        ).status,
      ).toBe(403);
      expect(
        (await request(app).post(url).set(first.headers).send({ message: "short" }))
          .status,
      ).toBe(422);
      expect(
        await prisma.supportMessage.count({ where: { complaintId: complaint.id } }),
      ).toBe(0);
      const different = {
        message: "Another synthetic acknowledgement under concurrency.",
      };
      const replies = await Promise.all([
        request(app).post(url).set(first.headers).send(body),
        request(app).post(url).set(second.headers).send(different),
      ]);
      for (const response of replies) {
        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({
          id: complaint.id,
          status: "OPEN",
          resolution: null,
          version: complaint.version,
          acknowledgedAt: expect.any(String),
        });
        expect(response.body.data).not.toHaveProperty("acknowledgedByUserId");
        expect(response.body.data).not.toHaveProperty("slaPolicySnapshot");
      }
      const saved = await prisma.complaint.findUniqueOrThrow({
        where: { id: complaint.id },
      });
      expect([first.user.id, second.user.id]).toContain(saved.acknowledgedByUserId);
      expect(saved.resolvedAt).toBeNull();
      expect(saved.acknowledgementDueAt).toEqual(complaint.acknowledgementDueAt);
      expect(saved.escalatedAt).toEqual(complaint.escalatedAt);
      const messages = await prisma.supportMessage.findMany({
        where: { complaintId: complaint.id },
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ authorType: "STAFF", visibility: "CUSTOMER" });
      expect([body.message, different.message]).toContain(messages[0]!.body);
      expect(
        (
          await request(app).post(url).set(first.headers).send({
            message: "A later response must not replace the first acknowledgement.",
          })
        ).status,
      ).toBe(200);
      expect(
        await prisma.supportMessage.count({ where: { complaintId: complaint.id } }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityType: "COMPLAINT", entityId: complaint.id, action: "UPDATE" },
        }),
      ).toBe(1);
      const own = `/api/v1/customers/support/complaints/${complaint.id}`;
      const detail = await request(app).get(own).set(customer.headers);
      expect(detail.status).toBe(200);
      expect(detail.body.data).toMatchObject({
        acknowledgedAt: saved.acknowledgedAt!.toISOString(),
        status: "OPEN",
        resolution: null,
      });
      expect(detail.body.data).not.toHaveProperty("acknowledgedByUserId");
      const conversation = await request(app)
        .get(`${own}/messages?limit=50`)
        .set(customer.headers);
      expect(conversation.status).toBe(200);
      expect(conversation.body.data.items).toHaveLength(1);
      expect(conversation.body.data.items[0]).toMatchObject({
        body: messages[0]!.body,
        visibility: "CUSTOMER",
      });
      const closed = await prisma.complaint.create({
        data: {
          customerId: customer.user.profile!.id,
          branchId: branch.id,
          name: "Synthetic Customer",
          email: customer.user.email,
          subject: "Closed synthetic complaint",
          description: "Historical acknowledgement test",
          status: "CLOSED",
          resolution: "Synthetic resolution already recorded",
          resolvedAt: new Date(),
          closedAt: new Date(),
        },
      });
      const closedReply = await request(app)
        .post(`/api/v1/staff/support/complaints/${closed.id}/acknowledge`)
        .set(first.headers)
        .send(body);
      expect(closedReply.status).toBe(200);
      expect(closedReply.body.data).toMatchObject({
        id: closed.id,
        status: "CLOSED",
        resolution: closed.resolution,
        acknowledgedAt: expect.any(String),
        resolvedAt: closed.resolvedAt!.toISOString(),
        closedAt: closed.closedAt!.toISOString(),
      });
    });
  },
);
