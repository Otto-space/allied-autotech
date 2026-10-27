import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "branch-specific Customer Care contacts",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());
    async function fixture(role: "STAFF" | "ADMIN" = "STAFF") {
      const actor = await f.account("CUSTOMER_SERVICE", role);
      await f.assignment(actor.user.id, "SALES_CASHIER", true, f.other.id);
      const create = (branchId: string) =>
        prisma.enquiry.create({
          data: {
            type: "PRODUCT",
            productId: f.enquiry.productId,
            branchId,
            assignedStaffId: actor.user.staffProfile!.id,
            customerId: f.customer.user.profile!.id,
            name: "Synthetic recorded name",
            email: f.customer.user.email,
            phone: "+2348000000000",
            subject: `Synthetic scope proof ${randomUUID()}`,
            message: "Synthetic assigned sales question",
          },
        });
      return { actor, own: await create(f.home.id), other: await create(f.other.id) };
    }
    const get = (actor: { headers: Record<string, string> }, path: string) =>
      request(app).get(`/api/v1/staff/workforce/enquiries${path}`).set(actor.headers);
    for (const role of ["STAFF", "ADMIN"] as const)
      it(`${role} care in one branch never supplies contact data for an assigned sales-only case in another`, async () => {
        const v = await fixture(role);
        const home = await get(v.actor, `/${v.own.id}`);
        expect(home.status).toBe(200);
        expect(home.body.data.contact.email).toBe(f.customer.user.email);
        const other = await get(v.actor, `/${v.other.id}`);
        expect(other.status).toBe(200);
        expect(other.body.data.id).toBe(v.other.id);
        expect(other.body.data).not.toHaveProperty("contact");
        for (const key of ["name", "email", "phone", "customerId", "customer"])
          expect(other.body.data).not.toHaveProperty(key);
        const page = await get(v.actor, `?q=${encodeURIComponent(v.other.subject)}`);
        expect(page.status).toBe(200);
        expect(page.body.data.items).toHaveLength(1);
        expect(page.body.data.items[0]).not.toHaveProperty("contact");
        expect(JSON.stringify(page.body.data)).not.toContain(f.customer.user.email);
      });
    for (const retainedSales of [true, false])
      it(`rechecks natural Care expiry after a locked record wait (sales retained: ${retainedSales})`, async () => {
        const v = await fixture();
        const row = retainedSales ? v.other : v.own;
        const care = retainedSales
          ? await f.assignment(v.actor.user.id, "CUSTOMER_SERVICE", true, f.other.id)
          : await prisma.workforceAssignment.findFirstOrThrow({
              where: {
                userId: v.actor.user.id,
                template: "CUSTOMER_SERVICE",
                branchId: f.home.id,
              },
            });
        const expiresAt = new Date(Date.now() + 1800);
        await prisma.workforceAssignment.update({
          where: { id: care.id },
          data: { expiresAt },
        });
        let unlock!: () => void, ready!: () => void;
        const blocked = new Promise<void>((resolve) => (unlock = resolve)),
          locked = new Promise<void>((resolve) => (ready = resolve));
        const holder = prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id"=${row.id}::uuid FOR UPDATE`;
          ready();
          await blocked;
        });
        await locked;
        const response = get(v.actor, `/${row.id}`).then((result) => result);
        try {
          const deadline = Date.now() + 1400;
          let waiting = false;
          while (Date.now() < deadline) {
            const [state] = await prisma.$queryRaw<
              { waiting: boolean }[]
            >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND wait_event_type='Lock' AND query LIKE '%Enquiry%FOR SHARE%') AS waiting`;
            if (state?.waiting) {
              waiting = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 15));
          }
          expect(waiting).toBe(true);
          while (Date.now() <= expiresAt.getTime())
            await new Promise((resolve) => setTimeout(resolve, 20));
        } finally {
          unlock();
          await holder;
        }
        const result = await response;
        if (retainedSales) {
          expect(result.status).toBe(200);
          expect(result.body.data).not.toHaveProperty("contact");
        } else {
          expect(result.status).toBe(404);
          expect(result.body).not.toHaveProperty("data");
        }
      });
    it("preserves the shared complaint-contact projection under its existing branch scope", async () => {
      const complaint = await prisma.complaint.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId: f.home.id,
          subject: "Synthetic complaint contact regression",
          description: "Synthetic complaint details for the shared projection",
          name: "Synthetic recorded customer",
          email: f.customer.user.email,
          phone: "+2348000000000",
        },
      });
      const read = await request(app)
        .get(`/api/v1/staff/workforce/complaints/${complaint.id}`)
        .set(f.care.headers);
      expect(read.status).toBe(200);
      expect(read.body.data.contact.email).toBe(f.customer.user.email);
      expect(
        (
          await request(app)
            .get(`/api/v1/staff/workforce/complaints/${complaint.id}`)
            .set(f.cashier.headers)
        ).status,
      ).toBe(403);
    });
    it("removes same-branch Care contact after expiry while retaining assigned sales access and another branch's Care grant", async () => {
      const v = await fixture(),
        cover = await f.assignment(v.actor.user.id, "CUSTOMER_SERVICE", true, f.other.id);
      expect((await get(v.actor, `/${v.other.id}`)).body.data.contact.email).toBe(
        f.customer.user.email,
      );
      await prisma.workforceAssignment.update({
        where: { id: cover.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const result = await get(v.actor, `/${v.other.id}`);
      expect(result.status).toBe(200);
      expect(result.body.data).not.toHaveProperty("contact");
      expect((await get(v.actor, `/${v.own.id}`)).body.data.contact.email).toBe(
        f.customer.user.email,
      );
    });
  },
);
