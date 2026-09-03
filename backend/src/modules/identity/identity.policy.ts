import type { UserRole } from "../../generated/prisma/enums.js";

export function identityRequiresMfa(role: UserRole, activeFactorCount: number): boolean {
  return role !== "CUSTOMER" || activeFactorCount > 0;
}

export function mayRemoveFinalMfaFactor(role: UserRole): boolean {
  return role === "CUSTOMER";
}
