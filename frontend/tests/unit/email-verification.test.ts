import { describe, it, expect } from "vitest";
import { verificationFields, resendFields } from "../../lib/auth/email-verification";
describe("email verification contracts", () => {
  it.each([32, 512])("accepts token boundary %s", (n) =>
    expect(verificationFields.safeParse({ token: "x".repeat(n) }).success).toBe(true),
  );
  it.each([0, 31, 513])("rejects token length %s", (n) =>
    expect(verificationFields.safeParse({ token: "x".repeat(n) }).success).toBe(false),
  );
  it("rejects additional token and resend fields", () => {
    expect(
      verificationFields.safeParse({ token: "x".repeat(32), email: "a@example.test" })
        .success,
    ).toBe(false);
    expect(
      resendFields.safeParse({ email: "a@example.test", role: "ADMIN" }).success,
    ).toBe(false);
  });
  it("trims the registration email", () =>
    expect(resendFields.parse({ email: "  User@example.test  " }).email).toBe(
      "User@example.test",
    ));
  it.each(["", "invalid", "a@", "a".repeat(250) + "@example.test"])(
    "rejects invalid email %s",
    (email) => expect(resendFields.safeParse({ email }).success).toBe(false),
  );
});
