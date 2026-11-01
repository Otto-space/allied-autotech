import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { reviewSourceCustomer } from "../helpers/review-sources.js";
import {
  supportCreationSources,
  supportCreationKey,
} from "../helpers/support-creation.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "structured service group enquiries",
  () => {
    const app = createApp();
    afterAll(() => prisma.$disconnect());
    const base = {
      type: "SERVICE",
      subject: "Service request: Vehicle AC Maintenance",
      message: "Please assess the cooling in my vehicle.",
    };
    const post = (
      customer: Awaited<ReturnType<typeof reviewSourceCustomer>>,
      body: unknown,
      key = supportCreationKey(),
    ) =>
      request(app)
        .post("/api/v1/customers/support/enquiries")
        .set("Cookie", customer.cookie)
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", customer.csrf)
        .set("Idempotency-Key", key)
        .send(body);
    it("persists a main-service-only request, replays once and prevents cross-customer reading", async () => {
      const customer = await reviewSourceCustomer();
      const f = await supportCreationSources(customer.customerId);
      const category = await prisma.serviceCategory.create({
        data: { name: "Vehicle AC Maintenance", slug: randomUUID() },
      });
      const body = { ...base, branchId: f.branchId, serviceCategoryId: category.id };
      const key = supportCreationKey();
      const first = await post(customer, body, key);
      expect(first.status).toBe(201);
      expect(first.body.data.serviceCategoryId).toBe(category.id);
      expect(first.body.data.serviceId).toBeNull();
      const again = await post(customer, body, key);
      expect(again.status).toBe(201);
      expect(again.body.data.id).toBe(first.body.data.id);
      expect(
        await prisma.enquiry.count({
          where: { customerId: customer.customerId, serviceCategoryId: category.id },
        }),
      ).toBe(1);
      const other = await reviewSourceCustomer();
      const read = await request(app)
        .get(`/api/v1/customers/support/enquiries/${first.body.data.id}`)
        .set("Cookie", other.cookie);
      expect(read.status).toBe(404);
    });
    it("rejects inactive groups, mismatched jobs and missing targets without creating records", async () => {
      const customer = await reviewSourceCustomer();
      const f = await supportCreationSources(customer.customerId);
      const category = await prisma.serviceCategory.create({
        data: { name: "Other main service", slug: randomUUID() },
      });
      expect(
        (
          await post(customer, {
            ...base,
            branchId: f.branchId,
            serviceCategoryId: category.id,
            serviceId: f.serviceId,
          })
        ).status,
      ).toBe(404);
      await prisma.serviceCategory.update({
        where: { id: category.id },
        data: { isActive: false },
      });
      expect(
        (
          await post(customer, {
            ...base,
            branchId: f.branchId,
            serviceCategoryId: category.id,
          })
        ).status,
      ).toBe(404);
      expect((await post(customer, { ...base, branchId: f.branchId })).status).toBe(422);
      expect(
        await prisma.enquiry.count({ where: { customerId: customer.customerId } }),
      ).toBe(0);
    });
    it("keeps an unlisted product request owned without inventing inventory", async () => {
      const customer = await reviewSourceCustomer();
      const f = await supportCreationSources(customer.customerId);
      const response = await post(customer, {
        type: "PRODUCT",
        subject: "Parts request",
        message: "Please quote a replacement filter; quantity two.",
        branchId: f.branchId,
      });
      expect(response.status).toBe(201);
      expect(response.body.data.productId).toBeNull();
      const saved = await prisma.enquiry.findUniqueOrThrow({
        where: { id: response.body.data.id },
      });
      expect(saved.customerId).toBe(customer.customerId);
      expect(saved.type).toBe("PRODUCT");
    });
  },
);
