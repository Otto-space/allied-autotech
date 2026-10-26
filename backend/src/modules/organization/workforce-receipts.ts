const accessFields = [
  "userId",
  "position",
  "enabledAt",
  "updatedByUserId",
  "version",
  "delegatedTemplates",
  "delegatedBranchIds",
] as const;
const assignmentFields = [
  "id",
  "userId",
  "template",
  "branchId",
  "scope",
  "temporary",
  "startsAt",
  "expiresAt",
  "reason",
  "assignedByUserId",
  "createdAt",
  "revokedAt",
  "revokedByUserId",
  "revocationReason",
] as const;

/** Old clients strictly validate successful mutation receipts. Preserve their
 * published shape; new clients explicitly opt in to pinned-definition metadata.
 * This projection never changes authorization, persistence or concurrency checks.
 */
export function projectWorkforceMutationReceipt(
  action: string,
  value: unknown,
  receiptVersion: unknown,
): unknown {
  const access = action === "enroll" || action === "delegate";
  if (!access && action !== "assign" && action !== "revoke") return value;
  if (value === null || typeof value !== "object")
    throw Error("Invalid workforce mutation receipt");
  const record = value as Record<string, unknown>;
  const fields: readonly string[] = [
    ...(access ? accessFields : assignmentFields),
    ...(receiptVersion === 2
      ? [access ? "delegationPolicyVersion" : "templateVersion"]
      : []),
  ];
  return Object.fromEntries(
    fields.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]),
  );
}
