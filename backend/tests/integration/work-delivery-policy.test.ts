import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { deliveryWorkspaceResponse } from "../../src/modules/policies/delivery-policy-workspace.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 }),
  root = "/api/v1/admin/policies",
  url = root + "/delivery/current";
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "delivery policy workspace",
  () => {
    const sessions: string[] = [],
      originals: Record<string, string[]> = {},
      evidence = process.env.WORK_DELIVERY_FIXTURES!;
    const digest = (v: unknown) =>
      createHash("sha256")
        .update(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)))
        .digest("hex");
    let before: string,
      owner: string,
      latest: number,
      currentId: string,
      headers: Record<string, string>,
      admin: Record<string, string>,
      weak: Record<string, string>;
    const snapshot = () =>
      Promise.all([
        prisma.user.findMany({ orderBy: { id: "asc" } }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({
          where: { id: { in: originals.policies! } },
          orderBy: { id: "asc" },
        }),
        prisma.auditLog.findMany({
          where: { id: { in: originals.audits! } },
          orderBy: { id: "asc" },
        }),
        prisma.order.findMany({ orderBy: { id: "asc" } }),
        prisma.orderItem.findMany({ orderBy: { id: "asc" } }),
        prisma.invoice.findMany({ orderBy: { id: "asc" } }),
        prisma.payment.findMany({ orderBy: { id: "asc" } }),
        prisma.refund.findMany({ orderBy: { id: "asc" } }),
        prisma.booking.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
      ]);
    async function auth(userId: string, mfa = true) {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiry = new Date(Date.now() + 3600000),
        s = await prisma.session.create({
          data: {
            userId,
            tokenHash: hashToken("session", token),
            csrfTokenHash: hashToken("csrf", csrf),
            expiresAt: expiry,
            idleExpiresAt: expiry,
            mfaRequired: true,
            mfaVerifiedAt: mfa ? new Date() : null,
            createdAt: new Date(Date.now() - 1000),
          },
        });
      sessions.push(s.id);
      return {
        Cookie: `${sessionCookieName}=${token}`,
        Origin: env.FRONTEND_URL[0]!,
        "x-csrf-token": csrf,
      };
    }
    const settings = {
      collectionEnabled: true,
      collectionAddress:
        "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
      zones: [
        {
          id: "synthetic-central",
          label: "Synthetic central area",
          city: "Port Harcourt",
          state: "Rivers",
          feeKobo: "250000",
        },
        {
          id: "synthetic-extended",
          label: "Synthetic extended area",
          city: "Port Harcourt",
          state: "Rivers",
          feeKobo: "500000",
        },
      ],
    };
    const body = () => ({
      kind: "DELIVERY",
      expectedVersion: latest,
      effectiveAt: "2049-01-05T07:30:00Z",
      settings,
      source: "Synthetic owner delivery approval",
      approvalEvidence:
        "Synthetic signed area list and fee approval for isolated verification.",
    });
    beforeAll(async () => {
      expect(
        await prisma.$queryRaw`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`,
      ).toEqual([
        {
          database: "allied_work_staff_workforce_20261019_test",
          host: "127.0.0.1",
          port: 55480,
        },
      ]);
      expect(env.NODE_ENV).toBe("test");
      expect(
        await prisma.$queryRaw`SELECT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) AS elevated FROM pg_roles WHERE rolname=current_user`,
      ).toEqual([{ elevated: false }]);
      if (existsSync(evidence))
        throw Error(
          "Retained delivery fixtures exist. Inspect outcomes before any continuation; do not repeat writes.",
        );
      const base = JSON.parse(
        readFileSync(process.env.WORK_STAFF_WORKFORCE_FIXTURES!, "utf8"),
      );
      owner = base.owner;
      originals.policies = (
        await prisma.businessPolicyVersion.findMany({ select: { id: true } })
      ).map((v) => v.id);
      originals.audits = (await prisma.auditLog.findMany({ select: { id: true } })).map(
        (v) => v.id,
      );
      before = digest(await snapshot());
      writeFileSync(evidence, JSON.stringify({ phase: "setup", before, originals }));
      headers = await auth(owner);
      admin = await auth(base.adminId);
      weak = await auth(owner, false);
      latest =
        (
          await prisma.businessPolicyVersion.findFirst({
            where: { key: "delivery" },
            orderBy: { version: "desc" },
          })
        )?.version ?? 0;
      const row = await prisma.businessPolicyVersion.create({
        data: {
          key: "delivery",
          version: ++latest,
          approvalStatus: "APPROVED",
          approvedByUserId: owner,
          source: "Synthetic effective delivery fixture",
          sourceQuestion: "Q1",
          approvalEvidence: "Synthetic signed effective delivery fixture approval.",
          effectiveAt: new Date(Date.now() - 1000),
          settings,
        },
      });
      currentId = row.id;
      await prisma.businessPolicyVersion.create({
        data: {
          key: "delivery",
          version: ++latest,
          approvalStatus: "APPROVED",
          approvedByUserId: owner,
          source: "Synthetic future delivery fixture",
          sourceQuestion: "Q1",
          approvalEvidence: "Synthetic signed future delivery fixture approval.",
          effectiveAt: new Date("2050-01-01T00:00:00Z"),
          settings,
        },
      });
      writeFileSync(
        evidence,
        JSON.stringify({ phase: "tests", before, originals, owner, currentId, latest }),
      );
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      if (before) {
        const rows = await snapshot(),
          unchanged = digest(rows) === before;
        writeFileSync(
          evidence.replace("fixtures", "preservation"),
          JSON.stringify({
            originalRowsUnchanged: unchanged,
            counts: rows.map((v) => v.length),
            remainingSessions: await prisma.session.count({
              where: { id: { in: sessions } },
            }),
          }),
        );
        expect(unchanged).toBe(true);
      }
    });
    it("returns private current/scheduled policy and the existing checkout readiness with atomic read audits", async () => {
      const beforeAudits = await prisma.auditLog.count({
          where: {
            userId: owner,
            action: "READ",
            newValues: { path: ["resource"], equals: "DELIVERY_POLICY_CURRENT" },
          },
        }),
        count = await prisma.businessPolicyVersion.count();
      const reads = await Promise.all(
        [1, 2].map(() => request(app).get(url).set(headers)),
      );
      for (const r of reads) {
        expect(r.status).toBe(200);
        expect(r.headers["cache-control"]).toContain("no-store");
        const value = deliveryWorkspaceResponse.parse(r.body.data);
        expect(value.current?.id).toBe(currentId);
        expect(value.latest?.version).toBe(latest);
        expect(value.history.length).toBeLessThanOrEqual(100);
        expect(value.nextScheduled).not.toBeNull();
        const publicState = (await request(app).get("/api/v1/public/fulfillment-options"))
          .body.data;
        expect(value.availability).toEqual({
          checkoutEnabled: publicState.checkoutEnabled,
          deliveryEnabled: publicState.delivery.enabled,
        });
      }
      expect(await prisma.businessPolicyVersion.count()).toBe(count);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: owner,
            action: "READ",
            newValues: { path: ["resource"], equals: "DELIVERY_POLICY_CURRENT" },
          },
        }),
      ).toBe(beforeAudits + 2);
    });
    it("enforces role, MFA, strict query, CSRF and exact typed delivery boundaries", async () => {
      expect((await request(app).get(url)).status).toBe(401);
      for (const h of [admin, weak])
        expect((await request(app).get(url).set(h)).status).toBe(403);
      expect(
        (
          await request(app)
            .get(url + "?unexpected=1")
            .set(headers)
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .post(root)
            .set({ Cookie: headers.Cookie!, Origin: headers.Origin! })
            .send(body())
        ).status,
      ).toBe(403);
      const count = await prisma.businessPolicyVersion.count();
      for (const delta of [
        { zones: [] },
        { zones: [settings.zones[0], settings.zones[0]] },
        { zones: [{ ...settings.zones[0], feeKobo: "1000000000000000" }] },
        { collectionAddress: "Unapproved collection address" },
        { zones: [{ ...settings.zones[0], feeKobo: "1.01" }] },
        { zones: [{ ...settings.zones[0], label: "Control\ncharacter" }] },
      ])
        expect(
          (
            await request(app)
              .post(root)
              .set(headers)
              .send({ ...body(), settings: { ...settings, ...delta } })
          ).status,
        ).toBe(422);
      expect(await prisma.businessPolicyVersion.count()).toBe(count);
    });
    it("publishes one concurrent Q1 version and audit while preserving current policy and existing orders", async () => {
      const results = await Promise.all(
        [1, 2].map(() => request(app).post(root).set(headers).send(body())),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const saved = results.find((r) => r.status === 201)!.body.data;
      expect(saved).toMatchObject({
        key: "delivery",
        version: latest + 1,
        approvedByUserId: owner,
        sourceQuestion: "Q1",
        settings,
      });
      expect(
        await prisma.auditLog.count({
          where: {
            userId: owner,
            action: "CREATE",
            newValues: { path: ["policyVersionId"], equals: saved.id },
          },
        }),
      ).toBe(1);
      const current = (await request(app).get(url).set(headers)).body.data;
      expect(current.current.id).toBe(currentId);
      expect(current.latest.id).toBe(saved.id);
      const retained = JSON.parse(readFileSync(evidence, "utf8"));
      writeFileSync(
        evidence,
        JSON.stringify({
          ...retained,
          phase: "published",
          publishedId: saved.id,
          latest: latest + 1,
        }),
      );
    });
  },
);
