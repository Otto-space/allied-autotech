import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { capacityWorkspaceResponse } from "../../src/modules/policies/capacity-policy-workspace.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 }),
  root = "/api/v1/admin/policies";
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "branch capacity policy workspace",
  () => {
    const sessions: string[] = [],
      originals: Record<string, string[]> = {};
    const digest = (v: unknown) =>
      createHash("sha256")
        .update(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)))
        .digest("hex");
    let before: string,
      owner: string,
      branchId: string,
      inactiveId: string,
      headers: Record<string, string>,
      weak: Record<string, string>,
      admin: Record<string, string>,
      currentId: string;
    const evidence = process.env.WORK_CAPACITY_FIXTURES!;
    const snapshot = () =>
      Promise.all([
        prisma.user.findMany({
          where: { id: { in: originals.users! } },
          orderBy: { id: "asc" },
        }),
        prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
        prisma.businessPolicyVersion.findMany({
          where: { id: { in: originals.policies! } },
          orderBy: { id: "asc" },
        }),
        prisma.auditLog.findMany({
          where: { id: { in: originals.audits! } },
          orderBy: { id: "asc" },
        }),
        prisma.branch.findMany({
          where: { id: { in: originals.branches! } },
          orderBy: { id: "asc" },
        }),
        prisma.booking.findMany({ orderBy: { id: "asc" } }),
        prisma.payment.findMany({ orderBy: { id: "asc" } }),
        prisma.invoice.findMany({ orderBy: { id: "asc" } }),
        prisma.refund.findMany({ orderBy: { id: "asc" } }),
        prisma.privacyRequest.findMany({ orderBy: { id: "asc" } }),
        prisma.retentionHold.findMany({ orderBy: { id: "asc" } }),
      ]);
    async function auth(userId: string, mfa = true) {
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        expiry = new Date(Date.now() + 3600000);
      const s = await prisma.session.create({
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
      dailyLimit: 8,
      openingDays: [1, 2, 3, 4, 5],
      opensAt: "08:00",
      closesAt: "18:00",
      holidays: [],
      timezone: "Africa/Lagos",
    };
    const body = () => ({
      kind: "BRANCH_CAPACITY",
      branchId,
      expectedVersion: 102,
      effectiveAt: "2049-01-01T00:00:00Z",
      settings,
      source: "Synthetic isolated workshop approval",
      approvalEvidence:
        "Synthetic signed approval for isolated capacity verification only.",
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
      if (existsSync(evidence)) {
        const retained = JSON.parse(readFileSync(evidence, "utf8"));
        if (
          process.env.WORK_CAPACITY_CONTINUE === "true" &&
          ["tests", "published"].includes(retained.phase)
        ) {
          Object.assign(originals, retained.originals);
          before = retained.before;
          expect(digest(await snapshot())).toBe(before);
          owner = retained.owner;
          branchId = retained.branchId;
          inactiveId = retained.inactiveId;
          currentId = retained.currentId;
          headers = await auth(owner);
          weak = await auth(owner, false);
          const base = JSON.parse(
            readFileSync(process.env.WORK_STAFF_WORKFORCE_FIXTURES!, "utf8"),
          );
          admin = await auth(base.adminId);
          expect(
            await prisma.businessPolicyVersion.count({
              where: { key: `booking-capacity:${branchId}`, version: 103 },
            }),
          ).toBe(1);
          return;
        }
        if (
          process.env.WORK_CAPACITY_RESUME_SETUP !== "true" ||
          retained.phase !== "setup"
        )
          throw Error(
            "Retained capacity fixtures exist; inspect before continuing. Do not repeat writes.",
          );
        Object.assign(originals, retained.originals);
        expect(digest(await snapshot())).toBe(retained.before);
        expect(
          await prisma.branch.count({
            where: { code: { startsWith: "QA-CAPACITY-98-" } },
          }),
        ).toBe(0);
      }
      const base = JSON.parse(
        readFileSync(process.env.WORK_STAFF_WORKFORCE_FIXTURES!, "utf8"),
      );
      owner = base.owner;
      originals.users = (await prisma.user.findMany({ select: { id: true } })).map(
        (v) => v.id,
      );
      originals.policies = (
        await prisma.businessPolicyVersion.findMany({ select: { id: true } })
      ).map((v) => v.id);
      originals.audits = (await prisma.auditLog.findMany({ select: { id: true } })).map(
        (v) => v.id,
      );
      originals.branches = (await prisma.branch.findMany({ select: { id: true } })).map(
        (v) => v.id,
      );
      before = digest(await snapshot());
      writeFileSync(evidence, JSON.stringify({ phase: "setup", originals, before }));
      branchId = (
        await prisma.branch.create({
          data: {
            code: "QA-CAPACITY-98-A",
            address: "Synthetic isolated test address",
            city: "Port Harcourt",
            state: "Rivers",
            name: "Synthetic capacity verification workshop",
            isActive: true,
          },
        })
      ).id;
      inactiveId = (
        await prisma.branch.create({
          data: {
            code: "QA-CAPACITY-98-B",
            address: "Synthetic isolated test address",
            city: "Port Harcourt",
            state: "Rivers",
            name: "Synthetic inactive capacity workshop",
            isActive: false,
          },
        })
      ).id;
      headers = await auth(owner);
      weak = await auth(owner, false);
      admin = await auth(base.adminId);
      const rows = await prisma.businessPolicyVersion.createManyAndReturn({
        data: Array.from({ length: 102 }, (_, i) => ({
          key: `booking-capacity:${branchId}`,
          version: i + 1,
          approvalStatus: "APPROVED",
          source: "Synthetic isolated capacity selection fixture",
          sourceQuestion: "Q5",
          approvedByUserId: owner,
          effectiveAt: new Date(
            i === 0 ? "2026-01-01T00:00:00Z" : "2050-01-01T00:00:00Z",
          ),
          settings,
          approvalEvidence: "Synthetic isolated written capacity approval.",
        })),
      });
      currentId = rows.find((v) => v.version === 1)!.id;
      writeFileSync(
        evidence,
        JSON.stringify({
          phase: "tests",
          originals,
          before,
          owner,
          branchId,
          inactiveId,
          currentId,
          latest: 102,
        }),
      );
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      if (before) {
        const rows = await snapshot(),
          same = digest(rows) === before;
        writeFileSync(
          evidence.replace("fixtures", "preservation"),
          JSON.stringify({
            originalRowsUnchanged: same,
            counts: rows.map((v) => v.length),
            remainingSessions: await prisma.session.count({
              where: { id: { in: sessions } },
            }),
          }),
        );
        expect(same).toBe(true);
      }
    });
    it("reads effective policy outside bounded history, latest and earliest scheduled tie", async () => {
      const count = await prisma.businessPolicyVersion.count(),
        auditBefore = await prisma.auditLog.count({
          where: { userId: owner, entityId: branchId, action: "READ" },
        });
      const responses = await Promise.all(
        [1, 2].map(() =>
          request(app).get(`${root}/booking-capacity/${branchId}/current`).set(headers),
        ),
      );
      for (const r of responses) {
        expect(r.status).toBe(200);
        expect(r.headers["cache-control"]).toContain("no-store");
        const state = capacityWorkspaceResponse.parse(r.body.data);
        expect(state.current?.id).toBe(currentId);
        const expected = process.env.WORK_CAPACITY_CONTINUE === "true" ? 103 : 102;
        expect(state.latest?.version).toBe(expected);
        expect(state.nextScheduled?.version).toBe(expected);
        expect(state.history).toHaveLength(100);
        expect(state.history.some((v) => v.id === currentId)).toBe(false);
        expect(Object.keys(state.branch).sort()).toEqual([
          "id",
          "isActive",
          "name",
          "updatedAt",
        ]);
      }
      expect(await prisma.businessPolicyVersion.count()).toBe(count);
      expect(
        await prisma.auditLog.count({
          where: { userId: owner, entityId: branchId, action: "READ" },
        }),
      ).toBe(auditBefore + 2);
    });
    it("rejects anonymous, non-owner, missing MFA, malformed query and unknown branch", async () => {
      const url = `${root}/booking-capacity/${branchId}/current`;
      expect((await request(app).get(url)).status).toBe(401);
      for (const h of [admin, weak])
        expect((await request(app).get(url).set(h)).status).toBe(403);
      expect(
        (
          await request(app)
            .get(url + "?unexpected=true")
            .set(headers)
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .get(`${root}/booking-capacity/not-a-uuid/current`)
            .set(headers)
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .get(`${root}/booking-capacity/${randomUUID()}/current`)
            .set(headers)
        ).status,
      ).toBe(404);
    });
    it("allows inactive history inspection but rejects its publication and missing CSRF", async () => {
      const r = await request(app)
        .get(`${root}/booking-capacity/${inactiveId}/current`)
        .set(headers);
      expect(r.status).toBe(200);
      expect(r.body.data.branch.isActive).toBe(false);
      expect(r.body.data.history).toEqual([]);
      expect(
        (
          await request(app)
            .post(root)
            .set(headers)
            .send({ ...body(), branchId: inactiveId, expectedVersion: 0 })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .post(root)
            .set({ Cookie: headers.Cookie!, Origin: headers.Origin! })
            .send(body())
        ).status,
      ).toBe(403);
    });
    it("rejects impossible calendar and out-of-range limits without publication", async () => {
      const beforeCount = await prisma.businessPolicyVersion.count();
      for (const delta of [
        { dailyLimit: 0 },
        { dailyLimit: 1001 },
        { openingDays: [] },
        { opensAt: "07:00" },
        { holidays: ["2048-02-30"] },
      ])
        expect(
          (
            await request(app)
              .post(root)
              .set(headers)
              .send({ ...body(), settings: { ...settings, ...delta } })
          ).status,
        ).toBe(422);
      expect(await prisma.businessPolicyVersion.count()).toBe(beforeCount);
    });
    it("serializes concurrent approvals with exactly one Q5 record and audit", async () => {
      const results =
        process.env.WORK_CAPACITY_CONTINUE === "true"
          ? null
          : await Promise.all(
              [1, 2].map(() => request(app).post(root).set(headers).send(body())),
            );
      if (results) expect(results.map((v) => v.status).sort()).toEqual([201, 409]);
      const saved = results
        ? results.find((v) => v.status === 201)!.body.data
        : await prisma.businessPolicyVersion.findFirstOrThrow({
            where: { key: `booking-capacity:${branchId}`, version: 103 },
          });
      expect(saved).toMatchObject({
        key: `booking-capacity:${branchId}`,
        version: 103,
        sourceQuestion: "Q5",
        approvedByUserId: owner,
        settings,
      });
      expect(
        await prisma.auditLog.count({
          where: {
            entityId: owner,
            action: "CREATE",
            newValues: { path: ["policyVersionId"], equals: saved.id },
          },
        }),
      ).toBe(1);
      const data = (
        await request(app)
          .get(`${root}/booking-capacity/${branchId}/current`)
          .set(headers)
      ).body.data;
      expect(data.current.id).toBe(currentId);
      expect(data.nextScheduled.id).toBe(saved.id);
      const retained = JSON.parse(readFileSync(evidence, "utf8"));
      writeFileSync(
        evidence,
        JSON.stringify({
          ...retained,
          phase: "published",
          publishedId: saved.id,
          latest: 103,
        }),
      );
    });
  },
);
