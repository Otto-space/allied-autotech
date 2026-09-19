import type { UserRole } from "../../generated/prisma/enums.js";
export type { RequestSecurityContext } from "../../common/contracts/request-security.js";

export interface SessionIssueResult {
  rawToken: string;
  csrfToken: string;
  expiresAt: Date;
  mfaRequired: boolean;
  user: { id: string; email: string; role: UserRole };
}

// Snapshot authenticated and CSRF-validated by middleware, never supplied by the body.
export interface MfaEnrollmentSession {
  sessionId: string;
  csrfTokenHash: string;
}

export interface IdentityEmailPayload {
  template: "verify-email" | "reset-password" | "privileged-invitation";
  to: string;
  link: string;
}
