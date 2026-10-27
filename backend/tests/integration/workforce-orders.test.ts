import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { issueCsrfToken } from "../../src/common/security/csrf-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "managed order workspace",
  () => {
    const evidence = process.env.WORKFORCE_ORDERS_EVIDENCE!;
    const fixturePath = process.env.WORKFORCE_ORDERS_FIXTURES!;
    const sessions: string[] = [],
      owned: string[] = [];
    const identities: Record<number, Record<string, string>> = {};
    let guarded = false,
      beforeHash = "",
      auditBefore = 0,
      reads = 0,
      writes = 0;
    let counts: number[] = [],
      users: { userId: string }[],
      branchId: string,
      foreignBranch: string;
    let categoryId = randomUUID(),
      productId = randomUUID();
    let stableOwnedHash = "";
    const rows = () =>
      Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.customerProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
        prisma.booking.findMany({ orderBy: { id: "asc" } }),
        prisma.workOrder.findMany({ orderBy: { id: "asc" } }),
        prisma.order.findMany({
          where: { id: { notIn: owned } },
          orderBy: { id: "asc" },
        }),
        prisma.orderItem.findMany({
          where: { orderId: { notIn: owned } },
          orderBy: { id: "asc" },
        }),
        prisma.product.findMany({
          where: { id: { not: productId } },
          orderBy: { id: "asc" },
        }),
        prisma.category.findMany({
          where: { id: { not: categoryId } },
          orderBy: { id: "asc" },
        }),
        prisma.payment.findMany({ orderBy: { id: "asc" } }),
        prisma.refund.findMany({ orderBy: { id: "asc" } }),
        prisma.invoice.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({ orderBy: { id: "asc" } }),
        prisma.enquiry.findMany({ orderBy: { id: "asc" } }),
        prisma.complaint.findMany({ orderBy: { id: "asc" } }),
        prisma.supportMessage.findMany({ orderBy: { id: "asc" } }),
      ]);
    const stableOwned = async () =>
      (
        await prisma.order.findMany({
          where: { id: { in: owned } },
          orderBy: { id: "asc" },
          include: { items: { orderBy: { id: "asc" } } },
        })
      ).map(
        ({
          status: _status,
          version: _version,
          updatedAt: _updatedAt,
          processingAt: _processingAt,
          readyAt: _readyAt,
          ...rest
        }) => rest,
      );
    const digest = (value: unknown) =>
      createHash("sha256")
        .update(
          JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        )
        .digest("hex");
    async function get(
      index: number,
      suffix = "",
      query: Record<string, string | number> = {},
    ) {
      const result = await request(app)
        .get("/api/v1/staff/workforce/orders" + suffix)
        .query(query)
        .set(identities[index]!);
      if (result.status === 200) {
        reads++;
        expect(result.headers["cache-control"]).toContain("no-store");
      }
      return result;
    }
    async function change(
      index: number,
      id: string,
      action: "prepare",
      body: Record<string, unknown>,
      csrf = true,
    ) {
      const headers = { ...identities[index] };
      if (!csrf) delete headers["x-csrf-token"];
      const result = await request(app)
        .patch(`/api/v1/staff/workforce/orders/${id}`)
        .set(headers)
        .send(body);
      if (result.status === 200) {
        writes++;
        expect(workforceResponseSchema(action).safeParse(result.body.data).success).toBe(
          true,
        );
      }
      return result;
    }
    beforeAll(async () => {
      expect(env.NODE_ENV).toBe("test");
      expect(
        await prisma.$queryRaw`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`,
      ).toEqual([
        {
          database: "allied_work_staff_workforce_20261019_test",
          host: "127.0.0.1",
          port: 55480,
        },
      ]);
      expect(
        await prisma.$queryRaw`SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS elevated, EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_database, EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) OR has_table_privilege(current_user,c.oid,'TRUNCATE'))) AS unsafe_tables FROM pg_roles WHERE rolname=current_user`,
      ).toEqual([{ elevated: false, owns_database: false, unsafe_tables: false }]);

      const resumeSetup = process.env.WORKFORCE_ORDERS_RESUME_SETUP === "true";
      const resumeRemaining = process.env.WORKFORCE_ORDERS_RESUME_SETUP === "remaining";
      if (
        existsSync(evidence) ||
        (existsSync(fixturePath) && !resumeSetup && !resumeRemaining)
      )
        throw Error("Order evidence/fixtures exist; inspect before repeating writes");
      if (resumeSetup) {
        const previous = JSON.parse(
          readFileSync(process.env.WORKFORCE_ORDERS_PRIOR_EVIDENCE!, "utf8"),
        );
        const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
        expect(previous.successfulWrites).toBe(0);
        expect(previous.successfulReads).toBe(0);
        expect(previous.auditDelta).toBe(0);
        expect(previous.originalRowsUnchanged).toBe(true);
        expect(previous.temporarySessionsRemaining).toBe(0);
        expect(fixture.setupComplete).toBe(false);
        owned.push(...fixture.owned);
        categoryId = fixture.categoryId;
        productId = fixture.productId;
        expect(await prisma.order.count({ where: { id: { in: owned } } })).toBe(0);
        expect(await prisma.product.count({ where: { id: productId } })).toBe(0);
        expect(await prisma.category.count({ where: { id: categoryId } })).toBe(0);
        expect(digest(await rows())).toBe(fixture.beforeHash);
      }
      if (resumeRemaining) {
        const previous = JSON.parse(
          readFileSync(process.env.WORKFORCE_ORDERS_PRIOR_EVIDENCE!, "utf8"),
        );
        const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
        expect(previous.successfulWrites).toBe(3);
        expect(previous.originalRowsUnchanged).toBe(true);
        expect(previous.ownedFinancialAndItemFieldsUnchanged).toBe(true);
        expect(previous.temporarySessionsRemaining).toBe(0);
        expect(fixture.setupComplete).toBe(true);
        owned.push(...fixture.owned);
        categoryId = fixture.categoryId;
        productId = fixture.productId;
        expect(await prisma.order.count({ where: { id: { in: owned } } })).toBe(34);
        expect(
          (await prisma.order.findUniqueOrThrow({ where: { id: owned[0]! } })).version,
        ).toBe(2);
        expect(
          (await prisma.order.findUniqueOrThrow({ where: { id: owned[10]! } })).version,
        ).toBe(1);
        expect(
          await prisma.order.count({ where: { id: { in: owned }, version: 0 } }),
        ).toBe(32);
        expect(digest(await rows())).toBe(fixture.beforeHash);
        expect(digest(await stableOwned())).toBe(fixture.stableOwnedHash);
      }
      users = JSON.parse(
        readFileSync(process.env.WORKFORCE_NOTIFICATIONS_FIXTURES!, "utf8"),
      ).users;
      const prior = JSON.parse(
        readFileSync(process.env.WORKFORCE_JOBS_FIXTURES!, "utf8"),
      );
      branchId = prior.branchId;
      const foreign = await prisma.booking.findUniqueOrThrow({
        where: { id: prior.foreignId },
        select: { branchId: true, customerId: true },
      });
      foreignBranch = foreign.branchId!;
      if (!resumeSetup && !resumeRemaining)
        for (let i = 0; i < 34; i++) owned.push(randomUUID());
      const before = await rows();
      beforeHash = digest(before);
      counts = before.map((r) => r.length);
      auditBefore = await prisma.auditLog.count();
      guarded = true;
      if (!resumeRemaining) {
        writeFileSync(
          fixturePath,
          JSON.stringify({
            owned,
            branchId,
            foreignBranch,
            categoryId,
            productId,
            beforeHash,
            counts,
            setupComplete: false,
          }),
        );
        await prisma.$transaction(async (tx) => {
          await tx.category.create({
            data: {
              id: categoryId,
              name: "Synthetic milestone109 category",
              slug: "milestone109-" + categoryId,
            },
          });
          await tx.product.create({
            data: {
              id: productId,
              categoryId,
              name: "Synthetic milestone109 product",
              slug: "milestone109-" + productId,
              sku: "M109-" + productId,
              priceKobo: 10000n,
            },
          });
          for (let i = 0; i < owned.length; i++)
            await tx.order.create({
              data: {
                id: owned[i]!,
                customerId: foreign.customerId,
                branchId: i === 33 ? foreignBranch : branchId,
                orderNumber:
                  "M109-" + String(i).padStart(2, "0") + "-" + owned[i]!.slice(0, 8),
                status:
                  i === 1
                    ? "PROCESSING"
                    : i === 6
                      ? "COMPLETED"
                      : i === 7
                        ? "CANCELLED"
                        : i === 8
                          ? "READY"
                          : i === 9
                            ? "PENDING"
                            : "CONFIRMED",
                fulfillmentMethod: i === 3 ? "DELIVERY" : "COLLECTION",
                ...(i === 3
                  ? {
                      deliveryName: "Synthetic recipient",
                      deliveryPhone: "+2348000000109",
                      deliveryAddress: "Synthetic test address",
                      deliveryCity: "Port Harcourt",
                      deliveryState: "Rivers",
                      deliveryCountry: "Nigeria",
                    }
                  : {}),
                paidAt: i === 2 ? null : new Date(),
                confirmedAt: new Date(),
                processingAt: i === 1 ? new Date() : null,
                readyAt: i === 8 ? new Date() : null,
                completedAt: i === 6 ? new Date() : null,
                cancelledAt: i === 7 ? new Date() : null,
                cancellationReason: i === 7 ? "Synthetic cancelled order fixture" : null,
                subtotalKobo: 20000n,
                totalKobo: 20000n,
                customerName: "Synthetic Order Customer",
                customerEmail: "orders109@example.test",
                customerPhone: "+2348000000109",
                items: {
                  create: [
                    {
                      productId,
                      productName:
                        "Synthetic milestone109 brake pads" +
                        (i === 0 ? " literal %_" : ""),
                      sku: "PRIVATE-SKU-109",
                      unitPriceKobo: 10000n,
                      quantity: 2,
                      subtotalKobo: 20000n,
                    },
                  ],
                },
              },
            });
        });
        stableOwnedHash = digest(await stableOwned());
        writeFileSync(
          fixturePath,
          JSON.stringify({
            owned,
            branchId,
            foreignBranch,
            categoryId,
            productId,
            beforeHash,
            counts,
            stableOwnedHash,
            setupComplete: true,
          }),
        );
      } else stableOwnedHash = digest(await stableOwned());
      for (const index of [0, 1, 2, 3, 7, 9, 10]) {
        const token = randomUUID(),
          csrf = issueCsrfToken(),
          expiresAt = new Date(Date.now() + 3600000);
        const session = await prisma.session.create({
          data: {
            userId: users[index]!.userId,
            tokenHash: hashToken("session", token),
            csrfTokenHash: csrf.hash,
            expiresAt,
            idleExpiresAt: expiresAt,
            mfaRequired: true,
            mfaVerifiedAt: new Date(),
            createdAt: new Date(Date.now() - 1000),
          },
        });
        sessions.push(session.id);
        identities[index] = {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: "http://localhost:3000",
          "x-csrf-token": csrf.raw,
        };
      }
    });
    it("restricts order discovery and detail to permitted branch readers without financial/contact fields", async () => {
      for (const index of [0, 1, 2]) {
        const result = await get(index, "", { q: "milestone109", limit: 50 });
        expect(result.status).toBe(200);
        expect(
          workforceResponseSchema("orders").safeParse(result.body.data).success,
        ).toBe(true);
        expect(result.body.data.items).toHaveLength(33);
        for (const row of result.body.data.items) {
          expect(row.branchId).toBe(branchId);
          for (const key of [
            "customerId",
            "customerName",
            "customerEmail",
            "customerPhone",
            "totalKobo",
            "subtotalKobo",
            "policySnapshot",
          ])
            expect(row).not.toHaveProperty(key);
          for (const item of row.items) {
            expect(item).not.toHaveProperty("unitPriceKobo");
            expect(item).not.toHaveProperty("sku");
          }
        }
        const detail = await get(index, "/" + owned[4]);
        expect(detail.status).toBe(200);
        expect(workforceResponseSchema("order").safeParse(detail.body.data).success).toBe(
          true,
        );
        expect(detail.body.data.availableNextStates).toEqual(
          index === 0 ? ["PROCESSING"] : [],
        );
        expect((await get(index, "/" + owned[33])).status).toBe(404);
      }
      for (const index of [3, 7, 10]) {
        expect((await get(index)).status).toBe(403);
        expect((await get(index, "/" + owned[0])).status).toBe(403);
      }
      expect((await get(9)).status).toBe(401);
    });
    it("combines literal full-scope search, status, method and cursor paging", async () => {
      const first = await get(0, "", { q: "milestone109", limit: 25 });
      expect(first.status).toBe(200);
      expect(first.body.data.items).toHaveLength(25);
      const second = await get(0, "", {
        q: "milestone109",
        cursor: first.body.data.nextCursor,
        limit: 25,
      });
      expect(second.status).toBe(200);
      expect(second.body.data.items).toHaveLength(8);
      expect(
        new Set([...first.body.data.items, ...second.body.data.items].map((r) => r.id))
          .size,
      ).toBe(33);
      const literal = await get(0, "", { q: "%_" });
      expect(literal.status).toBe(200);
      expect(literal.body.data.items.map((r) => r.id)).toEqual([owned[0]]);
      const filtered = await get(0, "", {
        q: "milestone109",
        status: "PROCESSING",
        fulfillmentMethod: "COLLECTION",
      });
      expect(filtered.body.data.items.map((r) => r.id).sort()).toEqual(
        (process.env.WORKFORCE_ORDERS_RESUME_SETUP === "remaining"
          ? [owned[1], owned[10]]
          : [owned[1]]
        ).sort(),
      );
      const hidden = await get(0, "", { q: "orders109@example.test" });
      expect(hidden.body.data.items).toEqual([]);
    });
    it("records exact sequential preparation receipts and timestamps", async () => {
      for (const [version, status] of [
        [0, "PROCESSING"],
        [1, "READY"],
      ] as const) {
        const reason = "Synthetic verified preparation " + status;
        const result = await change(0, owned[0]!, "prepare", {
          expectedVersion: version,
          status,
          reason,
        });
        expect(result.status).toBe(200);
        expect(result.body.data).toMatchObject({
          id: owned[0],
          version: version + 1,
          status,
          actorUserId: users[0]!.userId,
          previousVersion: version,
          previousStatus: version === 0 ? "CONFIRMED" : "PROCESSING",
          reason,
        });
        expect(
          result.body.data[status === "PROCESSING" ? "processingAt" : "readyAt"],
        ).toBeTruthy();
      }
      expect(
        (
          await change(0, owned[0]!, "prepare", {
            expectedVersion: 1,
            status: "READY",
            reason: "Stale preparation retry",
          })
        ).status,
      ).toBe(409);
    });
    it("concurrent preparation requests have exactly one winner", async () => {
      const body = {
        expectedVersion: 0,
        status: "PROCESSING",
        reason: "Concurrent preparation verification",
      };
      const result = await Promise.all([
        change(0, owned[10]!, "prepare", body),
        change(0, owned[10]!, "prepare", body),
      ]);
      expect(result.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: owned[10]! } })).version,
      ).toBe(1);
    });
    it("rejects foreign/read-only/unpaid/delivery/terminal/skip-state updates", async () => {
      const body = {
        expectedVersion: 0,
        status: "PROCESSING",
        reason: "Rejected preparation verification",
      };
      for (const index of [1, 2, 3, 7, 10])
        expect((await change(index, owned[4]!, "prepare", body)).status).toBe(403);
      expect((await change(9, owned[4]!, "prepare", body)).status).toBe(401);
      expect((await change(0, owned[33]!, "prepare", body)).status).toBe(404);
      for (const n of [2, 3, 6, 7, 8, 9])
        expect((await change(0, owned[n]!, "prepare", body)).status).toBe(409);
      expect(
        (await change(0, owned[4]!, "prepare", { ...body, status: "READY" })).status,
      ).toBe(409);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: owned[4]! } })).version,
      ).toBe(0);
    });
    it("enforces CSRF and strict validation without changing the record", async () => {
      const body = {
        expectedVersion: 0,
        status: "PROCESSING",
        reason: "Rejected invalid preparation",
      };
      expect((await change(0, owned[4]!, "prepare", body, false)).status).toBe(403);
      for (const bad of [
        { ...body, status: "COMPLETED" },
        { ...body, reason: "short" },
        { ...body, expectedVersion: -1 },
        { ...body, paidAt: new Date().toISOString() },
      ])
        expect((await change(0, owned[4]!, "prepare", bad)).status).toBe(422);
      for (const query of [
        { q: " " },
        { q: "x".repeat(121) },
        { status: "CLOSED" },
        { fulfillmentMethod: "OTHER" },
        { cursor: "bad" },
        { limit: 51 },
        { customerId: users[0]!.userId },
      ])
        expect((await get(0, "", query)).status).toBe(422);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: owned[4]! } })).version,
      ).toBe(0);
    });
    afterAll(async () => {
      try {
        if (guarded) {
          await prisma.session.deleteMany({ where: { id: { in: sessions } } });
          const originalRowsUnchanged = digest(await rows()) === beforeHash,
            ownedFinancialAndItemFieldsUnchanged =
              !stableOwnedHash || digest(await stableOwned()) === stableOwnedHash,
            auditDelta = (await prisma.auditLog.count()) - auditBefore;
          const temporarySessionsRemaining = await prisma.session.count({
            where: { id: { in: sessions } },
          });
          writeFileSync(
            evidence,
            JSON.stringify({
              originalRowsUnchanged,
              ownedFinancialAndItemFieldsUnchanged,
              originalCounts: counts,
              successfulReads: reads,
              successfulWrites: writes,
              auditDelta,
              temporarySessionsRemaining,
            }),
          );
          expect(originalRowsUnchanged).toBe(true);
          expect(ownedFinancialAndItemFieldsUnchanged).toBe(true);
          expect(auditDelta).toBe(reads + writes);
          expect(temporarySessionsRemaining).toBe(0);
        }
      } finally {
        await prisma.$disconnect();
      }
    });
  },
);
