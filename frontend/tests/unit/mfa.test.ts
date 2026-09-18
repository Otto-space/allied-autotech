import { describe, expect, it } from "vitest";
import {
  authenticationOptionsSchema,
  enrollmentResultSchema,
  mfaSessionSchema,
  totpEnrollmentSchema,
  totpOptionsSchema,
} from "../../lib/api/mfa-schemas";
describe("MFA response boundaries", () => {
  it("rejects an empty factor list instead of inferring enrollment permission", () => {
    expect(
      totpOptionsSchema.safeParse({ method: "totp", available: true, factors: [] })
        .success,
    ).toBe(false);
  });
  it("binds an authenticator setup URI to the returned secret", () => {
    const value = {
      factorId: "a3000000-0000-4000-8000-000000000001",
      secret: "ABCDEFGHIJKLMNOP",
      uri: "otpauth://totp/Allied?secret=ABCDEFGHIJKLMNOP",
    };
    expect(totpEnrollmentSchema.safeParse(value).success).toBe(true);
    expect(
      totpEnrollmentSchema.safeParse({
        ...value,
        uri: "https://evil.test/?secret=ABCDEFGHIJKLMNOP",
      }).success,
    ).toBe(false);
    expect(
      totpEnrollmentSchema.safeParse({
        ...value,
        uri: "otpauth://totp/Allied?secret=WRONG",
      }).success,
    ).toBe(false);
  });
  it("requires both rotated CSRF and unique recovery codes to confirm enrollment", () => {
    const value = {
      csrfToken: "x".repeat(40),
      recoveryCodes: ["first-code", "second-code"],
    };
    expect(enrollmentResultSchema.safeParse(value).success).toBe(true);
    expect(
      enrollmentResultSchema.safeParse({ ...value, recoveryCodes: [] }).success,
    ).toBe(false);
    expect(
      enrollmentResultSchema.safeParse({
        ...value,
        recoveryCodes: ["same-code", "same-code"],
      }).success,
    ).toBe(false);
    expect(
      enrollmentResultSchema.safeParse({ recoveryCodes: value.recoveryCodes }).success,
    ).toBe(false);
  });
  it("rejects malformed and weakened WebAuthn authentication options", () => {
    const value = {
      challenge: "Y2hhbGxlbmdl",
      rpId: "localhost",
      allowCredentials: [{ id: "Y3JlZGVudGlhbA", type: "public-key" }],
      userVerification: "required",
    };
    expect(authenticationOptionsSchema.safeParse(value).success).toBe(true);
    expect(
      authenticationOptionsSchema.safeParse({ ...value, userVerification: "discouraged" })
        .success,
    ).toBe(false);
    expect(
      authenticationOptionsSchema.safeParse({ ...value, challenge: "invalid&" }).success,
    ).toBe(false);
  });
  it("does not accept a partial session as verified", () => {
    expect(
      mfaSessionSchema.safeParse({ user: { role: "ADMIN" }, mfaRequired: false }).success,
    ).toBe(false);
  });
});
