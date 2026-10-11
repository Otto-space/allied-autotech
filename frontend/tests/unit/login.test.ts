import { describe, it, expect } from "vitest";
import { loginResponse, loginDestination } from "@/lib/auth/login";
const receipt = {
  user: {
    id: "a9000000-0000-4000-8000-000000000001",
    email: "login@example.test",
    role: "CUSTOMER",
  },
  mfaRequired: false,
};
describe("login response boundary", () => {
  it("accepts a customer and an allowed continuation", () =>
    expect(loginDestination(loginResponse.parse(receipt), "/dashboard/cart")).toBe(
      "/dashboard/cart",
    ));
  it.each([
    null,
    {},
    { user: receipt.user },
    { ...receipt, user: { ...receipt.user, id: "fake" } },
    { ...receipt, user: { ...receipt.user, email: "invalid" } },
    { ...receipt, user: { ...receipt.user, role: "ROOT" } },
    { ...receipt, mfaRequired: "false" },
  ])("rejects malformed receipts %#", (value) =>
    expect(() => loginResponse.parse(value)).toThrow(),
  );
  it.each(["STAFF", "ADMIN", "SUPER_ADMIN"])("requires MFA for %s", (role) => {
    expect(() =>
      loginResponse.parse({ ...receipt, user: { ...receipt.user, role } }),
    ).toThrow();
    expect(
      loginDestination(
        loginResponse.parse({
          ...receipt,
          user: { ...receipt.user, role },
          mfaRequired: true,
        }),
        "/admin",
      ),
    ).toBe("/mfa");
  });
  it("routes an enrolled customer to verification", () =>
    expect(
      loginDestination(
        loginResponse.parse({ ...receipt, mfaRequired: true }),
        "/dashboard/cart",
      ),
    ).toBe("/mfa"));
  it.each([
    "https://example.com",
    "//example.com",
    "/admin",
    "/admin/users",
    "/admin?x=1",
    "/admin#x",
    "/login",
    "/\\example.com",
  ])("rejects an unsupported continuation %s", (next) =>
    expect(loginDestination(loginResponse.parse(receipt), next)).toBe("/dashboard"),
  );
});
