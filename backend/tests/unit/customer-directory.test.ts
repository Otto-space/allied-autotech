import { describe, expect, it } from "vitest";
import { directoryListQuerySchema } from "../../src/modules/customers/customer-directory.schemas.js";
import { decodeDirectoryCursor } from "../../src/modules/customers/customer-directory.repository.js";
import { assertDirectoryAdministrator } from "../../src/modules/customers/customer-directory.service.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";

describe("customer directory validation", () => {
  it("normalizes whitespace and casing without expanding search scope", () => {
    expect(directoryListQuerySchema.parse({ search: "  ADA   Okafor  " }).search).toBe(
      "ada okafor",
    );
    expect(directoryListQuerySchema.parse({}).limit).toBe(25);
    expect(directoryListQuerySchema.safeParse({ field: "passwordHash" }).success).toBe(
      false,
    );
    expect(directoryListQuerySchema.safeParse({ search: "ab\u0000c" }).success).toBe(
      false,
    );
  });
  it("rejects malformed and wrong-version cursors", () => {
    for (const cursor of ["bad", Buffer.from('{"v":2}').toString("base64url")])
      expect(() =>
        decodeDirectoryCursor(directoryListQuerySchema.parse({ cursor })),
      ).toThrow("Invalid cursor");
  });
  it.each(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const)(
    "enforces MFA at the service boundary for %s",
    (role) => {
      const actor: AuthenticatedActor = {
        role,
        userId: "test",
        sessionId: "test",
        email: "test@example.test",
        mfaRequired: true,
        mfaVerifiedAt: null,
      };
      expect(() => assertDirectoryAdministrator(actor)).toThrow();
      if (role === "ADMIN" || role === "SUPER_ADMIN")
        expect(() =>
          assertDirectoryAdministrator({ ...actor, mfaVerifiedAt: new Date() }),
        ).not.toThrow();
    },
  );
});
