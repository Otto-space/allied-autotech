import { describe, it, expect } from "vitest";
import { recoveryTokenFromFragment, resetFields } from "../../lib/auth/password-reset";
const token = "reset-token-".repeat(5);
describe("reset token and credentials", () => {
  it("reads one encoded fragment token without trimming it", () => {
    expect(recoveryTokenFromFragment(`#token=${encodeURIComponent(token)}`)).toBe(token);
  });
  it.each([
    "",
    "#token=short",
    `#token=${"a".repeat(513)}`,
    `#token=${token}&token=${token}`,
    "#email=private@example.test",
    "#" + "a".repeat(4097),
  ])("rejects unusable fragments", (value) => {
    expect(recoveryTokenFromFragment(value)).toBe("");
  });
  it.each([32, 512])("accepts the backend token boundary %s", (n) => {
    expect(recoveryTokenFromFragment("#token=" + "a".repeat(n))).toHaveLength(n);
  });
  it.each([11, 129])("rejects password length %s", (n) => {
    expect(resetFields.safeParse({ token, password: "a".repeat(n) }).success).toBe(false);
  });
  it.each([12, 128])("accepts password boundary %s", (n) => {
    expect(resetFields.safeParse({ token, password: "a".repeat(n) }).success).toBe(true);
  });
  it("preserves password spaces and excludes additional fields", () => {
    expect(resetFields.parse({ token, password: "  unique password  " }).password).toBe(
      "  unique password  ",
    );
    expect(
      resetFields.safeParse({ token, password: "unique password", role: "ADMIN" })
        .success,
    ).toBe(false);
  });
});
