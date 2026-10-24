import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "managed finance workspace",
  () => {
    const evidence = process.env.WORKFORCE_FINANCE_EVIDENCE!,
      fixturePath = process.env.WORKFORCE_FINANCE_FIXTURES!;
    const owned = Array.from({ length: 36 }, () => randomUUID()),
      invoices = Array.from({ length: 3 }, () => randomUUID()),
      sessions: string[] = [],
      identities: Record<number, Record<string, string>> = {};
    let quoteId = randomUUID(),
      attemptId = randomUUID(),
      quoteBeforeHash = "";
    let users: { userId: string }[],
      guarded = false,
      beforeHash = "",
      ownedHash = "",
      auditBefore = 0,
      reads = 0,
      counts: number[] = [];
    const digest = (v: unknown) =>
      createHash("sha256")
        .update(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)))
        .digest("hex");
    const rows = () =>
      Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.customerProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.workforceAccess.findMany({ orderBy: { userId: "asc" } }),
        prisma.workforceAssignment.findMany({ orderBy: { id: "asc" } }),
        prisma.order.findMany({ orderBy: { id: "asc" } }),
        prisma.orderItem.findMany({ orderBy: { id: "asc" } }),
        prisma.booking.findMany({ orderBy: { id: "asc" } }),
        prisma.workOrder.findMany({ orderBy: { id: "asc" } }),
        prisma.payment.findMany({
          where: { id: { notIn: owned } },
          orderBy: { id: "asc" },
        }),
        prisma.paymentAttempt.findMany({
          where: { id: { not: attemptId } },
          orderBy: { id: "asc" },
        }),
        prisma.invoice.findMany({
          where: { id: { notIn: invoices } },
          orderBy: { id: "asc" },
        }),
        prisma.refund.findMany({ orderBy: { id: "asc" } }),
        prisma.paymentLedgerEntry.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({ orderBy: { id: "asc" } }),
        prisma.enquiry.findMany({ orderBy: { id: "asc" } }),
        prisma.complaint.findMany({ orderBy: { id: "asc" } }),
        prisma.supportMessage.findMany({ orderBy: { id: "asc" } }),
      ]);
    const ownRows = () =>
      Promise.all([
        prisma.payment.findMany({ where: { id: { in: owned } }, orderBy: { id: "asc" } }),
        prisma.invoice.findMany({
          where: { id: { in: invoices } },
          orderBy: { id: "asc" },
        }),
        prisma.paymentAttempt.findMany({
          where: { id: attemptId },
          orderBy: { id: "asc" },
        }),
        prisma.serviceQuote.findMany({ where: { id: quoteId }, orderBy: { id: "asc" } }),
      ]);
    async function get(
      index = 4,
      suffix = "",
      query: Record<string, string | number> = {},
    ) {
      const r = await request(app)
        .get("/api/v1/staff/workforce/finance" + suffix)
        .query(query)
        .set(identities[index]!);
      if (r.status === 200) {
        reads++;
        expect(r.headers["cache-control"]).toBe("private, no-store");
      }
      return r;
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
      const resume = process.env.WORKFORCE_FINANCE_RESUME === "setup",
        resumeRemaining = process.env.WORKFORCE_FINANCE_RESUME === "remaining";
      if (
        existsSync(evidence) ||
        (existsSync(fixturePath) && !resume && !resumeRemaining)
      )
        throw Error("Finance evidence or fixtures already exist; inspect before writes");
      if (resume) {
        const previous = JSON.parse(
          readFileSync(process.env.WORKFORCE_FINANCE_PRIOR_EVIDENCE!, "utf8"),
        );
        const checkpoint = JSON.parse(readFileSync(fixturePath, "utf8"));
        expect(previous.originalRowsUnchanged).toBe(true);
        expect(previous.successfulReads).toBe(0);
        expect(previous.successfulBusinessWrites).toBe(0);
        expect(previous.auditDelta).toBe(0);
        expect(previous.temporarySessionsRemaining).toBe(0);
        expect(checkpoint.setupComplete).toBe(false);
        owned.splice(0, owned.length, ...checkpoint.owned);
        invoices.splice(0, invoices.length, ...checkpoint.invoices);
        attemptId = checkpoint.attemptId;
        expect(await prisma.payment.count({ where: { id: { in: owned } } })).toBe(0);
        expect(await prisma.invoice.count({ where: { id: { in: invoices } } })).toBe(0);
        expect(await prisma.paymentAttempt.count({ where: { id: attemptId } })).toBe(0);
        expect(digest(await rows())).toBe(checkpoint.beforeHash);
      }
      if (resumeRemaining) {
        const previous = JSON.parse(
            readFileSync(process.env.WORKFORCE_FINANCE_PRIOR_EVIDENCE!, "utf8"),
          ),
          checkpoint = JSON.parse(readFileSync(fixturePath, "utf8"));
        expect(previous.originalRowsUnchanged).toBe(true);
        expect(previous.ownedRowsUnchanged).toBe(true);
        expect(previous.successfulReads).toBe(0);
        expect(previous.successfulBusinessWrites).toBe(0);
        expect(previous.auditDelta).toBe(0);
        expect(previous.temporarySessionsRemaining).toBe(0);
        expect(checkpoint.setupComplete).toBe(true);
        owned.splice(0, owned.length, ...checkpoint.owned);
        invoices.splice(0, invoices.length, ...checkpoint.invoices);
        attemptId = checkpoint.attemptId;
        quoteId = checkpoint.quoteId;
        expect(await prisma.payment.count({ where: { id: { in: owned } } })).toBe(36);
        expect(await prisma.invoice.count({ where: { id: { in: invoices } } })).toBe(3);
        expect(await prisma.serviceQuote.count({ where: { id: quoteId } })).toBe(1);
        expect(digest(await rows())).toBe(checkpoint.beforeHash);
        expect(digest(await ownRows())).toBe(checkpoint.ownedHash);
      }
      users = JSON.parse(
        readFileSync(process.env.WORKFORCE_NOTIFICATIONS_FIXTURES!, "utf8"),
      ).users;
      const orders = JSON.parse(readFileSync(process.env.WORKFORCE_ORDERS_SEED!, "utf8")),
        jobs = JSON.parse(readFileSync(process.env.WORKFORCE_JOBS_FIXTURES!, "utf8"));
      const book = await prisma.booking.findUniqueOrThrow({
        where: { id: jobs.ownIds[1] },
        select: { customerId: true, bookingSlotId: true },
      });
      expect(book.bookingSlotId).toBeNull();
      const quoteStaff = await prisma.staffProfile.findUniqueOrThrow({
        where: { userId: users[4]!.userId },
        select: { id: true },
      });
      if (!resumeRemaining)
        expect(
          await prisma.serviceQuote.count({ where: { bookingId: jobs.ownIds[1] } }),
        ).toBe(0);
      quoteBeforeHash = digest(
        await prisma.serviceQuote.findMany({
          where: { id: { not: quoteId } },
          orderBy: { id: "asc" },
        }),
      );
      const before = await rows();
      beforeHash = digest(before);
      counts = before.map((t) => t.length);
      auditBefore = await prisma.auditLog.count();
      guarded = true;
      if (!resumeRemaining) {
        writeFileSync(
          fixturePath,
          JSON.stringify({
            owned,
            invoices,
            attemptId,
            quoteId,
            beforeHash,
            counts,
            setupComplete: false,
          }),
        );
        await prisma.$transaction(async (tx) => {
          await tx.serviceQuote.create({
            data: {
              id: quoteId,
              bookingId: jobs.ownIds[1],
              createdByStaffId: quoteStaff.id,
              quoteNumber: "Q110-QUOTE-" + quoteId.slice(0, 8),
              status: "ACCEPTED",
              acceptedAt: new Date(),
              subtotalKobo: 10000n,
              totalKobo: 10000n,
            },
          });
          for (let n = 0; n < 3; n++) {
            const source =
              n === 1
                ? null
                : await tx.order.findUniqueOrThrow({
                    where: { id: n === 0 ? orders.owned[30] : orders.owned[33] },
                    select: {
                      customerId: true,
                      currency: true,
                      totalKobo: true,
                      taxKobo: true,
                    },
                  });
            await tx.invoice.create({
              data: {
                id: invoices[n]!,
                invoiceNumber: `Q110-INV-${n}`,
                customerId: source?.customerId ?? book.customerId,
                currency: source?.currency ?? "NGN",
                subtotalKobo: source ? source.totalKobo - source.taxKobo : 10000n,
                taxKobo: source?.taxKobo ?? 0n,
                totalKobo: source?.totalKobo ?? 10000n,
                ...(n === 1
                  ? { bookingId: jobs.ownIds[1] }
                  : { orderId: n === 0 ? orders.owned[30] : orders.owned[33] }),
              },
            });
          }
          for (let n = 0; n < 36; n++) {
            const status =
              n === 3
                ? "CANCELLED"
                : n === 4
                  ? "EXPIRED"
                  : n === 5
                    ? "REQUIRES_REVIEW"
                    : n === 1
                      ? "PROCESSING"
                      : "REQUIRES_PAYMENT";
            const target =
              n === 29
                ? { bookingId: jobs.ownIds[0], purpose: "BOOKING_DEPOSIT" as const }
                : n === 30
                  ? { invoiceId: invoices[0]!, purpose: "SERVICE_INVOICE" as const }
                  : n === 31
                    ? { invoiceId: invoices[1]!, purpose: "SERVICE_INVOICE" as const }
                    : n === 34
                      ? { invoiceId: invoices[2]!, purpose: "SERVICE_INVOICE" as const }
                      : n === 35
                        ? {
                            bookingId: jobs.foreignId,
                            purpose: "BOOKING_DEPOSIT" as const,
                          }
                        : {
                            orderId: orders.owned[n === 33 ? 33 : Math.min(n, 32)],
                            purpose: "ORDER_PAYMENT" as const,
                          };
            await tx.payment.create({
              data: {
                id: owned[n]!,
                ...target,
                paymentNumber:
                  n === 2 ? "Q110-PAY-%_\\-02" : `Q110-PAY-${String(n).padStart(2, "0")}`,
                amountKobo: n === 1 ? 900719925474099101n : 2750050n,
                currency: "NGN",
                status,
                idempotencyKeyHash: createHash("sha256").update(owned[n]!).digest("hex"),
                createdAt: new Date("2026-10-20T08:00:00Z"),
                expiresAt: new Date("2026-10-20T08:30:00Z"),
                ...(status === "CANCELLED"
                  ? { cancelledAt: new Date("2026-10-20T08:20:00Z") }
                  : {}),
                ...(status === "EXPIRED"
                  ? { expiredAt: new Date("2026-10-20T08:30:00Z") }
                  : {}),
                description: "Private synthetic payment description",
                policySnapshot: { private: "synthetic-policy" },
              },
            });
          }
          await tx.paymentAttempt.create({
            data: {
              id: attemptId,
              paymentId: owned[0]!,
              attemptNumber: 1,
              internalReference: "Q110-ATTEMPT-" + attemptId,
              provider: "PAYSTACK",
              method: "CARD",
              status: "SUCCESSFUL",
              verificationStatus: "VERIFIED",
              amountKobo: 2750050n,
              currency: "NGN",
              verifiedAmountKobo: 2750050n,
              verifiedCurrency: "NGN",
              verifiedAt: new Date(),
              paidAt: new Date(),
              providerReference: "Q110-PROVIDER-" + attemptId,
              gatewayTransactionId: "Q110-GATEWAY-" + attemptId,
            },
          });
          await tx.payment.update({
            where: { id: owned[0]! },
            data: {
              status: "SUCCEEDED",
              settledAttemptId: attemptId,
              succeededAt: new Date("2026-10-20T08:15:00Z"),
            },
          });
        });
        ownedHash = digest(await ownRows());
        writeFileSync(
          fixturePath,
          JSON.stringify({
            owned,
            invoices,
            attemptId,
            quoteId,
            beforeHash,
            ownedHash,
            counts,
            setupComplete: true,
          }),
        );
      } else ownedHash = digest(await ownRows());
      for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 12]) {
        const token = randomUUID(),
          expiresAt = new Date(Date.now() + 3600000);
        const session = await prisma.session.create({
          data: {
            userId: users[index === 12 ? 4 : index]!.userId,
            tokenHash: hashToken("session", token),
            expiresAt,
            idleExpiresAt: expiresAt,
            mfaRequired: true,
            mfaVerifiedAt: index === 12 ? null : new Date(),
            createdAt: new Date(Date.now() - 1000),
          },
        });
        sessions.push(session.id);
        identities[index] = { Cookie: `${sessionCookieName}=${token}` };
      }
    });
    it("returns minimal scoped payment sources, exact money and current dates", async () => {
      const list = await get(4, "", { limit: 50 });
      expect(list.status).toBe(200);
      expect(workforceResponseSchema("finance").safeParse(list.body.data).success).toBe(
        true,
      );
      expect(list.body.data.items).toHaveLength(33);
      for (const row of list.body.data.items) {
        expect(Object.keys(row).sort()).toEqual(
          [
            "id",
            "paymentNumber",
            "amountKobo",
            "currency",
            "status",
            "purpose",
            "createdAt",
            "succeededAt",
            "sources",
          ].sort(),
        );
        expect(row.sources.length).toBeGreaterThan(0);
        for (const s of row.sources)
          expect(Object.keys(s).sort()).toEqual(["branch", "kind", "reference"]);
      }
      for (const n of [0, 1, 3, 4, 29, 30, 31]) {
        const r = await get(4, "/" + owned[n]);
        expect(r.status).toBe(200);
        expect(
          workforceResponseSchema("financePayment").safeParse(r.body.data).success,
        ).toBe(true);
        const actual = await prisma.payment.findUniqueOrThrow({
          where: { id: owned[n]! },
        });
        expect(r.body.data.amountKobo).toBe(actual.amountKobo.toString());
        expect(r.body.data.succeededAt).toBe(actual.succeededAt?.toISOString() ?? null);
        expect(r.body.data.cancelledAt).toBe(actual.cancelledAt?.toISOString() ?? null);
        expect(r.body.data.expiredAt).toBe(actual.expiredAt?.toISOString() ?? null);
        expect(r.body.data).not.toHaveProperty("description");
        expect(r.body.data).not.toHaveProperty("settledAttemptId");
        expect(r.body.data).not.toHaveProperty("policySnapshot");
        expect(r.body.data.access.userId).toBe(users[4]!.userId);
      }
    });
    it("combines literal reference search, status and purpose across the full scope", async () => {
      for (const q of ["%", "_", "\\", "q110-pay-%_\\-02"]) {
        const r = await get(4, "", {
          q,
          status: "REQUIRES_PAYMENT",
          purpose: "ORDER_PAYMENT",
        });
        expect(r.status).toBe(200);
        expect(r.body.data.items.map((x: { id: string }) => x.id)).toEqual([owned[2]]);
      }
      const invoice = await get(4, "", { q: "q110-inv-0", purpose: "SERVICE_INVOICE" });
      expect(invoice.status).toBe(200);
      expect(invoice.body.data.items.map((x: { id: string }) => x.id)).toEqual([
        owned[30],
      ]);
      const foreign = await get(4, "", { q: "Q110-INV-2" });
      expect(foreign.status).toBe(200);
      expect(foreign.body.data.items).toEqual([]);
      const booking = await get(4, "", { purpose: "BOOKING_DEPOSIT" });
      expect(booking.status).toBe(200);
      expect(booking.body.data.items.map((x: { id: string }) => x.id)).toEqual([
        owned[29],
      ]);
    });
    it("pages every permitted payment once with stable cursor boundaries", async () => {
      const ids: string[] = [];
      let cursor: string | undefined;
      do {
        const r = await get(4, "", { limit: 7, ...(cursor ? { cursor } : {}) });
        expect(r.status).toBe(200);
        ids.push(...r.body.data.items.map((x: { id: string }) => x.id));
        cursor = r.body.data.nextCursor;
        expect(ids.length).toBeLessThanOrEqual(33);
      } while (cursor);
      expect(ids).toEqual(owned.slice(0, 33).sort());
    });
    it("denies other responsibilities, missing MFA and foreign or missing records", async () => {
      for (const index of [0, 1, 2, 3, 5, 6, 7, 9, 10]) {
        const expected = index === 9 ? 401 : 403;
        expect((await get(index)).status).toBe(expected);
        expect((await get(index, "/" + owned[0])).status).toBe(expected);
      }
      expect((await get(12)).status).toBe(403);
      for (const id of [...owned.slice(33), randomUUID()])
        expect((await get(4, "/" + id)).status).toBe(404);
      expect((await request(app).get("/api/v1/staff/workforce/finance")).status).toBe(
        401,
      );
    });
    it("rejects unsupported filters, duplicate keys and invalid bounds", async () => {
      for (const query of [
        { branchId: randomUUID() },
        { status: "PENDING" },
        { purpose: "OTHER" },
        { q: "a\u0000b" },
        { q: "x".repeat(121) },
        { cursor: "bad" },
        { limit: 0 },
        { limit: 51 },
      ])
        expect((await get(4, "", query)).status).toBe(422);
      expect(
        (
          await request(app)
            .get("/api/v1/staff/workforce/finance?q=a&q=b")
            .set(identities[7]!)
        ).status,
      ).toBe(422);
      expect((await get(4, "/" + owned[0], { limit: 5 })).status).toBe(422);
    });
    afterAll(async () => {
      try {
        if (guarded) {
          await prisma.session.deleteMany({ where: { id: { in: sessions } } });
          expect(
            digest(
              await prisma.serviceQuote.findMany({
                where: { id: { not: quoteId } },
                orderBy: { id: "asc" },
              }),
            ),
          ).toBe(quoteBeforeHash);
          const originalRowsUnchanged = digest(await rows()) === beforeHash,
            ownedRowsUnchanged = ownedHash ? digest(await ownRows()) === ownedHash : true,
            auditDelta = (await prisma.auditLog.count()) - auditBefore,
            temporarySessionsRemaining = await prisma.session.count({
              where: { id: { in: sessions } },
            });
          writeFileSync(
            evidence,
            JSON.stringify({
              originalRowsUnchanged,
              ownedRowsUnchanged,
              originalCounts: counts,
              successfulReads: reads,
              successfulBusinessWrites: 0,
              auditDelta,
              temporarySessionsRemaining,
            }),
          );
          expect(originalRowsUnchanged).toBe(true);
          expect(ownedRowsUnchanged).toBe(true);
          expect(auditDelta).toBe(reads);
          expect(temporarySessionsRemaining).toBe(0);
        }
      } finally {
        await prisma.$disconnect();
      }
    });
  },
);
