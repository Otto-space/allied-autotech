import type { Prisma } from "../../generated/prisma/client.js";
import type { z } from "zod";
import type { workforceReviewKindSchema } from "./workforce.schemas.js";

export function workforceReview(
  kind: z.infer<typeof workforceReviewKindSchema>,
  permitted: Prisma.WorkforceAssignmentWhereInput,
  active: Prisma.WorkforceAssignmentWhereInput,
  now: Date,
  days = 7,
): {
  people: Prisma.UserWhereInput;
  assignments?: Prisma.WorkforceAssignmentWhereInput;
  windowEndsAt?: string;
} {
  if (kind === "EARLIER_STAFF_SETUP")
    return { people: { role: "STAFF", workforceAccess: { is: null } } };
  if (kind === "UNASSIGNED")
    return {
      people: {
        role: "STAFF",
        status: "ACTIVE",
        emailVerifiedAt: { not: null },
        workforceAccess: { is: { assignments: { none: active } } },
      },
    };
  const windowEnd = new Date(now.getTime() + days * 86_400_000);
  const state: Prisma.WorkforceAssignmentWhereInput =
    kind === "COVER_ENDING"
      ? {
          temporary: true,
          revokedAt: null,
          startsAt: { lte: now },
          expiresAt: { gt: now, lte: windowEnd },
          branch: { isActive: true },
        }
      : kind === "OPEN_ENDED_COVER"
        ? { temporary: true, revokedAt: null, expiresAt: null }
        : kind === "SCHEDULED"
          ? { revokedAt: null, startsAt: { gt: now } }
          : kind === "ENDED"
            ? { revokedAt: null, expiresAt: { lte: now } }
            : { revokedAt: { not: null } };
  const assignments = { AND: [permitted, state] };
  return {
    people: {
      ...(kind === "COVER_ENDING"
        ? { status: "ACTIVE", emailVerifiedAt: { not: null } }
        : {}),
      workforceAccess: { is: { assignments: { some: assignments } } },
    },
    assignments,
    ...(kind === "COVER_ENDING" ? { windowEndsAt: windowEnd.toISOString() } : {}),
  };
}
