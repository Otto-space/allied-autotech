/** Owner decision recorded 9 November 2026. This collection calendar is independent
 * of bank/refund and appointment-capacity calendars. Holidays count; Sunday does not.
 * It calculates a date only. It never releases stock, charges, cancels or refunds. */
// Immutable V1 calculation contract. Future calendar changes need a new version;
// retain this version for already-notified orders instead of recalculating history.
export const collectionHoldPolicy = {
  version: "COLLECTION_HOLD_20261109_V1",
  timeZone: "Africa/Lagos",
  businessDays: 5,
  weekdays: [1, 2, 3, 4, 5, 6],
  excludePublicHolidays: false,
  includeAnchorDay: false,
  appliesTo: ["IN_STOCK", "SOURCED", "IMPORTED", "CUSTOM"],
  provenance: "OWNER_CHAT_20261109",
} as const;

const dayMs = 86_400_000;
const localDate = (at: Date) =>
  new Date(at.getTime() + 3_600_000).toISOString().slice(0, 10);
export function collectionHoldClock(input: {
  readyAt: Date | null;
  /** Actual successful customer notification evidence. Never a queue/attempt time. */
  notifiedAt: Date | null;
  now: Date;
}) {
  for (const at of [input.readyAt, input.notifiedAt, input.now]) {
    if (at !== null && !Number.isFinite(at.getTime()))
      throw new Error("Invalid collection clock timestamp");
  }
  if (
    (input.readyAt && input.readyAt > input.now) ||
    (input.notifiedAt && input.notifiedAt > input.now)
  )
    throw new Error("Collection readiness and notification must be actual past events");
  if (!input.readyAt || !input.notifiedAt)
    return {
      state: "PENDING" as const,
      reason: !input.readyAt
        ? ("READINESS_REQUIRED" as const)
        : ("NOTIFICATION_REQUIRED" as const),
      collectByDate: null,
      policy: collectionHoldPolicy,
    };
  const anchorAt = new Date(
    Math.max(input.readyAt.getTime(), input.notifiedAt.getTime()),
  );
  let cursor = new Date(`${localDate(anchorAt)}T00:00:00Z`),
    counted = 0;
  while (counted < collectionHoldPolicy.businessDays) {
    cursor = new Date(cursor.getTime() + dayMs);
    if (cursor.getUTCDay() !== 0) counted++;
  }
  const collectByDate = cursor.toISOString().slice(0, 10);
  // Date-only boundary avoids inventing an owner-approved hour. The day remains
  // collectible subject to actual workshop hours; overdue begins on the next date.
  return {
    state:
      localDate(input.now) > collectByDate ? ("OVERDUE" as const) : ("HOLDING" as const),
    anchorAt,
    collectByDate,
    policy: collectionHoldPolicy,
  };
}
