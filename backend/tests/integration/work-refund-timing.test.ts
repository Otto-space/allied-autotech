import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { refundTimingWorkspaceResponse } from "../../src/modules/policies/refund-timing-workspace.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 }),
  root = "/api/v1/admin/policies",
  url = root + "/refund-timing/current";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "bank refund timing policy workspace",
  () => {
    const sessions: string[] = [],
      originals: Record<string, string[]> = {},
      evidence = process.env.WORK_REFUND_TIMING_FIXTURES!;
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
      startEvent: "APPROVED",
      businessDays: 10,
      countingConvention: "EXCLUDE_START_SAME_LOCAL_TIME",
      bankingDays: [1, 2, 3, 4, 5],
      holidays: ["2030-10-01"],
      timezone: "Africa/Lagos",
    };
    const body = () => ({
      kind: "BANK_REFUND_CLOCK",
      expectedVersion: latest,
      effectiveAt: "2049-01-05T07:30:00Z",
      settings,
      source: "Synthetic owner bank refund timing approval",
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
          "Retained bank refund timing fixtures exist. Inspect outcomes before any continuation; do not repeat writes.",
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
            where: { key: "bank_refund_clock" },
            orderBy: { version: "desc" },
          })
        )?.version ?? 0;
      for (const effectiveAt of [
        new Date("2030-01-01T00:00:00Z"),
        new Date(Date.now() - 1000),
      ]) {
        await prisma.businessPolicyVersion.create({
          data: {
            key: "bank_refund_clock",
            version: ++latest,
            approvalStatus: "APPROVED",
            approvedByUserId: owner,
            source: "Synthetic lower version clock fixture",
            sourceQuestion: "Q6",
            approvalEvidence: "Synthetic lower version clock fixture approval.",
            effectiveAt,
            settings,
          },
        });
      }
      const row = await prisma.businessPolicyVersion.create({
        data: {
          key: "bank_refund_clock",
          version: ++latest,
          approvalStatus: "APPROVED",
          approvedByUserId: owner,
          source: "Synthetic effective bank refund timing fixture",
          sourceQuestion: "Q6",
          approvalEvidence:
            "Synthetic signed effective bank refund timing fixture approval.",
          effectiveAt: new Date("2020-01-01T00:00:00Z"),
          settings,
        },
      });
      currentId = row.id;
      await prisma.businessPolicyVersion.createMany({
        data: Array.from({ length: 101 }, () => ({
          key: "bank_refund_clock",
          version: ++latest,
          approvalStatus: "APPROVED",
          approvedByUserId: owner,
          source: "Synthetic future bank refund timing fixture",
          sourceQuestion: "Q6",
          approvalEvidence: "Synthetic signed future calendar fixture approval.",
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
    it("returns private current/scheduled calendars beyond bounded history with atomic read audits", async () => {
      const beforeAudits = await prisma.auditLog.count({
          where: {
            userId: owner,
            action: "READ",
            newValues: { path: ["resource"], equals: "REFUND_TIMING_CURRENT" },
          },
        }),
        count = await prisma.businessPolicyVersion.count();
      const reads = await Promise.all(
        [1, 2].map(() => request(app).get(url).set(headers)),
      );
      for (const r of reads) {
        expect(r.status).toBe(200);
        expect(r.headers["cache-control"]).toContain("no-store");
        const value = refundTimingWorkspaceResponse.parse(r.body.data);
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
            newValues: { path: ["resource"], equals: "REFUND_TIMING_CURRENT" },
          },
        }),
      ).toBe(beforeAudits + 2);
    });
    it("enforces role, MFA, strict query, CSRF and exact typed calendar boundaries", async () => {
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
        { ...settings, bankingDays: [] },
        { ...settings, bankingDays: [7] },
        { ...settings, holidays: ["2030-02-30"] },
        { ...settings, businessDays: 9 },
        { ...settings, startEvent: "PAID" },
        { ...settings, timezone: "UTC" },
        { ...settings, countingConvention: "INCLUDE_START" },
        { ...settings, extra: true },
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
    it("publishes one concurrent Q6 version and audit while preserving current policy and existing records", async () => {
      const results = await Promise.all(
        [1, 2].map(() => request(app).post(root).set(headers).send(body())),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const saved = results.find((r) => r.status === 201)!.body.data;
      expect(saved).toMatchObject({
        key: "bank_refund_clock",
        version: latest + 1,
        approvedByUserId: owner,
        sourceQuestion: "Q6",
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
    it("records a distinct scheduled calendar without rewriting prior versions", async () => {
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
          settings: { ...settings, startEvent: "TRANSFER_RECORDED", bankingDays: [0, 6] },
        });
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        version: retained.latest + 1,
        sourceQuestion: "Q6",
        settings: { ...settings, startEvent: "TRANSFER_RECORDED", bankingDays: [0, 6] },
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
          phase: "calendar-published",
          calendarId: response.body.data.id,
          latest: response.body.data.version,
        }),
      );
    });
  },
);
