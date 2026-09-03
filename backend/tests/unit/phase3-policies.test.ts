import { describe, expect, it } from "vitest";

import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { AppError } from "../../src/common/errors/app-error.js";
import { requireRoles } from "../../src/common/middleware/authorize.js";
import {
  assertCanChangeRole,
  assertCanInvite,
  assertCanManagePrivilegedUser,
} from "../../src/modules/organization/organization.policy.js";
import {
  adminBranchListQuerySchema,
  privilegedInvitationBodySchema,
} from "../../src/modules/organization/organization.schemas.js";

function actor(
  role: AuthenticatedActor["role"],
  userId = "00000000-0000-4000-8000-000000000001",
  mfaVerified = true,
): AuthenticatedActor {
  return {
    userId,
    sessionId: "00000000-0000-4000-8000-000000000002",
    role,
    email: "actor@example.test",
    mfaRequired: role !== "CUSTOMER",
    mfaVerifiedAt: mfaVerified ? new Date() : null,
  };
}

describe("Phase 3 default-deny policy", () => {
  it("allows admins to invite staff but only super-admins to invite admins", () => {
    expect(() => assertCanInvite(actor("ADMIN"), "STAFF")).not.toThrow();
    expect(() => assertCanInvite(actor("ADMIN"), "ADMIN")).toThrow(AppError);
    expect(() => assertCanInvite(actor("SUPER_ADMIN"), "ADMIN")).not.toThrow();
    expect(() => assertCanInvite(actor("SUPER_ADMIN"), "SUPER_ADMIN")).toThrow(AppError);
  });

  it("prevents self-administration and protection bypasses", () => {
    const admin = actor("ADMIN");
    expect(() => assertCanManagePrivilegedUser(admin, admin.userId, "STAFF")).toThrow(
      AppError,
    );
    expect(() =>
      assertCanManagePrivilegedUser(
        admin,
        "00000000-0000-4000-8000-000000000099",
        "ADMIN",
      ),
    ).toThrow(AppError);
    expect(() =>
      assertCanChangeRole(
        actor("SUPER_ADMIN"),
        "00000000-0000-4000-8000-000000000099",
        "STAFF",
        "ADMIN",
      ),
    ).not.toThrow();
    expect(() =>
      assertCanChangeRole(
        actor("ADMIN"),
        "00000000-0000-4000-8000-000000000099",
        "STAFF",
        "ADMIN",
      ),
    ).toThrow(AppError);
  });

  it("requires MFA even if role middleware receives a forged privileged actor", () => {
    const middleware = requireRoles("ADMIN");
    let denial: unknown;
    middleware(
      { actor: actor("ADMIN", undefined, false) } as never,
      {} as never,
      (error?: unknown) => {
        denial = error;
      },
    );
    expect(denial).toBeInstanceOf(AppError);
    expect((denial as AppError).code).toBe("MFA_REQUIRED");
  });

  it("strictly validates invitation role/branch combinations and query booleans", () => {
    expect(
      privilegedInvitationBodySchema.safeParse({
        email: "staff@example.test",
        role: "STAFF",
      }).success,
    ).toBe(false);
    expect(
      privilegedInvitationBodySchema.safeParse({
        email: "admin@example.test",
        role: "ADMIN",
        branchId: "00000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
    expect(adminBranchListQuerySchema.parse({ isActive: "false" }).isActive).toBe(false);
  });
});
