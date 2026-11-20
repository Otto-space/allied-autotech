import { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { Prisma } from "../../generated/prisma/client.js";

export const recordedWorkforceChanges = [
  "ENROLL_OR_UPDATE_POSITION",
  "ASSIGN",
  "REVOKE",
  "DELEGATION",
] as const;

/** A bounded subset of existing audit authority; reads/previews and unrelated
 * customer/security/financial activity remain in the full audit log. */
export function accessHistoryWhere(): Prisma.AuditLogWhereInput {
  return {
    OR: [
      {
        entityType: "USER",
        action: "UPDATE",
        OR: recordedWorkforceChanges.map((value) => ({
          newValues: { path: ["workforceAction"], equals: value },
        })),
      },
      { entityType: "USER", action: "ROLE_CHANGE" },
      { entityType: "STAFF_PROFILE", action: "BRANCH_ASSIGNED" },
      {
        entityType: "PRIVILEGED_INVITATION",
        OR: [
          { action: { in: ["INVITATION_CREATED", "INVITATION_ACCEPTED"] } },
          { action: "UPDATE", newValues: { path: ["revoked"], equals: true } },
        ],
      },
    ],
  };
}

type RecordedEvent = {
  id: string;
  userId: string | null;
  entityType: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
};

function recordedBranchIds(row: RecordedEvent) {
  return [
    ...new Set(
      [row.oldValues, row.newValues]
        .flatMap((input) => {
          const value =
            input !== null && typeof input === "object" && !Array.isArray(input)
              ? (input as Record<string, unknown>)
              : {};
          return [
            value["branchId"],
            ...(typeof value["branchIds"] === "string"
              ? value["branchIds"].split(",").slice(0, 20)
              : []),
          ];
        })
        .filter(
          (value): value is string =>
            typeof value === "string" && z.uuid().safeParse(value).success,
        ),
    ),
  ];
}

/** Names describe current staff records, never identities at event time. Resolve
 * only IDs on this already-authorized page. Customer profiles/contacts are never
 * selected. Recipient resolution retains the invitation service's own/all rule. */
export async function currentAccessHistoryContext<T extends RecordedEvent>(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  rows: T[],
) {
  const uuid = (value: string | null) => z.uuid().safeParse(value).success;
  const invitationIds = rows
    .filter((row) => row.entityType === "PRIVILEGED_INVITATION" && uuid(row.entityId))
    .map((row) => row.entityId!);
  const invitations = invitationIds.length
    ? await tx.privilegedInvitation.findMany({
        where: {
          id: { in: invitationIds },
          ...(actor.role === "ADMIN" ? { invitedById: actor.userId } : {}),
        },
        select: { id: true, recipientId: true },
      })
    : [];
  const recipients = new Map(invitations.map((row) => [row.id, row.recipientId]));
  const subjectId = (row: RecordedEvent) =>
    row.entityType === "PRIVILEGED_INVITATION"
      ? (recipients.get(row.entityId ?? "") ?? null)
      : ["USER", "STAFF_PROFILE"].includes(row.entityType)
        ? row.entityId
        : null;
  const ids = [
    ...new Set(
      rows
        .flatMap((row) => [row.userId, subjectId(row)])
        .filter((value): value is string => value !== null && uuid(value)),
    ),
  ];
  const people = ids.length
    ? await tx.user.findMany({
        where: {
          role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
          OR: [{ id: { in: ids } }, { staffProfile: { is: { id: { in: ids } } } }],
        },
        select: {
          id: true,
          role: true,
          staffProfile: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    : [];
  const branchIds = [...new Set(rows.flatMap(recordedBranchIds))];
  const branches = branchIds.length
    ? await tx.branch.findMany({
        where: { id: { in: branchIds } },
        select: { id: true, name: true },
      })
    : [];
  const branchNames = new Map(branches.map((branch) => [branch.id, branch]));
  const names = new Map<
    string,
    { id: string; name: string | null; role: "STAFF" | "ADMIN" | "SUPER_ADMIN" }
  >();
  const profileNames = new Map<
    string,
    { id: string; name: string | null; role: "STAFF" | "ADMIN" | "SUPER_ADMIN" }
  >();
  for (const person of people) {
    if (person.role === "CUSTOMER") continue;
    const entry = {
      id: person.id,
      name:
        [person.staffProfile?.firstName, person.staffProfile?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() || null,
      role: person.role,
    };
    names.set(person.id, entry);
    if (person.staffProfile) profileNames.set(person.staffProfile.id, entry);
  }
  return rows.map((row) => ({
    ...row,
    currentContext: {
      actor: names.get(row.userId ?? "") ?? null,
      subject:
        (row.entityType === "STAFF_PROFILE" ? profileNames : names).get(
          subjectId(row) ?? "",
        ) ?? null,
      branches: recordedBranchIds(row).flatMap((id) =>
        branchNames.has(id) ? [branchNames.get(id)!] : [],
      ),
    },
  }));
}
