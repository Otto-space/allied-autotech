import { randomUUID, createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Vehicle enquiry intents: real persistence and authorised queues",
  () => {
    let app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    beforeEach(() => {
      // Each case has its own anonymous rate-limit bucket; keep production limits.
      app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let listing: { id: string };
    let draftListing: { id: string };
    const body = {
      type: "VEHICLE",
      vehicleEnquiryIntent: "REQUIREMENTS",
      name: "Synthetic vehicle visitor",
      email: "vehicle-requirements@example.test",
      subject: "Vehicle enquiry: Toyota Corolla",
      message:
        "Toyota Corolla. Foreign used. Maximum budget NGN 15,000,000. This is a request, not confirmed procurement.",
    };
    const submit = (data: unknown) =>
      request(app)
        .post("/api/v1/public/support/enquiries")
        .set("Origin", "http://localhost:3000")
        .send(data);
    beforeAll(async () => {
      if (!/_(?:test|ci)$/.test(process.env.DB_NAME ?? ""))
        throw Error("Use the newly created shop/vehicles isolated target");
      f = await workforceFixture();
      const vehicle = await prisma.vehicle.create({
        data: {
          branchId: f.home.id,
          stockNumber: `INTENT-${randomUUID().slice(0, 16)}`,
          make: "Toyota",
          model: "Corolla",
          year: 2018,
          condition: "FOREIGN_USED",
        },
      });
      const createListing = (status: "AVAILABLE" | "DRAFT") =>
        prisma.vehicleListing.create({
          data: {
            vehicleId: vehicle.id,
            branchId: f.home.id,
            title: "Synthetic listing",
            slug: `intent-${randomUUID()}`,
            priceKobo: 1500000000n,
            status,
            ...(status === "AVAILABLE" ? { publishedAt: new Date() } : {}),
          },
        });
      listing = await createListing("AVAILABLE");
      draftListing = await createListing("DRAFT");
    });
    afterAll(() => prisma.$disconnect());

    it("persists requirements without a listing and exposes them only within permitted queues", async () => {
      const response = await submit({ ...body, branchId: f.home.id }).expect(202);
      const id = response.body.data.id as string;
      expect(await prisma.enquiry.findUniqueOrThrow({ where: { id } })).toMatchObject({
        type: "VEHICLE",
        vehicleEnquiryIntent: "REQUIREMENTS",
        vehicleListingId: null,
        branchId: f.home.id,
        customerId: null,
        message: body.message,
      });
      const queue = (identity: { headers: Record<string, string> }) =>
        request(app).get("/api/v1/staff/workforce/enquiries").set(identity.headers);
      for (const identity of [f.care, f.sales, f.operations]) {
        const result = await queue(identity).expect(200);
        expect(result.body.data.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id, vehicleEnquiryIntent: "REQUIREMENTS" }),
          ]),
        );
      }
      expect((await queue(f.cashier).expect(200)).body.data.items).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id })]),
      );
      await prisma.enquiry.update({
        where: { id },
        data: { assignedStaffId: f.cashier.user.staffProfile!.id },
      });
      expect((await queue(f.cashier).expect(200)).body.data.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id })]),
      );
      const foreignCare = await f.account("CUSTOMER_SERVICE", "STAFF", f.other.id);
      expect((await queue(foreignCare).expect(200)).body.data.items).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id })]),
      );
      await request(app)
        .get(`/api/v1/staff/workforce/enquiries/${id}`)
        .set(foreignCare.headers)
        .expect(404);
      await queue(f.mechanical1).expect(403);
      await queue(f.customer).expect(403);
    });

    it("keeps legacy listing clients valid and derives the listing branch", async () => {
      const { vehicleEnquiryIntent: _intent, ...legacy } = body;
      const response = await submit({ ...legacy, vehicleListingId: listing.id }).expect(
        202,
      );
      expect(
        await prisma.enquiry.findUniqueOrThrow({ where: { id: response.body.data.id } }),
      ).toMatchObject({
        vehicleListingId: listing.id,
        vehicleEnquiryIntent: "LISTING",
        branchId: f.home.id,
      });
      await submit({
        ...legacy,
        vehicleListingId: listing.id,
        branchId: f.other.id,
      }).expect(404);
    });

    it("rejects hidden/stale listings and illegal intent combinations without downgrading", async () => {
      for (const vehicleListingId of [randomUUID(), draftListing.id])
        await submit({
          ...body,
          vehicleEnquiryIntent: "LISTING",
          vehicleListingId,
        }).expect(404);
      await submit({ ...body, branchId: f.home.id, vehicleListingId: listing.id }).expect(
        422,
      );
      await submit({ ...body, vehicleEnquiryIntent: "LISTING" }).expect(422);
      const inactive = await prisma.branch.create({
        data: {
          code: `CLOSED-${randomUUID().slice(0, 6)}`,
          name: "Synthetic inactive workshop",
          address: "Test",
          city: "Test",
          state: "Test",
          isActive: false,
        },
      });
      await submit({ ...body, branchId: inactive.id }).expect(404);
      await submit({ ...body, branchId: randomUUID() }).expect(404);
      await submit(body).expect(409); // Multiple active branches require a choice.
    });

    it("persists owned requirements through the authenticated idempotent workflow", async () => {
      const { name: _name, email: _email, ...owned } = body;
      const key = `support-create-v1.${Date.now()}.${randomUUID()}`;
      const send = () =>
        request(app)
          .post("/api/v1/customers/support/enquiries")
          .set(f.customer.headers)
          .set("Idempotency-Key", key)
          .send({ ...owned, branchId: f.home.id });
      const first = await send().expect(201);
      const replay = await send().expect(201);
      expect(replay.body.data.id).toBe(first.body.data.id);
      expect(replay.body.data.replayed).toBe(true);
      expect(
        await prisma.enquiry.findUniqueOrThrow({ where: { id: first.body.data.id } }),
      ).toMatchObject({
        customerId: f.customer.user.profile!.id,
        vehicleEnquiryIntent: "REQUIREMENTS",
        vehicleListingId: null,
      });
    });

    it("enforces intent/source invariants even when API validation is bypassed", async () => {
      for (const invalid of [
        { type: "VEHICLE" as const },
        { type: "VEHICLE" as const, vehicleEnquiryIntent: "LISTING" as const },
        {
          type: "VEHICLE" as const,
          vehicleEnquiryIntent: "REQUIREMENTS" as const,
          vehicleListingId: listing.id,
        },
        { type: "GENERAL" as const, vehicleEnquiryIntent: "REQUIREMENTS" as const },
      ])
        await expect(
          prisma.enquiry.create({
            data: {
              branchId: f.home.id,
              name: body.name,
              email: body.email,
              subject: body.subject,
              message: body.message,
              ...invalid,
            },
          }),
        ).rejects.toThrow(/aat_enquiry_(target|vehicle_intent)_valid/);
    });
    it("replays a receipt created before the intent field without changing its hash or duplicating a record", async () => {
      const legacy = {
        type: "VEHICLE",
        branchId: f.home.id,
        vehicleListingId: listing.id,
        subject: "Synthetic legacy listing enquiry",
        message: "Original message before the intent expansion.",
      };
      const row = await prisma.enquiry.create({
        data: {
          ...legacy,
          type: "VEHICLE",
          customerId: f.customer.user.profile!.id,
          name: "Synthetic customer",
          email: f.customer.user.email,
        },
      });
      const key = `support-create-v1.${Date.now()}.${randomUUID()}`;
      const digest = (value: string) => createHash("sha256").update(value).digest("hex");
      await prisma.idempotencyRecord.create({
        data: {
          userId: f.customer.user.id,
          scope: `support-create:enquiries:${f.customer.user.id}`,
          keyHash: digest(key),
          requestHash: digest(
            JSON.stringify(
              Object.fromEntries(
                Object.entries(legacy).sort(([a], [b]) => a.localeCompare(b)),
              ),
            ),
          ),
          status: "COMPLETED",
          responseStatus: 201,
          responseBody: { resourceId: row.id },
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      const count = await prisma.enquiry.count();
      const response = await request(app)
        .post("/api/v1/customers/support/enquiries")
        .set(f.customer.headers)
        .set("Idempotency-Key", key)
        .send(legacy)
        .expect(201);
      expect(response.body.data).toMatchObject({ id: row.id, replayed: true });
      expect(await prisma.enquiry.count()).toBe(count);
      expect(
        (await prisma.enquiry.findUniqueOrThrow({ where: { id: row.id } }))
          .vehicleEnquiryIntent,
      ).toBe(null);
    });
  },
);
