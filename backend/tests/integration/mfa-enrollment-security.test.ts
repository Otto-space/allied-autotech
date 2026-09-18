import { randomUUID } from "node:crypto";
import { generate } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import { issueCsrfToken } from "../../src/common/security/csrf-tokens.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { createTotpEnrollment } from "../../src/common/security/totp.js";
import {
  encryptTotpSecret,
  serializeEncryptedEnvelope,
} from "../../src/common/security/mfa-encryption.js";
import { IdentityService } from "../../src/modules/identity/identity.service.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { testOwner } from "../helpers/owner.js";
const enabled = process.env.RUN_DATABASE_TESTS === "true";
const origin = "http://localhost:3000";
const app = createApp({ checkReadiness: async () => undefined });
let passwordHash: string;
const password = "isolated MFA security regression passphrase";
async function fixture(role: UserRole = "STAFF", verified = false) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner(passwordHash)
      : await prisma.user.create({
          data: {
            email: `mfa-guard-${randomUUID()}@example.test`,
            passwordHash,
            role,
            emailVerifiedAt: new Date(),
          },
        });
  if (role === "SUPER_ADMIN") {
    // The singleton owner survives between disposable-database runs. Reset only
    // this suite's synthetic factors so each scenario starts in isolation.
    await prisma.mfaFactor.deleteMany({
      where: { userId: user.id, name: "Isolated authenticator" },
    });
  }
  const raw = generateOpaqueToken();
  const csrf = issueCsrfToken();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", raw),
      csrfTokenHash: csrf.hash,
      createdAt: new Date(Date.now() - 2000),
      mfaRequired: true,
      mfaVerifiedAt: verified ? new Date() : null,
      expiresAt: new Date(Date.now() + 600000),
      idleExpiresAt: new Date(Date.now() + 600000),
    },
  });
  return { user, session, csrf, cookie: `aat_session=${raw}` };
}
async function factor(userId: string, active = true) {
  const enrollment = createTotpEnrollment("isolated@example.test");
  const encrypted = encryptTotpSecret(enrollment.secret);
  const record = await prisma.mfaFactor.create({
    data: {
      userId,
      type: "TOTP",
      status: active ? "ACTIVE" : "PENDING",
      name: "Isolated authenticator",
      encryptedSecret: serializeEncryptedEnvelope(encrypted),
      encryptionKeyId: encrypted.keyId,
      verifiedAt: active ? new Date() : null,
    },
  });
  return { ...record, secret: enrollment.secret };
}
function post(
  endpoint: string,
  context: Awaited<ReturnType<typeof fixture>>,
  body: object = {},
) {
  return request(app)
    .post(`/api/v1/auth/mfa/${endpoint}`)
    .set("Origin", origin)
    .set("Cookie", context.cookie)
    .set("X-CSRF-Token", context.csrf.raw)
    .send(body);
}
describe.skipIf(!enabled)("MFA enrollment authorization and atomicity", () => {
  beforeAll(async () => {
    passwordHash = await hashPassword(password);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  it.each(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const)(
    "rejects all enrollment endpoints for a pending %s account with an existing factor",
    async (role) => {
      const context = await fixture(role);
      await factor(context.user.id);
      const pending = await factor(context.user.id, false);
      const bodies = [
        ["totp/setup", {}],
        ["webauthn/options", {}],
        [
          "totp/verify",
          { factorId: pending.id, code: await generate({ secret: pending.secret }) },
        ],
        [
          "webauthn/verify",
          {
            response: {
              id: "isolated",
              rawId: "isolated",
              type: "public-key",
              response: {},
            },
          },
        ],
      ] as const;
      const responses = await Promise.all(
        bodies.map(([endpoint, body]) => post(endpoint, context, body)),
      );
      expect(
        responses.map((response) => [response.status, response.body.error?.code]),
      ).toEqual(bodies.map(() => [403, "MFA_REQUIRED"]));
      expect(await prisma.mfaFactor.count({ where: { userId: context.user.id } })).toBe(
        2,
      );
      expect(
        await prisma.mfaRecoveryCode.count({ where: { userId: context.user.id } }),
      ).toBe(0);
      expect(
        (await prisma.session.findUniqueOrThrow({ where: { id: context.session.id } }))
          .mfaVerifiedAt,
      ).toBeNull();
    },
  );
  it("blocks bootstrap when the only existing factor is a security key", async () => {
    const context = await fixture();
    await prisma.mfaFactor.create({
      data: {
        userId: context.user.id,
        type: "WEBAUTHN",
        status: "ACTIVE",
        credentialId: randomUUID(),
        publicKey: new Uint8Array([1]),
        verifiedAt: new Date(),
      },
    });
    expect((await post("totp/setup", context)).body.error.code).toBe("MFA_REQUIRED");
    expect((await post("webauthn/options", context)).body.error.code).toBe(
      "MFA_REQUIRED",
    );
  });
  it("requires an unused recovery code before bootstrap when no active factor remains", async () => {
    const context = await fixture();
    await prisma.mfaRecoveryCode.create({
      data: {
        userId: context.user.id,
        codeHash: hashToken("recovery-code", randomUUID()),
      },
    });
    const denied = await post("totp/setup", context);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("MFA_REQUIRED");
  });
  it("keeps first-factor enrollment and cookie rotation available for a new privileged account", async () => {
    const context = await fixture();
    const options = await post("webauthn/options", context);
    expect(options.status).toBe(200);
    const setup = await post("totp/setup", context);
    expect(setup.status).toBe(201);
    const response = await post("totp/verify", context, {
      factorId: setup.body.data.factorId,
      code: await generate({ secret: setup.body.data.secret as string }),
    });
    expect(response.status).toBe(200);
    expect(response.body.data.recoveryCodes).toHaveLength(10);
    const cookie = response.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain(context.cookie);
    expect(
      (await request(app).get("/api/v1/auth/session").set("Cookie", context.cookie))
        .status,
    ).toBe(401);
    const current = await request(app).get("/api/v1/auth/session").set("Cookie", cookie);
    expect(current.status).toBe(200);
    expect(current.body.data.mfaVerifiedAt).not.toBeNull();
  });
  it("allows a verified account to add a factor and atomically replaces its previous recovery codes", async () => {
    const context = await fixture("CUSTOMER", true);
    await factor(context.user.id);
    const old = await prisma.mfaRecoveryCode.create({
      data: {
        userId: context.user.id,
        codeHash: hashToken("recovery-code", randomUUID()),
      },
    });
    const setup = await post("totp/setup", context);
    expect(setup.status).toBe(201);
    const response = await post("totp/verify", context, {
      factorId: setup.body.data.factorId,
      code: await generate({ secret: setup.body.data.secret as string }),
    });
    expect(response.status).toBe(200);
    expect(
      await prisma.mfaFactor.count({
        where: { userId: context.user.id, status: "ACTIVE" },
      }),
    ).toBe(2);
    expect(await prisma.mfaRecoveryCode.findUnique({ where: { id: old.id } })).toBeNull();
    const stored = await prisma.mfaRecoveryCode.findMany({
      where: { userId: context.user.id },
      select: { codeHash: true },
    });
    expect(stored.map((value) => value.codeHash).sort()).toEqual(
      (response.body.data.recoveryCodes as string[])
        .map((code) => hashToken("recovery-code", code))
        .sort(),
    );
  });
  it("serializes two first-factor activations so exactly one pending session gains MFA", async () => {
    const context = await fixture();
    const first = await factor(context.user.id, false);
    const second = await factor(context.user.id, false);
    const csrf = issueCsrfToken();
    const secondSession = await prisma.session.create({
      data: {
        userId: context.user.id,
        tokenHash: hashToken("session", generateOpaqueToken()),
        csrfTokenHash: csrf.hash,
        mfaRequired: true,
        expiresAt: new Date(Date.now() + 600000),
        idleExpiresAt: new Date(Date.now() + 600000),
      },
    });
    const service = new IdentityService();
    const results = await Promise.allSettled([
      service.verifyTotpSetup(
        context.user.id,
        { sessionId: context.session.id, csrfTokenHash: context.csrf.hash },
        first.id,
        await generate({ secret: first.secret }),
      ),
      service.verifyTotpSetup(
        context.user.id,
        { sessionId: secondSession.id, csrfTokenHash: csrf.hash },
        second.id,
        await generate({ secret: second.secret }),
      ),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      status: "rejected",
      reason: { code: "MFA_REQUIRED" },
    });
    expect(
      await prisma.mfaFactor.count({
        where: { userId: context.user.id, status: "ACTIVE" },
      }),
    ).toBe(1);
    expect(
      await prisma.mfaRecoveryCode.count({ where: { userId: context.user.id } }),
    ).toBe(10);
    expect(
      await prisma.session.count({
        where: { userId: context.user.id, mfaVerifiedAt: { not: null } },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { userId: context.user.id, action: "MFA_ENABLED" },
      }),
    ).toBe(1);
  });
  it("rejects an old middleware snapshot after another request upgrades or rotates that session", async () => {
    const context = await fixture();
    const pending = await factor(context.user.id, false);
    await prisma.session.update({
      where: { id: context.session.id },
      data: { mfaVerifiedAt: new Date(), csrfTokenHash: issueCsrfToken().hash },
    });
    await expect(
      new IdentityService().verifyTotpSetup(
        context.user.id,
        { sessionId: context.session.id, csrfTokenHash: context.csrf.hash },
        pending.id,
        await generate({ secret: pending.secret }),
      ),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
    expect(
      (await prisma.mfaFactor.findUniqueOrThrow({ where: { id: pending.id } })).status,
    ).toBe("PENDING");
  });
  it.each(["revoked", "expired", "suspended"] as const)(
    "rejects a %s account/session after middleware before enrollment",
    async (kind) => {
      const context = await fixture("STAFF", true);
      if (kind === "suspended")
        await prisma.user.update({
          where: { id: context.user.id },
          data: { status: "SUSPENDED" },
        });
      else
        await prisma.session.update({
          where: { id: context.session.id },
          data:
            kind === "revoked"
              ? { revokedAt: new Date() }
              : { idleExpiresAt: new Date(Date.now() - 1000) },
        });
      await expect(
        new IdentityService().setupTotp(context.user.id, {
          sessionId: context.session.id,
          csrfTokenHash: context.csrf.hash,
        }),
      ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
      expect(await prisma.mfaFactor.count({ where: { userId: context.user.id } })).toBe(
        0,
      );
    },
  );
  it("concurrent privileged removals retain one active factor and one audit event", async () => {
    const context = await fixture("STAFF", true);
    const first = await factor(context.user.id);
    const second = await factor(context.user.id);
    const service = new IdentityService();
    const results = await Promise.allSettled([
      service.deleteFactor(context.user.id, first.id, password),
      service.deleteFactor(context.user.id, second.id, password),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "CONFLICT" },
    });
    expect(
      await prisma.mfaFactor.count({
        where: { userId: context.user.id, status: "ACTIVE" },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { userId: context.user.id, action: "MFA_DISABLED" },
      }),
    ).toBe(1);
  });
  it("concurrent recovery replacements leave exactly one complete returned set", async () => {
    const context = await fixture("STAFF", true);
    const service = new IdentityService();
    const sets = await Promise.all([
      service.regenerateRecoveryCodes(context.user.id),
      service.regenerateRecoveryCodes(context.user.id),
    ]);
    const stored = (
      await prisma.mfaRecoveryCode.findMany({
        where: { userId: context.user.id },
        select: { codeHash: true },
      })
    )
      .map((value) => value.codeHash)
      .sort();
    expect(stored).toHaveLength(10);
    expect(
      sets.filter(
        (codes) =>
          JSON.stringify(codes.map((code) => hashToken("recovery-code", code)).sort()) ===
          JSON.stringify(stored),
      ),
    ).toHaveLength(1);
  });
  it("rolls back factor activation, code replacement and audit when session rotation fails", async () => {
    const context = await fixture("CUSTOMER", true);
    const pending = await factor(context.user.id, false);
    const old = await prisma.mfaRecoveryCode.create({
      data: {
        userId: context.user.id,
        codeHash: hashToken("recovery-code", randomUUID()),
      },
    });
    const failing = prisma.$extends({
      query: {
        session: {
          async updateMany({ args, query }) {
            if (args.where?.id === context.session.id && args.data.mfaVerifiedAt)
              throw new Error("isolated rotation fault");
            return query(args);
          },
        },
      },
    });
    const service = new IdentityService(failing as unknown as PrismaClient);
    await expect(
      service.verifyTotpSetup(
        context.user.id,
        { sessionId: context.session.id, csrfTokenHash: context.csrf.hash },
        pending.id,
        await generate({ secret: pending.secret }),
      ),
    ).rejects.toThrow("isolated rotation fault");
    expect(
      (await prisma.mfaFactor.findUniqueOrThrow({ where: { id: pending.id } })).status,
    ).toBe("PENDING");
    expect(
      await prisma.mfaRecoveryCode.count({ where: { userId: context.user.id } }),
    ).toBe(1);
    expect(
      await prisma.mfaRecoveryCode.findUnique({ where: { id: old.id } }),
    ).not.toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { userId: context.user.id, action: "MFA_ENABLED" },
      }),
    ).toBe(0);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: context.session.id } }))
        .csrfTokenHash,
    ).toBe(context.csrf.hash);
  });
  it("requires current MFA even when an older customer session still says MFA is optional", async () => {
    const context = await fixture("CUSTOMER");
    await prisma.session.update({
      where: { id: context.session.id },
      data: { mfaRequired: false },
    });
    await factor(context.user.id);
    const response = await post("totp/setup", context);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MFA_REQUIRED");
    expect(await prisma.mfaFactor.count({ where: { userId: context.user.id } })).toBe(1);
  });
});
