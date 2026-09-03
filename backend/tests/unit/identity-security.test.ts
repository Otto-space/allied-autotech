import { generate } from "otplib";
import { describe, expect, it } from "vitest";

import {
  decryptIdentityPayload,
  decryptTotpSecret,
  encryptIdentityPayload,
  encryptTotpSecret,
} from "../../src/common/security/mfa-encryption.js";
import {
  hashPassword,
  isCommonPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "../../src/common/security/passwords.js";
import { generateRecoveryCodes } from "../../src/common/security/recovery-codes.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { createTotpEnrollment, verifyTotp } from "../../src/common/security/totp.js";

describe("identity security primitives", () => {
  it("stores purpose-separated HMACs instead of raw opaque tokens", () => {
    const raw = generateOpaqueToken();
    const sessionHash = hashToken("session", raw);

    expect(raw).not.toBe(sessionHash);
    expect(sessionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken("csrf", raw)).not.toBe(sessionHash);
  });

  it("hashes passwords with Argon2id and verifies without throwing on bad hashes", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);

    expect(hash).toContain("$argon2id$");
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, "wrong password value")).toBe(false);
    expect(await verifyPassword(undefined, password)).toBe(false);
    expect(passwordNeedsRehash(hash)).toBe(false);
    expect(isCommonPassword("password1234")).toBe(true);
  });

  it("encrypts TOTP secrets and identity payloads with authenticated envelopes", () => {
    const totp = encryptTotpSecret("A-SENSITIVE-TOTP-SECRET");
    const payload = encryptIdentityPayload({
      link: "https://example.test/#token=secret",
    });

    expect(JSON.stringify(totp)).not.toContain("A-SENSITIVE-TOTP-SECRET");
    expect(decryptTotpSecret(totp)).toBe("A-SENSITIVE-TOTP-SECRET");
    expect(decryptIdentityPayload(payload)).toEqual({
      link: "https://example.test/#token=secret",
    });
    expect(() =>
      decryptTotpSecret({ ...totp, tag: Buffer.alloc(16).toString("base64") }),
    ).toThrow();
  });

  it("creates unique recovery codes while exposing only purpose-bound hashes for storage", () => {
    const codes = generateRecoveryCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes.map(({ raw }) => raw)).size).toBe(10);
    for (const code of codes) {
      expect(code.hash).toBe(hashToken("recovery-code", code.raw));
      expect(code.hash).not.toContain(code.raw);
    }
  });

  it("rejects replay of an already accepted TOTP time step", async () => {
    const enrollment = createTotpEnrollment("user@example.test");
    const token = await generate({ secret: enrollment.secret });
    const first = await verifyTotp(enrollment.secret, token);

    expect(first.valid).toBe(true);
    expect(first.usedAt).toBeInstanceOf(Date);
    const replay = await verifyTotp(enrollment.secret, token, first.usedAt);
    expect(replay.valid).toBe(false);
  });
});
