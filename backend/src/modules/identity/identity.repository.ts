import type { PrismaClient } from "../../generated/prisma/client.js";

export class IdentityRepository {
  constructor(private readonly database: PrismaClient) {}

  findUserForAuthentication(email: string) {
    return this.database.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        mfaFactors: {
          where: { status: "ACTIVE", revokedAt: null },
          select: { id: true },
        },
      },
    });
  }

  findUserPassword(userId: string) {
    return this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, role: true, email: true },
    });
  }
}
