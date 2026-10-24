import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import request from "supertest";
import { it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
const provisionedWorkspaceAcceptanceChecksEnabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_PROVISIONED_WORKSPACE_TESTS === "true";

it.skipIf(!provisionedWorkspaceAcceptanceChecksEnabled)(
  "verifies remaining demotion rejections without replaying completed account changes",
  async () => {
    const [actual] = await prisma.$queryRaw<
      { database: string; host: string; port: number }[]
    >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
    expect(actual).toEqual({
      database: "allied_work_aftercare_20261017_test",
      host: "127.0.0.1",
      port: 55480,
    });
    expect(env.NODE_ENV).toBe("test");
    const fixture = JSON.parse(
      readFileSync(process.env.WORK_STAFF_ACCOUNT_FIXTURES!, "utf8"),
    );
    const digest = (v: unknown) =>
      createHash("sha256").update(JSON.stringify(v)).digest("hex");
    const rows = async () =>
      digest(
        await Promise.all([
          prisma.user.findMany({ orderBy: { id: "asc" } }),
          prisma.staffProfile.findMany({ orderBy: { id: "asc" } }),
          prisma.userCapability.findMany({ orderBy: { id: "asc" } }),
          prisma.branch.findMany({ orderBy: { id: "asc" } }),
        ]),
      );
    const before = await rows(),
      token = randomUUID(),
      csrf = randomUUID().repeat(2),
      expires = new Date(Date.now() + 3600000);
    const session = await prisma.session.create({
      data: {
        userId: fixture.owner,
        createdAt: new Date(Date.now() - 1000),
        tokenHash: hashToken("session", token),
        csrfTokenHash: hashToken("csrf", csrf),
        expiresAt: expires,
        idleExpiresAt: expires,
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      },
    });
    try {
      const app = createApp({ checkReadiness: async () => undefined }),
        headers = {
          Cookie: `${sessionCookieName}=${token}`,
          Origin: env.FRONTEND_URL[0]!,
          "x-csrf-token": csrf,
        };
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: fixture.adminId } })).role,
      ).toBe("STAFF");
      await request(app)
        .patch(`/api/v1/admin/staff/${fixture.adminId}/role`)
        .set(headers)
        .send({
          role: "STAFF",
          branchId: fixture.secondBranch,
          expectedRevision: "previous-revision",
        })
        .expect(403);
      await request(app)
        .patch(`/api/v1/admin/staff/${fixture.staffId}/role`)
        .set(headers)
        .send({ role: "ADMIN", branchId: fixture.branchId })
        .expect(422);
      expect(await rows()).toBe(before);
    } finally {
      await prisma.session.delete({ where: { id: session.id } });
    }
  },
);
