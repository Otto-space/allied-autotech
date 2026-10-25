import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "public unlisted parts enquiry persistence",
  () => {
    const app = createApp();
    let branchId: string;
    beforeAll(async () => {
      if (!/_(test|ci)$/.test(process.env.DB_NAME ?? ""))
        throw new Error("This suite requires a newly created isolated test database");
      const branch = await prisma.branch.create({
        data: {
          code: `PARTS-${randomUUID().slice(0, 8)}`,
          name: "Isolated public-parts workshop",
          address: "Synthetic test address",
          city: "Port Harcourt",
          state: "Rivers",
        },
      });
      branchId = branch.id;
    });
    afterAll(() => prisma.$disconnect());

    it("persists a public Product enquiry with no fabricated product reference", async () => {
      const response = await request(app)
        .post("/api/v1/public/support/enquiries")
        .set("Origin", "http://localhost:3000")
        .send({
          type: "PRODUCT",
          branchId,
          name: "Synthetic test visitor",
          email: `parts-${randomUUID()}@example.test`,
          subject: "Unlisted replacement filter",
          message: "Please verify a suitable filter for the vehicle details supplied.",
        });
      expect(response.status).toBe(202);
      const saved = await prisma.enquiry.findUniqueOrThrow({
        where: { id: response.body.data.id },
      });
      expect(saved).toMatchObject({
        type: "PRODUCT",
        branchId,
        customerId: null,
        productId: null,
      });
    });

    it("keeps the database requirement for customer-linked Product enquiries", async () => {
      const user = await prisma.user.create({
        data: {
          email: `linked-parts-${randomUUID()}@example.test`,
          passwordHash: "synthetic-not-an-authentication-fixture",
          role: "CUSTOMER",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          profile: {
            create: {
              firstName: "Synthetic",
              lastName: "Customer",
              phone: `+234803${Date.now().toString().slice(-7)}`,
            },
          },
        },
        select: { profile: { select: { id: true } } },
      });
      await expect(
        prisma.enquiry.create({
          data: {
            type: "PRODUCT",
            branchId,
            customerId: user.profile!.id,
            name: "Synthetic linked customer",
            email: "linked-constraint@example.test",
            subject: "Invalid linked enquiry",
            message: "A customer-linked product still requires its real reference.",
          },
        }),
      ).rejects.toThrow(/aat_enquiry_target_valid/);
    });

    it("retains the source requirement for other public enquiry categories", async () => {
      await expect(
        prisma.enquiry.create({
          data: {
            type: "SERVICE",
            branchId,
            name: "Synthetic visitor",
            email: "invalid-source@example.test",
            subject: "Invalid service reference",
            message: "A service enquiry still requires its real service reference.",
          },
        }),
      ).rejects.toThrow(/aat_enquiry_target_valid/);
    });
  },
);
