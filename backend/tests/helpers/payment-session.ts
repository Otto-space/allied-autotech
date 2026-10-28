import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { prisma } from "../../src/config/database.js";
import { sessionWindow } from "./session-window.js";

/** Real session row for isolated direct-service payment tests. */
export async function paymentTestSession(
  userId: string,
  role: AuthenticatedActor["role"] = "CUSTOMER",
): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: randomUUID(),
      ...sessionWindow(3_600_000),
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
    },
    select: { id: true },
  });
  return session.id;
}
