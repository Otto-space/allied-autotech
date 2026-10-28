import { randomUUID, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  retentionWorkspaceResponse,
  readRetentionPolicy,
} from "../../src/modules/policies/retention-policy-workspace.js";
import { publishPolicy } from "../../src/modules/policies/policies.service.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
const root = "/api/v1/admin/policies",
  context = { requestId: "work-retention-policy", ipAddress: null, userAgent: null };
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

describe.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "retention policy authoritative workspace",
  () => {
    const sessions: string[] = [],
      originals: Record<string, string[]> = {};
    const digest = (value: unknown) =>
      createHash("sha256")
        .update(
          JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
        )
        .digest("hex");
    let before: string,
      owner: Awaited<ReturnType<typeof auth>>,
      admin: Awaited<ReturnType<typeof auth>>,
      noMfa: Awaited<ReturnType<typeof auth>>,
      contact: string,
      currentId: string,
      latest: number;
    const evidence = process.env.WORK_RETENTION_FIXTURES!;
    const snapshot = () =>
      Promise.all([
        prisma.user.findMany({
          where: { id: { in: originals.users! } },
          orderBy: { id: "asc" },
        }),
        prisma.staffProfile.findMany({
          where: { id: { in: originals.staff! } },
          orderBy: { id: "asc" },
        }),
        prisma.businessPolicyVersion.findMany({
          where: { id: { in: originals.policies! } },
          orderBy: { id: "asc" },
        }),
        prisma.auditLog.findMany({
          where: { id: { in: originals.audits! } },
          orderBy: { id: "asc" },
        }),
        prisma.complaint.findMany({ orderBy: { id: "asc" } }),
        prisma.payment.findMany({ orderBy: { id: "asc" } }),
        prisma.invoice.findMany({ orderBy: { id: "asc" } }),
        prisma.refund.findMany({ orderBy: { id: "asc" } }),
        prisma.branch.findMany({ orderBy: { id: "asc" } }),
        prisma.privacyRequest.findMany({ orderBy: { id: "asc" } }),
        prisma.retentionHold.findMany({ orderBy: { id: "asc" } }),
      ]);
    async function auth(userId: string, assured = true) {
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
          mfaVerifiedAt: assured ? new Date() : null,
          createdAt: new Date(Date.now() - 1000),
        },
      });
      sessions.push(s.id);
      return {
        userId,
        sessionId: s.id,
        headers: {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "x-csrf-token": csrf,
        },
      };
    }
    const settings = () => ({
      destructiveExecutionEnabled: false as const,
      records: [
        {
          recordType: "INVOICE" as const,
          retentionMonths: 84,
          startEvent: "Synthetic invoice issue date",
          disposition: "RETAIN" as const,
          legalBasis: "Synthetic approved accounting retention basis for testing only.",
        },
      ],
    });
    const body = () => ({
      kind: "RETENTION" as const,
      expectedVersion: latest,
      effectiveAt: new Date().toISOString(),
      settings: settings(),
      source: "Synthetic isolated retention approval",
      approvalEvidence: "Synthetic written approval for this isolated test version only",
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
      if (process.env.WORK_RETENTION_CONTINUE === "true") {
        const retained = JSON.parse(readFileSync(evidence, "utf8"));
        if (!["published", "verified"].includes(retained.phase) || !retained.publishedId)
          throw Error("No confirmed published fixture to inspect");
        Object.assign(originals, retained.originals);
        before = retained.before;
        contact = retained.contact;
        currentId = retained.currentId;
        latest = retained.latest;
        expect(digest(await snapshot())).toBe(before);
        owner = await auth(retained.owner);
        admin = await auth(contact);
        noMfa = await auth(retained.owner, false);
        return;
      }
      if (existsSync(evidence))
        throw Error(
          "Retained retention fixtures exist; inspect outcomes before an explicit continuation",
        );
      const base = JSON.parse(
        readFileSync(process.env.WORK_STAFF_WORKFORCE_FIXTURES!, "utf8"),
      );
      originals.users = (await prisma.user.findMany({ select: { id: true } })).map(
        (v) => v.id,
      );
      originals.staff = (
        await prisma.staffProfile.findMany({ select: { id: true } })
      ).map((v) => v.id);
      originals.policies = (
        await prisma.businessPolicyVersion.findMany({ select: { id: true } })
      ).map((v) => v.id);
      originals.audits = (await prisma.auditLog.findMany({ select: { id: true } })).map(
        (v) => v.id,
      );
      before = digest(await snapshot());
      writeFileSync(evidence, JSON.stringify({ originals, before, phase: "setup" }));
      const person = await prisma.user.create({
        data: {
          email: `work-retention-${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-test-only",
          role: "ADMIN",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: { firstName: "Synthetic", lastName: "Retention Contact" },
          },
        },
      });
      contact = person.id;
      owner = await auth(base.owner);
      admin = await auth(contact);
      noMfa = await auth(base.owner, false);
      latest =
        (
          await prisma.businessPolicyVersion.findFirst({
            where: { key: "retention" },
            orderBy: { version: "desc" },
          })
        )?.version ?? 0;
      const effective = await prisma.businessPolicyVersion.create({
        data: {
          key: "retention",
          version: ++latest,
          approvalStatus: "APPROVED",
          source: "Synthetic effective retention fixture",
          sourceQuestion: "Q13",
          approvedByUserId: owner.userId,
          effectiveAt: new Date(Date.now() - 1000),
          settings: settings(),
          approvalEvidence: "Synthetic isolated approval for current selection test",
        },
      });
      currentId = effective.id;
      await prisma.businessPolicyVersion.createMany({
        data: Array.from({ length: 101 }, (_, i) => ({
          key: "retention",
          version: latest + i + 1,
          approvalStatus: "APPROVED",
          source: "Synthetic future retention selection fixture",
          sourceQuestion: "Q13",
          approvedByUserId: owner.userId,
          effectiveAt: new Date("2050-01-01T00:00:00Z"),
          settings: settings(),
          approvalEvidence: "Synthetic isolated approval for future selection test",
        })),
      });
      latest += 101;
      writeFileSync(
        evidence,
        JSON.stringify({
          originals,
          before,
          owner: owner.userId,
          contact,
          currentId,
          latest,
          phase: "tests",
        }),
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
            remainingTestSessions: await prisma.session.count({
              where: { id: { in: sessions } },
            }),
          }),
        );
        expect(unchanged).toBe(true);
      }
    });
    it("concurrent authenticated reads retain one audit each and do not publish", async () => {
      const count = await prisma.businessPolicyVersion.count();
      for (let round = 0; round < 4; round++) {
        const beforeReads = await prisma.auditLog.count({
          where: {
            userId: owner.userId,
            action: "READ",
            newValues: { path: ["resource"], equals: "RETENTION_POLICY_CURRENT" },
          },
        });
        const responses = await Promise.all([
          request(app)
            .get(root + "/retention/current")
            .set(owner.headers),
          request(app).get("/api/v1/staff/profile").set(owner.headers),
          request(app)
            .get(root + "/retention/current")
            .set(owner.headers),
        ]);
        expect(responses.map((v) => v.status)).toEqual([200, 200, 200]);
        expect(
          await prisma.auditLog.count({
            where: {
              userId: owner.userId,
              action: "READ",
              newValues: { path: ["resource"], equals: "RETENTION_POLICY_CURRENT" },
            },
          }),
        ).toBe(beforeReads + 2);
      }
      expect(await prisma.businessPolicyVersion.count()).toBe(count);
    });
    it("selects effective current outside bounded history and audits private authorized reads", async () => {
      const response = await request(app)
        .get(root + "/retention/current")
        .set(owner.headers)
        .set("x-request-id", "retention-current-audit");
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      const data = retentionWorkspaceResponse.parse(response.body.data);
      const retained = JSON.parse(readFileSync(evidence, "utf8"));
      expect(data.current?.id).toBe(
        process.env.WORK_RETENTION_CONTINUE === "true" ? retained.publishedId : currentId,
      );
      expect(data.latest?.version).toBe(
        latest + (process.env.WORK_RETENTION_CONTINUE === "true" ? 1 : 0),
      );
      expect(data.history).toHaveLength(100);
      expect(data.history.some((v) => v.id === currentId)).toBe(false);
      expect(data.nextScheduled?.version).toBe(latest);
      const audit = await prisma.auditLog.findFirst({
        where: {
          userId: owner.userId,
          action: "READ",
          newValues: { path: ["resource"], equals: "RETENTION_POLICY_CURRENT" },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit?.newValues).toEqual({
        resource: "RETENTION_POLICY_CURRENT",
        returnedCount: 100,
      });
    });
    it("rejects ordinary Admin, missing MFA, strict query and missing CSRF without publication", async () => {
      expect(
        (
          await request(app)
            .get(root + "/retention/current")
            .set(admin.headers)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .get(root + "/retention/current")
            .set(noMfa.headers)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .get(root + "/retention/current?limit=1")
            .set(owner.headers)
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .post(root)
            .set({ Cookie: owner.headers.Cookie, Origin: owner.headers.Origin })
            .send(body())
        ).status,
      ).toBe(403);
      expect((await request(app).post(root).set(admin.headers).send(body())).status).toBe(
        403,
      );
    });
    it("rechecks revoked session inside both read and publication transactions", async () => {
      const session = await auth(owner.userId);
      await prisma.session.update({
        where: { id: session.sessionId },
        data: { revokedAt: new Date() },
      });
      const actor: AuthenticatedActor = {
        userId: owner.userId,
        sessionId: session.sessionId,
        role: "SUPER_ADMIN",
        email: "synthetic@example.test",
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      await expect(readRetentionPolicy(actor, context)).rejects.toThrow();
      await expect(publishPolicy(actor, body(), context)).rejects.toThrow();
    });
    it("rejects stale versions, destructive execution and invalid retention rules without changes", async () => {
      const count = await prisma.businessPolicyVersion.count();
      expect(
        (
          await request(app)
            .post(root)
            .set(owner.headers)
            .send({ ...body(), expectedVersion: latest - 1 })
        ).status,
      ).toBe(409);
      const rule = settings().records[0]!;
      for (const change of [
        { destructiveExecutionEnabled: true },
        { records: [] },
        { records: Array.from({ length: 21 }, () => rule) },
        { records: [{ ...rule, retentionMonths: 0 }] },
        { records: [{ ...rule, retentionMonths: 1201 }] },
        { records: [{ ...rule, retentionMonths: 1.5 }] },
        { records: [{ ...rule, startEvent: " ".repeat(5) }] },
        { records: [{ ...rule, legalBasis: " ".repeat(20) }] },
        { records: [{ ...rule, disposition: "DELETE_NOW" }] },
      ]) {
        expect(
          (
            await request(app)
              .post(root)
              .set(owner.headers)
              .send({ ...body(), settings: { ...settings(), ...change } })
          ).status,
        ).toBe(422);
      }
      expect(await prisma.businessPolicyVersion.count()).toBe(count);
    });
    it("publishes exactly once with Q13 actor evidence and rejects a duplicate base version", async () => {
      if (process.env.WORK_RETENTION_CONTINUE === "true") {
        const retained = JSON.parse(readFileSync(evidence, "utf8"));
        const saved = await prisma.businessPolicyVersion.findUniqueOrThrow({
          where: { id: retained.publishedId },
        });
        expect(saved).toMatchObject({
          key: "retention",
          version: latest + 1,
          approvedByUserId: owner.userId,
          sourceQuestion: "Q13",
          settings: settings(),
        });
        expect(await prisma.businessPolicyVersion.count()).toBe(
          originals.policies!.length + 103,
        );
        expect(
          await prisma.auditLog.count({
            where: {
              userId: owner.userId,
              action: "CREATE",
              newValues: { path: ["policyVersionId"], equals: saved.id },
            },
          }),
        ).toBe(1);
        const read = await request(app)
          .get(root + "/retention/current")
          .set(owner.headers);
        expect(read.body.data.current.id).toBe(saved.id);
        writeFileSync(evidence, JSON.stringify({ ...retained, phase: "verified" }));
        return;
      }
      const input = body(),
        count = await prisma.businessPolicyVersion.count();
      const response = await request(app).post(root).set(owner.headers).send(input);
      expect(response.status).toBe(201);
      const saved = response.body.data;
      writeFileSync(
        evidence,
        JSON.stringify({
          originals,
          before,
          owner: owner.userId,
          contact,
          currentId,
          latest,
          publishedId: saved.id,
          phase: "published",
        }),
      );
      expect(saved).toMatchObject({
        key: "retention",
        version: latest + 1,
        sourceQuestion: "Q13",
        approvedByUserId: owner.userId,
        settings: settings(),
        source: input.source,
        approvalEvidence: input.approvalEvidence,
      });
      expect((await request(app).post(root).set(owner.headers).send(input)).status).toBe(
        409,
      );
      expect(await prisma.businessPolicyVersion.count()).toBe(count + 1);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: owner.userId,
            action: "CREATE",
            newValues: { path: ["policyVersionId"], equals: saved.id },
          },
        }),
      ).toBe(1);
      const read = await request(app)
        .get(root + "/retention/current")
        .set(owner.headers);
      expect(read.body.data.current.id).toBe(saved.id);
    });
  },
);
