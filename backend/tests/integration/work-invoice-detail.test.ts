import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { testOwner } from "../helpers/owner.js";
const app = createApp({ checkReadiness: async () => undefined });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "administrator invoice document and lifecycle",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let admin: Actor, staff: Actor, customer: Actor, owner: Actor, unverified: Actor;
    let customerId: string, branchId: string, productId: string;
    const sessions: string[] = [],
      orders: string[] = [],
      invoices: string[] = [];
    const path = "/api/v1/staff/invoices";
    const get = (suffix: string, who = admin) =>
      request(app)
        .get(path + suffix)
        .set(who.headers);
    const post = (suffix: string, body: unknown, who = admin) =>
      request(app)
        .post(path + suffix)
        .set(who.headers)
        .send(body);
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
      return prisma.user.create({
        data: {
          email: `invoice-detail-${randomUUID()}@example.test`,
          passwordHash: "unusable-qa-only",
          role,
          emailVerifiedAt: new Date(),
          ...(role === "CUSTOMER"
            ? {
                profile: {
                  create: {
                    firstName: "Synthetic",
                    lastName: "Invoice",
                    phone: "+2348000000000",
                  },
                },
              }
            : {
                staffProfile: {
                  create: { firstName: "Synthetic", lastName: "Operator" },
                },
              }),
        },
        include: { profile: true },
      });
    }
    async function order() {
      return prisma.order.create({
        data: {
          customerId,
          branchId,
          orderNumber: `QID-${randomUUID().slice(0, 16)}`,
          subtotalKobo: 18500000n,
          taxKobo: 1387500n,
          totalKobo: 19887500n,
          customerName: "Synthetic Invoice Customer",
          customerEmail: "invoice-detail@example.test",
          customerPhone: "+2348000000000",
          items: {
            create: {
              productId,
              productName: "Synthetic recorded replacement part",
              sku: "QID",
              quantity: 1,
              unitPriceKobo: 18500000n,
              subtotalKobo: 18500000n,
            },
          },
        },
      });
    }
    const pdf = (suffix: string, who = admin) =>
      get(suffix, who)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (v: Buffer) => chunks.push(v));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
          res.on("error", callback);
        });
    beforeAll(async () => {
      const [target] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(target).toEqual({
        database: env.DB_NAME,
        host: env.DB_HOST,
        port: env.DB_PORT,
      });
      expect(target?.database).toMatch(/_(test|ci)$/);
      const base = process.env.WORK_INVOICE_FIXTURES;
      if (base && existsSync(base)) {
        const f = JSON.parse(readFileSync(base, "utf8"));
        admin = await auth(f.admin, "ADMIN");
        staff = await auth(f.staff, "STAFF");
        customer = await auth(f.customer, "CUSTOMER");
        owner = await auth(f.owner, "SUPER_ADMIN");
        customerId = f.customerId;
        branchId = f.branchId;
        productId = f.productId;
      } else {
        const a = await account("ADMIN"),
          s = await account("STAFF"),
          c = await account("CUSTOMER");
        admin = await auth(a.id, "ADMIN");
        staff = await auth(s.id, "STAFF");
        customer = await auth(c.id, "CUSTOMER");
        customerId = c.profile!.id;
        owner = await auth((await testOwner("unusable-qa-only")).id, "SUPER_ADMIN");
        branchId = (
          await prisma.branch.create({
            data: {
              code: `QID-${randomUUID().slice(0, 8)}`,
              name: "Synthetic invoice detail workshop",
              address: "Isolated test only",
              city: "Test",
              state: "Test",
            },
          })
        ).id;
        const suffix = randomUUID();
        const category = await prisma.category.create({
          data: { name: "Synthetic invoice detail", slug: suffix },
        });
        productId = (
          await prisma.product.create({
            data: {
              categoryId: category.id,
              name: "Synthetic invoice part",
              slug: suffix,
              sku: suffix,
              priceKobo: 18500000n,
            },
          })
        ).id;
      }
      unverified = await auth(admin.id, "ADMIN", false);
      for (let n = 0; n < 3; n++) {
        const source = await order();
        orders.push(source.id);
        const r = await post("", { sourceType: "ORDER", sourceId: source.id });
        expect(r.status).toBe(201);
        invoices.push(r.body.data.id);
      }
      if (process.env.WORK_INVOICE_DETAIL_FIXTURES)
        writeFileSync(
          process.env.WORK_INVOICE_DETAIL_FIXTURES,
          JSON.stringify(
            {
              admin: admin.id,
              staff: staff.id,
              customer: customer.id,
              owner: owner.id,
              customerId,
              branchId,
              productId,
              orders,
              invoices,
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
    it("returns exact snapshot-backed draft documents with private headers and minimal administrator audits", async () => {
      for (const who of [admin, owner]) {
        const r = await get(`/${invoices[0]}/document`, who);
        expect(r.status).toBe(200);
        expect(r.headers["cache-control"]).toBe("private, no-store");
        expect(r.headers["x-content-type-options"]).toBe("nosniff");
        expect(r.body.data).toMatchObject({
          id: invoices[0],
          status: "DRAFT",
          version: 0,
          source: { id: orders[0], type: "ORDER" },
          detailBasis: "SNAPSHOT",
          totalKobo: "19887500",
          taxKobo: "1387500",
          issuedAt: null,
          paidAt: null,
          voidedAt: null,
          receipts: [],
          paymentRequests: [],
        });
        expect(r.body.data.lines).toEqual([
          {
            description: "Synthetic recorded replacement part",
            quantity: 1,
            unitPriceKobo: "18500000",
            subtotalKobo: "18500000",
          },
        ]);
        expect(r.body.data).not.toHaveProperty("policySnapshot");
        expect(r.body.data).not.toHaveProperty("customerEmail");
      }
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          userId: admin.id,
          entityType: "INVOICE",
          entityId: invoices[0],
          action: "READ",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit.newValues).toEqual({
        document: "invoice",
        format: "document",
        version: 0,
        status: "DRAFT",
      });
    });
    it("guards staff documents/downloads independently by role, MFA and strict invoice scope", async () => {
      for (const who of [staff, customer, unverified])
        for (const suffix of [
          "document",
          "download?expectedVersion=0&expectedStatus=DRAFT",
        ])
          expect((await get(`/${invoices[0]}/${suffix}`, who)).status).toBe(403);
      expect((await request(app).get(path + `/${invoices[0]}/document`)).status).toBe(
        401,
      );
      expect((await get(`/${randomUUID()}/document`)).status).toBe(404);
      for (const suffix of [
        "document?customerId=" + customerId,
        "download",
        "download?expectedVersion=-1&expectedStatus=DRAFT",
        "download?expectedVersion=0&expectedStatus=OTHER",
      ])
        expect((await get(`/${invoices[0]}/${suffix}`)).status).toBe(422);
      expect(
        (
          await request(app)
            .get(`/api/v1/customers/invoices/${invoices[0]}/document`)
            .set(customer.headers)
        ).status,
      ).toBe(404);
    });
    it("exports an actual draft PDF bound to invoice/version/status without financial mutation", async () => {
      const r = await pdf(
        `/${invoices[0]}/download?expectedVersion=0&expectedStatus=DRAFT`,
      );
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toMatch(/^application\/pdf/);
      expect(r.headers["cache-control"]).toBe("private, no-store");
      expect(r.headers["x-document-id"]).toBe(invoices[0]);
      expect(r.headers["x-document-type"]).toBe("invoice");
      expect(r.headers["x-document-version"]).toBe("0");
      expect(r.headers["x-document-status"]).toBe("DRAFT");
      expect(r.headers["content-disposition"]).toContain("invoice-DRAFT-");
      expect(r.body.subarray(0, 5).toString()).toBe("%PDF-");
      if (process.env.WORK_INVOICE_DETAIL_PDF)
        writeFileSync(process.env.WORK_INVOICE_DETAIL_PDF, r.body);
      expect(
        (await prisma.invoice.findUniqueOrThrow({ where: { id: invoices[0] } })).status,
      ).toBe("DRAFT");
      expect(await prisma.payment.count({ where: { invoiceId: invoices[0] } })).toBe(0);
    });
    it("preserves issue/void versions and customer projections, and rejects stale PDF lifecycle expectations", async () => {
      const id = invoices[1];
      const issued = await post(`/${id}/issue`, { expectedVersion: 0 });
      expect(issued.status).toBe(200);
      expect(issued.body.data).toMatchObject({
        id,
        version: 1,
        status: "ISSUED",
        totalKobo: "19887500",
      });
      expect(issued.body.data.issuedAt).toBeTruthy();
      expect(
        (await get(`/${id}/download?expectedVersion=0&expectedStatus=DRAFT`)).status,
      ).toBe(409);
      const own = await request(app)
        .get(`/api/v1/customers/invoices/${id}/document`)
        .set(customer.headers);
      expect(own.status).toBe(200);
      expect(own.body.data).toMatchObject({
        id,
        version: 1,
        status: "ISSUED",
        totalKobo: "19887500",
      });
      expect(own.body.data).not.toHaveProperty("createdAt");
      expect(own.body.data).not.toHaveProperty("voidedAt");
      const download = await pdf(
        `/${id}/download?expectedVersion=1&expectedStatus=ISSUED`,
      );
      expect(download.status).toBe(200);
      expect(download.headers["x-document-status"]).toBe("ISSUED");
      const voided = await post(`/${id}/void`, { expectedVersion: 1 });
      expect(voided.status).toBe(200);
      expect(voided.body.data).toMatchObject({ status: "VOID", version: 2 });
      expect(voided.body.data.voidedAt).toBeTruthy();
      const document = await get(`/${id}/document`);
      expect(document.body.data).toMatchObject({
        status: "VOID",
        version: 2,
        voidedAt: voided.body.data.voidedAt,
      });
      expect(
        await prisma.auditLog.count({
          where: { entityId: id, entityType: "INVOICE", action: "STATUS_CHANGE" },
        }),
      ).toBe(2);
    });
    it("serializes competing issue/void requests and preserves one transition audit", async () => {
      const id = invoices[2],
        responses = await Promise.all([
          post(`/${id}/issue`, { expectedVersion: 0 }),
          post(`/${id}/void`, { expectedVersion: 0 }),
        ]);
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
      expect(invoice.version).toBe(1);
      expect(["ISSUED", "VOID"]).toContain(invoice.status);
      expect(
        await prisma.auditLog.count({
          where: { entityId: id, entityType: "INVOICE", action: "STATUS_CHANGE" },
        }),
      ).toBe(1);
    });
  },
);
