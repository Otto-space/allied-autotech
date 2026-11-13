// Only these recorded support-email outcomes may leave the private queue record.
// Never return raw errors or infer suppression from an attempt count.
export const supportDeliverySuppressionReasons = [
  "CHANNEL_DISABLED",
  "CONSENT_WITHDRAWN",
  "NO_RECIPIENT",
  "SUPPORT_REPLY_ADDRESS_MISSING",
] as const;

export function jobDeliveryDiagnostic(row: {
  eventType: string;
  aggregateType: string;
  status: string;
  lastError: string | null;
}) {
  if (
    row.eventType !== "support.customer-email.requested" ||
    row.aggregateType !== "SupportCustomerEmail" ||
    !["FAILED", "DEAD_LETTER"].includes(row.status)
  )
    return null;
  return (
    supportDeliverySuppressionReasons.find((reason) => reason === row.lastError) ?? null
  );
}

// Kept inside the atomic update predicate so a concurrent suppression cannot be
// cleared by an operator who inspected the job before its delivery state changed.
export const unsuppressedJobPredicate = {
  OR: [
    { lastError: null },
    {
      NOT: {
        eventType: "support.customer-email.requested",
        aggregateType: "SupportCustomerEmail",
        lastError: { in: [...supportDeliverySuppressionReasons] },
      },
    },
  ],
};
