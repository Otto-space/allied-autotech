import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { testOwner } from "../helpers/owner.js";
import { testReservationAcceptance } from "../helpers/reservation-terms.js";

const app = createApp({ checkReadiness: async () => undefined });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "administrator invoice discovery",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let admin: Actor, staff: Actor, customer: Actor, owner: Actor, unverified: Actor;
    let customerId: string, branchId: string, staffId: string, productId: string;
    let bookingId: string,
      saleId: string,
      excludedSaleId: string,
      excludedBookingId: string;
    const sessions: string[] = [],
      orders: string[] = [],
      invoiceIds: string[] = [];
    const prefix = `QI-${randomUUID().slice(0, 8)}-`;
    const path = "/api/v1/staff/invoices";
    const get = (suffix: string, who = admin) =>
      request(app)
        .get(path + suffix)
        .set(who.headers);
    const post = (body: unknown, who = admin) =>
      request(app).post(path).set(who.headers).send(body);
    async function auth(id: string, role: string, assured = true): Promise<Actor> {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expires = new Date(Date.now() + 3600000);
      const s = await prisma.session.create({
        data: {
          userId: id,
          createdAt: new Date(Date.now() - 1000),
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt: expires,
          idleExpiresAt: expires,
          mfaRequired: role !== "CUSTOMER",
          mfaVerifiedAt: role !== "CUSTOMER" && assured ? new Date() : null,
        },
      });
      sessions.push(s.id);
      return {
        id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "x-csrf-token": csrf,
        },
      };
    }
    async function account(role: "ADMIN" | "STAFF" | "CUSTOMER") {
      const u = await prisma.user.create({
        data: {
          email: `invoice-${randomUUID()}@example.test`,
          passwordHash: "unusable-qa-only",
          role,
          emailVerifiedAt: new Date(),
          ...(role === "CUSTOMER"
            ? {
                profile: {
                  create: {
                    firstName: "Invoice",
                    lastName: "Customer",
                    phone: "+2348000000000",
                  },
                },
              }
            : {
                staffProfile: { create: { firstName: "Invoice", lastName: "Operator" } },
              }),
        },
        include: { profile: true, staffProfile: true },
      });
      return { user: u, actor: await auth(u.id, role) };
    }
    async function order(n: number, literal = false) {
      return prisma.order.create({
        data: {
          customerId,
          branchId,
          orderNumber: `${prefix}${literal ? "_%" : ""}${n}`,
          subtotalKobo: 18500000n,
          taxKobo: 1387500n,
          totalKobo: 19887500n,
          customerName: "Synthetic Invoice Customer",
          customerEmail: "invoice@example.test",
          customerPhone: "+2348000000000",
          createdAt: new Date(Date.now() - n * 1000),
          items: {
            create: {
              productId,
              productName: "Synthetic recorded part",
              sku: prefix,
              unitPriceKobo: 18500000n,
              quantity: 1,
              subtotalKobo: 18500000n,
            },
          },
        },
      });
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
      const a = await account("ADMIN"),
        s = await account("STAFF"),
        c = await account("CUSTOMER");
      admin = a.actor;
      staff = s.actor;
      customer = c.actor;
      customerId = c.user.profile!.id;
      staffId = a.user.staffProfile!.id;
      owner = await auth((await testOwner("unusable-qa-only")).id, "SUPER_ADMIN");
      unverified = await auth(admin.id, "ADMIN", false);
      branchId = (
        await prisma.branch.create({
          data: {
            code: prefix,
            name: "Synthetic invoice QA",
            address: "Isolated test only",
            city: "Test",
            state: "Test",
            isActive: false,
          },
        })
      ).id;
      const category = await prisma.category.create({
        data: { name: prefix, slug: prefix.toLowerCase() },
      });
      productId = (
        await prisma.product.create({
          data: {
            categoryId: category.id,
            name: "Synthetic invoice part",
            slug: prefix.toLowerCase(),
            sku: prefix,
            priceKobo: 18500000n,
          },
        })
      ).id;
      for (let n = 0; n < 28; n++) orders.push((await order(n)).id);
      const service = await prisma.service.create({
        data: {
          name: prefix + "Service",
          slug: prefix.toLowerCase() + "service",
          pricingType: "QUOTE_REQUIRED",
        },
      });
      bookingId = (
        await prisma.booking.create({
          data: {
            customerId,
            branchId,
            serviceId: service.id,
            scheduledAt: new Date(Date.now() + 86400000),
            quotes: {
              create: {
                createdByStaffId: staffId,
                quoteNumber: prefix + "QUOTE",
                subtotalKobo: 200000n,
                taxKobo: 15000n,
                totalKobo: 215000n,
                items: {
                  create: {
                    type: "LABOUR",
                    description: "Synthetic service",
                    quantity: 1,
                    unitPriceKobo: 200000n,
                    subtotalKobo: 200000n,
                  },
                },
              },
            },
          },
        })
      ).id;
      await prisma.serviceQuote.update({
        where: { quoteNumber: prefix + "QUOTE" },
        data: { status: "ACCEPTED", issuedAt: new Date(), acceptedAt: new Date() },
      });
      excludedBookingId = (
        await prisma.booking.create({
          data: {
            customerId,
            branchId,
            serviceId: service.id,
            scheduledAt: new Date(Date.now() + 86400000),
          },
        })
      ).id;
      const vehicle = await prisma.vehicle.create({
        data: { branchId, stockNumber: prefix, make: "Test", model: "Test", year: 2024 },
      });
      const listing = await prisma.vehicleListing.create({
        data: {
          branchId,
          vehicleId: vehicle.id,
          title: prefix + "Vehicle",
          slug: prefix.toLowerCase(),
          priceKobo: 2000000000n,
        },
      });
      const saleData = {
        vehicleListingId: listing.id,
        customerId,
        customerName: "Synthetic Invoice Customer",
        customerPhone: "+2348000000000",
        askingPriceKobo: 2000000000n,
        agreedPriceKobo: 1900000000n,
      };
      saleId = (
        await prisma.vehicleTransaction.create({
          data: {
            ...saleData,
            transactionNumber: prefix + "SALE",
            status: "PAYMENT_PENDING",
            ...(await testReservationAcceptance()),
          },
        })
      ).id;
      excludedSaleId = (
        await prisma.vehicleTransaction.create({
          data: {
            ...saleData,
            customerId: null,
            transactionNumber: prefix + "ENQUIRY",
            status: "ENQUIRY",
          },
        })
      ).id;
      if (process.env.WORK_INVOICE_FIXTURES)
        writeFileSync(
          process.env.WORK_INVOICE_FIXTURES,
          JSON.stringify(
            {
              admin: admin.id,
              staff: staff.id,
              customer: customer.id,
              owner: owner.id,
              customerId,
              branchId,
              productId,
              staffId,
              prefix,
              orders,
              bookingId,
              saleId,
              excludedBookingId,
              excludedSaleId,
            },
            null,
            2,
          ),
        );
    }, 60000);
    afterAll(async () => {
      if (sessions.length)
        await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    it("pages 25+3 minimal source records without exposing contacts, prices or policy", async () => {
      const first = await get(`/sources?sourceType=ORDER&search=${prefix}&limit=25`);
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.data.items.map((r: { id: string }) => r.id)).toEqual(
        orders.slice(0, 25),
      );
      expect(Object.keys(first.body.data.items[0]).sort()).toEqual(
        [
          "id",
          "sourceType",
          "reference",
          "label",
          "branch",
          "createdAt",
          "updatedAt",
        ].sort(),
      );
      expect(first.body.data.items[0].branch).toEqual({
        id: branchId,
        code: prefix,
        name: "Synthetic invoice QA",
      });
      const second = await get(
        `/sources?sourceType=ORDER&search=${prefix}&limit=25&cursor=${first.body.data.nextCursor}`,
      );
      expect(second.body.data.items.map((r: { id: string }) => r.id)).toEqual(
        orders.slice(25),
      );
      expect(second.body.data.nextCursor).toBeUndefined();
      const selected = await get(`/sources?sourceType=ORDER&sourceId=${orders[27]}`);
      expect(selected.body.data.items.map((r: { id: string }) => r.id)).toEqual([
        orders[27],
      ]);
      expect(
        (await get(`/sources?sourceType=ORDER&search=${orders[27]}`)).body.data,
      ).toEqual(selected.body.data);
      expect(
        (
          await get(
            `/sources?sourceType=ORDER&sourceId=${orders[27]}&search=${orders[0]}`,
          )
        ).body.data.items,
      ).toEqual([]);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { userId: admin.id, entityType: "INVOICE", action: "READ" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit.newValues).toEqual({
        collection: "invoice-sources",
        sourceType: "ORDER",
        resultCount: 0,
      });
    });
    it("treats percent/underscore as literal prefixes and filters eligible service and vehicle records", async () => {
      const special = await order(40, true);
      const r = await get(
        `/sources?sourceType=ORDER&search=${encodeURIComponent(prefix + "_%")}`,
      );
      expect(r.body.data.items.map((v: { id: string }) => v.id)).toEqual([special.id]);
      for (const [kind, included, excluded] of [
        ["BOOKING", bookingId, excludedBookingId],
        ["VEHICLE_TRANSACTION", saleId, excludedSaleId],
      ]) {
        const result = await get(`/sources?sourceType=${kind}&search=${prefix}`);
        expect(result.status).toBe(200);
        expect(result.body.data.items.map((v: { id: string }) => v.id)).toEqual([
          included,
        ]);
        expect(
          (await get(`/sources?sourceType=${kind}&sourceId=${excluded}`)).body.data.items,
        ).toEqual([]);
      }
    });
    it("enforces roles, verified MFA, strict scope and CSRF before source or finance access", async () => {
      for (const who of [staff, customer, unverified]) {
        expect((await get("/sources?sourceType=ORDER", who)).status).toBe(403);
        expect((await get("", who)).status).toBe(403);
        expect(
          (await post({ sourceType: "ORDER", sourceId: orders[0] }, who)).status,
        ).toBe(403);
      }
      expect((await request(app).get(path + "/sources?sourceType=ORDER")).status).toBe(
        401,
      );
      expect((await get("/sources?sourceType=ORDER", owner)).status).toBe(200);
      for (const suffix of [
        "/sources",
        "/sources?sourceType=ORDER&search=x",
        "/sources?sourceType=ORDER&customerId=" + customerId,
        "?sourceId=" + orders[0],
        "?search=QI",
        "?limit=101",
      ])
        expect((await get(suffix)).status).toBe(422);
      expect(
        (
          await request(app)
            .post(path)
            .set("Cookie", admin.headers.Cookie!)
            .set("Origin", env.FRONTEND_URL[0]!)
            .send({ sourceType: "ORDER", sourceId: orders[0] })
        ).status,
      ).toBe(403);
      expect(
        (
          await post({
            sourceType: "ORDER",
            sourceId: orders[0],
            dueAt: "2020-01-01T12:00:00+01:00",
          })
        ).status,
      ).toBe(409);
      expect(
        (await post({ sourceType: "ORDER", sourceId: orders[0], totalKobo: "1" })).status,
      ).toBe(422);
    });
    it("preserves exact invoice filters, 25+3 paging, inactive branch context and minimal read audits", async () => {
      for (let n = 0; n < orders.length; n++) {
        invoiceIds.push(
          (
            await prisma.invoice.create({
              data: {
                customerId,
                orderId: orders[n],
                invoiceNumber: prefix + "INV-" + n,
                subtotalKobo: 18500000n,
                taxKobo: 1387500n,
                totalKobo: 19887500n,
                createdAt: new Date(Date.now() - n * 1000),
              },
            })
          ).id,
        );
      }
      const query = `?customerId=${customerId}&branchId=${branchId}&sourceType=ORDER&status=DRAFT&limit=25`;
      const first = await get(query),
        second = await get(query + `&cursor=${invoiceIds[24]}`);
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.data.items.map((r: { id: string }) => r.id)).toEqual(
        invoiceIds.slice(0, 25),
      );
      expect(second.body.data.items.map((r: { id: string }) => r.id)).toEqual(
        invoiceIds.slice(25),
      );
      const exact = await get(
        `?sourceType=ORDER&sourceId=${orders[27]}&invoiceNumber=${prefix}INV-27`,
      );
      expect(exact.body.data.items.map((r: { id: string }) => r.id)).toEqual([
        invoiceIds[27],
      ]);
      expect(
        (await get(`?invoiceNumber=${prefix}INV-2`)).body.data.items.map(
          (r: { id: string }) => r.id,
        ),
      ).toEqual([invoiceIds[2]]);
      expect(
        (await get(`?invoiceNumber=${prefix.toLowerCase()}INV-2`)).body.data.items,
      ).toEqual([]);
      expect(
        (await get(`/sources?sourceType=ORDER&sourceId=${orders[27]}`)).body.data.items,
      ).toEqual([]);
      const detail = await get(`/${invoiceIds[27]}`);
      expect(detail.status).toBe(200);
      expect(detail.headers["cache-control"]).toBe("private, no-store");
      expect(
        (
          await request(app)
            .get(`/api/v1/customers/invoices/${invoiceIds[27]}`)
            .set(customer.headers)
        ).status,
      ).toBe(404);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          userId: admin.id,
          entityType: "INVOICE",
          action: "READ",
          entityId: null,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit.newValues).not.toHaveProperty("customerId");
    });
    it("creates exact server-priced drafts for all three sources without collecting payments", async () => {
      const fresh = await order(60),
        dueAt = new Date(Date.now() + 86400000).toISOString();
      for (const [sourceType, sourceId, total, key] of [
        ["ORDER", fresh.id, "19887500", "order"],
        ["BOOKING", bookingId, "215000", "booking"],
        ["VEHICLE_TRANSACTION", saleId, "1900000000", "vehicleTransaction"],
      ]) {
        const r = await post({ sourceType, sourceId, dueAt });
        expect(r.status).toBe(201);
        expect(r.body.data).toMatchObject({
          status: "DRAFT",
          version: 0,
          currency: "NGN",
          totalKobo: total,
          dueAt,
          issuedAt: null,
          paidAt: null,
          voidedAt: null,
          payments: [],
          [key!]: { id: sourceId },
        });
        expect(
          await prisma.auditLog.count({
            where: { entityId: r.body.data.id, entityType: "INVOICE", action: "CREATE" },
          }),
        ).toBe(1);
        expect((await post({ sourceType, sourceId })).status).toBe(409);
        expect(
          (
            await get(`?sourceType=${sourceType}&sourceId=${sourceId}`)
          ).body.data.items.map((v: { id: string }) => v.id),
        ).toEqual([r.body.data.id]);
        expect(await prisma.payment.count({ where: { invoiceId: r.body.data.id } })).toBe(
          0,
        );
      }
    });
    it("serializes simultaneous creation and retains exactly one source invoice and CREATE audit", async () => {
      const fresh = await order(61),
        body = { sourceType: "ORDER", sourceId: fresh.id };
      const responses = await Promise.all([post(body), post(body)]);
      expect(responses.map((v) => v.status).sort()).toEqual([201, 409]);
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { orderId: fresh.id },
      });
      expect(
        await prisma.auditLog.count({
          where: { entityId: invoice.id, entityType: "INVOICE", action: "CREATE" },
        }),
      ).toBe(1);
    });
  },
);
