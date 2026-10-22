import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  financeWorkspaceResponse,
  policyVersionResponse,
} from "../../src/modules/policies/finance-policy-workspace.js";
const app = createApp({ checkReadiness: async () => undefined }),
  root = "/api/v1/staff/finance-policy";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "financial policy current workspace",
  () => {
    type Actor = { id: string; headers: Record<string, string> };
    let admin: Actor,
      staff: Actor,
      owner: Actor,
      noGrant: Actor,
      customer: Actor,
      revoked: Actor,
      unverified: Actor,
      currentId: string | undefined,
      beforeHash: string,
      latest: number,
      grantOwner: string;
    const sessions: string[] = [],
      originalIds: string[] = [];
    const settings = {
      vatBasisPoints: 750,
      pricesIncludeVat: false,
      rounding: "HALF_UP_MINOR_UNIT",
      discountTreatment: "BEFORE_VAT",
      applicability: "ALL_PRODUCTS_AND_SERVICES",
      deliveryTaxable: false,
      invoiceName: "Synthetic finance test company",
      invoiceAddress: "Synthetic isolated test address only",
      paymentTerms: "Synthetic written terms for this isolated test only",
    };
    const digest = (v: unknown) =>
      createHash("sha256")
        .update(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)))
        .digest("hex");
    async function protectedRows() {
      return digest(
        await Promise.all([
          prisma.businessPolicyVersion.findMany({
            where: { id: { in: originalIds } },
            orderBy: { id: "asc" },
          }),
          prisma.payment.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentAttempt.findMany({ orderBy: { id: "asc" } }),
          prisma.refund.findMany({ orderBy: { id: "asc" } }),
          prisma.invoice.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentLedgerEntry.findMany({ orderBy: { id: "asc" } }),
          prisma.paymentDispute.findMany({ orderBy: { id: "asc" } }),
        ]),
      );
    }
    async function auth(id: string, role: string) {
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
          mfaVerifiedAt: role !== "CUSTOMER" ? new Date() : null,
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
    async function actor(role: "STAFF" | "ADMIN", grant = "yes") {
      const u = await prisma.user.create({
        data: {
          email: `finance-${randomUUID()}@example.test`,
          passwordHash: "unusable-isolated-test-only",
          role,
          status: "ACTIVE",
          emailVerifiedAt: grant === "unverified" ? null : new Date(),
          staffProfile: { create: { firstName: "Synthetic", lastName: "Finance" } },
        },
      });
      if (grant !== "none")
        await prisma.userCapability.create({
          data: {
            userId: u.id,
            capability: "FINANCE_POLICY_APPROVE",
            grantedByUserId: grantOwner,
            revokedAt: grant === "revoked" ? new Date() : null,
          },
        });
      return auth(u.id, role);
    }
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(actual).toEqual({
        database: "allied_work_aftercare_20261017_test",
        host: "127.0.0.1",
        port: 55480,
      });
      expect(env.NODE_ENV).toBe("test");
      const base = JSON.parse(readFileSync(process.env.WORK_PAYMENT_FIXTURES!, "utf8"));
      grantOwner = base.owner;
      originalIds.push(
        ...(await prisma.businessPolicyVersion.findMany({ select: { id: true } })).map(
          (v) => v.id,
        ),
      );
      beforeHash = await protectedRows();
      currentId = (
        await prisma.businessPolicyVersion.findFirst({
          where: { key: "finance", effectiveAt: { lte: new Date() } },
          orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
        })
      )?.id;
      latest =
        (
          await prisma.businessPolicyVersion.findFirst({
            where: { key: "finance" },
            orderBy: { version: "desc" },
          })
        )?.version ?? 0;
      admin = await actor("ADMIN");
      staff = await actor("STAFF");
      noGrant = await actor("ADMIN", "none");
      revoked = await actor("STAFF", "revoked");
      unverified = await actor("STAFF", "unverified");
      owner = await auth(base.owner, "SUPER_ADMIN");
      customer = await auth(base.customer, "CUSTOMER");
      // Append isolated future fixtures; existing current configuration is preserved.
      if (process.env.FINANCE_READ_ONLY_TEST !== "true")
        await prisma.businessPolicyVersion.createMany({
          data: Array.from({ length: 101 }, (_, i) => ({
            key: "finance",
            version: latest + i + 1,
            approvalStatus: "APPROVED",
            source: "Synthetic future scheduling fixture; isolated test only",
            sourceQuestion: "Q7-Q8",
            approvedByUserId: admin.id,
            effectiveAt: new Date("2050-01-01T00:00:00Z"),
            settings,
            approvalEvidence: "Synthetic accounting approval for fixture generation only",
          })),
        });
      if (process.env.FINANCE_READ_ONLY_TEST !== "true") latest += 101;
      if (process.env.FINANCE_READ_ONLY_TEST !== "true")
        writeFileSync(
          process.env.WORK_FINANCE_POLICY_FIXTURES!,
          JSON.stringify(
            {
              admin: admin.id,
              staff: staff.id,
              owner: owner.id,
              originalIds,
              currentId,
              latest,
            },
            null,
            2,
          ),
        );
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
    });
    it("reads authoritative current beyond the 100-version bound, with private cache and atomic minimal audit", async () => {
      for (const a of [admin, staff, owner]) {
        const before = await prisma.auditLog.count({
          where: { entityId: a.id, action: "READ" },
        });
        const r = await request(app)
          .get(root + "/current")
          .set(a.headers);
        expect(r.status).toBe(200);
        expect(r.headers["cache-control"]).toBe("private, no-store");
        const data = financeWorkspaceResponse.parse(r.body.data);
        expect(data.current?.id).toBe(currentId);
        expect(data.history).toHaveLength(100);
        expect(data.history.some((v) => v.id === currentId)).toBe(false);
        expect(data.latest?.version).toBe(latest);
        const next = await prisma.businessPolicyVersion.findFirst({
          where: { key: "finance", effectiveAt: { gt: new Date(data.evaluatedAt) } },
          orderBy: [{ effectiveAt: "asc" }, { version: "desc" }],
        });
        expect(data.nextScheduled?.id).toBe(next?.id);
        expect(
          await prisma.auditLog.count({ where: { entityId: a.id, action: "READ" } }),
        ).toBe(before + 1);
      }
      const history = await request(app).get(root).set(admin.headers);
      expect(history.status).toBe(200);
      expect(history.body.data).toHaveLength(100);
    });
    it("enforces grant, account, role and strict query boundaries", async () => {
      for (const a of [noGrant, revoked, unverified, customer])
        for (const path of [root, root + "/current"])
          expect((await request(app).get(path).set(a.headers)).status).toBe(403);
      expect(
        (
          await request(app)
            .get(root + "/current?unexpected=true")
            .set(admin.headers)
        ).status,
      ).toBe(422);
      expect((await request(app).get(root + "/current")).status).toBe(401);
    });
    it("publishes an exact future version with conditional concurrency, CSRF and unchanged existing finances", async () => {
      const body = {
        kind: "FINANCE",
        expectedVersion: latest,
        effectiveAt: "2049-01-01T00:00:00.000Z",
        settings,
        source: "Synthetic signed accounting approval for isolated testing",
        approvalEvidence:
          "Synthetic accounting evidence for all proposed finance settings",
      };
      expect(
        (await request(app).post("/api/v1/admin/policies").set(owner.headers).send(body))
          .status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/policies")
            .set({ ...admin.headers, "x-csrf-token": "wrong" })
            .send(body)
        ).status,
      ).toBe(403);
      const r = await request(app)
        .post("/api/v1/admin/policies")
        .set(admin.headers)
        .send(body);
      expect(r.status).toBe(201);
      const saved = policyVersionResponse.parse(r.body.data);
      expect(saved.version).toBe(latest + 1);
      expect(saved.approvedByUserId).toBe(admin.id);
      expect(saved.settings).toEqual(settings);
      expect(saved.effectiveAt).toBe(body.effectiveAt);
      expect(
        (await request(app).post("/api/v1/admin/policies").set(admin.headers).send(body))
          .status,
      ).toBe(409);
      const audit = await prisma.auditLog.findMany({
        where: { entityId: admin.id, action: "CREATE" },
        select: { newValues: true },
      });
      expect(
        audit.some(
          (v) =>
            (v.newValues as { policyVersionId?: string })?.policyVersionId === saved.id,
        ),
      ).toBe(true);
      const state = (
        await request(app)
          .get(root + "/current")
          .set(admin.headers)
      ).body.data;
      expect(state.current?.id).toBe(currentId);
      expect(state.latest.id).toBe(saved.id);
      const next = await prisma.businessPolicyVersion.findFirst({
        where: { key: "finance", effectiveAt: { gt: new Date(state.evaluatedAt) } },
        orderBy: [{ effectiveAt: "asc" }, { version: "desc" }],
      });
      expect(state.nextScheduled?.id).toBe(next?.id);
      expect(await protectedRows()).toBe(beforeHash);
    });
  },
);
