import type { UserRole } from "../../generated/prisma/enums.js";

export interface AuthenticatedActor {
  userId: string;
  sessionId: string;
  role: UserRole;
  email: string;
  mfaRequired: boolean;
  mfaVerifiedAt: Date | null;
}

export interface AuthenticatedSession {
  id: string;
  csrfTokenHash: string | null;
  expiresAt: Date;
  idleExpiresAt: Date;
}
