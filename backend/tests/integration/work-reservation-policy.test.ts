import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { reservationWorkspaceResponse } from "../../src/modules/policies/reservation-policy-workspace.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 }),
  root = "/api/v1/admin/policies",
  url = root + "/reservation-terms/current";
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "reservation policy workspace",
  () => {
    const sessions: string[] = [],
      originals: Record<string, string[]> = {},
      evidence = process.env.WORK_RESERVATION_FIXTURES!;
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
        prisma.vehicleTransaction.findMany({ orderBy: { id: "asc" } }),
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
      enabled: true,
      title: "Synthetic reservation agreement",
      body: "Synthetic agreement for isolated verification only.\n\nExact accepted documents remain unchanged.",
    };
    const body = () => ({
      kind: "VEHICLE_RESERVATION_TERMS",
      expectedVersion: latest,
      effectiveAt: "2049-01-05T07:30:00Z",
      settings,
      source: "Synthetic owner reservation approval",
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
          "Retained reservation fixtures exist. Inspect outcomes before any continuation; do not repeat writes.",
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
            where: { key: "vehicle_reservation_terms" },
            orderBy: { version: "desc" },
          })
        )?.version ?? 0;
      const row = await prisma.businessPolicyVersion.create({
        data: {
          key: "vehicle_reservation_terms",
          version: ++latest,
          approvalStatus: "APPROVED",
          approvedByUserId: owner,
          source: "Synthetic effective reservation fixture",
          sourceQuestion: "Q3",
          approvalEvidence: "Synthetic signed effective reservation fixture approval.",
          effectiveAt: new Date(Date.now() - 1000),
          settings,
        },
      });
      currentId = row.id;
      await prisma.businessPolicyVersion.createMany({
        data: Array.from({ length: 101 }, () => ({
          key: "vehicle_reservation_terms",
          version: ++latest,
          approvalStatus: "APPROVED",
          approvedByUserId: owner,
          source: "Synthetic future reservation fixture",
          sourceQuestion: "Q3",
          approvalEvidence: "Synthetic signed future agreement fixture approval.",
          effectiveAt: new Date("2050-01-01T00:00:00Z"),
          settings,
        })),
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
    it("returns private current/scheduled agreements beyond bounded history with atomic read audits", async () => {
      const beforeAudits = await prisma.auditLog.count({
          where: {
            userId: owner,
            action: "READ",
            newValues: { path: ["resource"], equals: "RESERVATION_POLICY_CURRENT" },
          },
        }),
        count = await prisma.businessPolicyVersion.count();
      const reads = await Promise.all(
        [1, 2].map(() => request(app).get(url).set(headers)),
      );
      for (const r of reads) {
        expect(r.status).toBe(200);
        expect(r.headers["cache-control"]).toContain("no-store");
        const value = reservationWorkspaceResponse.parse(r.body.data);
        expect(value.current?.id).toBe(currentId);
        expect(value.latest?.version).toBe(latest);
        expect(value.history.length).toBeLessThanOrEqual(100);
        expect(value.nextScheduled).not.toBeNull();
        expect(value.history).toHaveLength(100);
        expect(value.history.some((v) => v.id === currentId)).toBe(false);
        expect(value.nextScheduled?.version).toBe(latest);
      }
      expect(await prisma.businessPolicyVersion.count()).toBe(count);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: owner,
            action: "READ",
            newValues: { path: ["resource"], equals: "RESERVATION_POLICY_CURRENT" },
          },
        }),
      ).toBe(beforeAudits + 2);
    });
    it("enforces role, MFA, strict query, CSRF and exact typed agreement boundaries", async () => {
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
      for (const invalid of [
        { ...settings, title: "" },
        { ...settings, body: "x".repeat(50001) },
        { ...settings, body: "bad\u0001text" },
        { ...settings, extra: true },
        { enabled: false, reason: "" },
        { enabled: false, reason: "x".repeat(1001) },
        { enabled: false, reason: "Synthetic reason", body: "Unexpected published text" },
      ])
        expect(
          (
            await request(app)
              .post(root)
              .set(headers)
              .send({ ...body(), settings: invalid })
          ).status,
        ).toBe(422);
      expect(await prisma.businessPolicyVersion.count()).toBe(count);
    });
    it("publishes one concurrent Q3 version and audit while preserving current policy and existing acceptances", async () => {
      const results = await Promise.all(
        [1, 2].map(() => request(app).post(root).set(headers).send(body())),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const saved = results.find((r) => r.status === 201)!.body.data;
      expect(saved).toMatchObject({
        key: "vehicle_reservation_terms",
        version: latest + 1,
        approvedByUserId: owner,
        sourceQuestion: "Q3",
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
    it("records a distinct scheduled withdrawal without rewriting agreement or acceptance history", async () => {
      const retained = JSON.parse(readFileSync(evidence, "utf8"));
      const published = await prisma.businessPolicyVersion.findUniqueOrThrow({
          where: { id: retained.publishedId },
        }),
        hash = digest(published);
      const response = await request(app)
        .post(root)
        .set(headers)
        .send({
          ...body(),
          expectedVersion: retained.latest,
          effectiveAt: "2048-01-05T07:30:00Z",
          settings: {
            enabled: false,
            reason: "Synthetic scheduled withdrawal for isolated verification.",
          },
        });
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        version: retained.latest + 1,
        sourceQuestion: "Q3",
        settings: {
          enabled: false,
          reason: "Synthetic scheduled withdrawal for isolated verification.",
        },
      });
      expect(
        digest(
          await prisma.businessPolicyVersion.findUniqueOrThrow({
            where: { id: published.id },
          }),
        ),
      ).toBe(hash);
      const current = (await request(app).get(url).set(headers)).body.data;
      expect(current.current.id).toBe(currentId);
      expect(current.nextScheduled.id).toBe(response.body.data.id);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: owner,
            action: "CREATE",
            newValues: { path: ["policyVersionId"], equals: response.body.data.id },
          },
        }),
      ).toBe(1);
      writeFileSync(
        evidence,
        JSON.stringify({
          ...retained,
          phase: "withdrawn",
          withdrawalId: response.body.data.id,
          latest: response.body.data.version,
        }),
      );
    });
  },
);
