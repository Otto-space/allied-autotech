import { z } from "zod";
import { supportReplyKeySchema } from "./support.schemas.js";

export const supportCoverageWindowSchema = z
  .strictObject({
    day: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((window) => window.endMinute > window.startMinute, {
    message: "End must follow start; split overnight coverage across two days.",
  });
export const supportCoverageScheduleSchema = z
  .strictObject({
    timezone: z.literal("Africa/Lagos"),
    windows: z.array(supportCoverageWindowSchema).max(28),
  })
  .superRefine((schedule, context) => {
    const windows = [...schedule.windows].sort(
      (a, b) => a.day - b.day || a.startMinute - b.startMinute,
    );
    for (let i = 1; i < windows.length; i++) {
      const previous = windows[i - 1]!,
        current = windows[i]!;
      if (previous.day === current.day && previous.endMinute > current.startMinute)
        context.addIssue({
          code: "custom",
          path: ["windows"],
          message: "Coverage windows must not overlap.",
        });
    }
  });
export type SupportCoverageSchedule = z.infer<typeof supportCoverageScheduleSchema>;
export const supportCoverageUpdateSchema = z
  .strictObject({
    expectedVersion: z.number().int().min(0).max(2147483646),
    enabled: z.boolean(),
    schedule: supportCoverageScheduleSchema,
    maxConcurrentPerAgent: z.number().int().min(1).max(5),
    reason: z.string().trim().min(5).max(500),
  })
  .refine((input) => !input.enabled || input.schedule.windows.length > 0, {
    message: "Enabled support coverage requires explicit support hours.",
    path: ["schedule"],
  });
export const supportPresenceUpdateSchema = z.strictObject({
  expectedVersion: z.number().int().min(0).max(2147483646),
  branchId: z.uuid(),
  available: z.boolean(),
  capacity: z.number().int().min(1).max(5),
});
export const supportPresenceHeartbeatSchema = z.strictObject({
  expectedVersion: z.number().int().min(1).max(2147483646),
});
export const supportLiveBranchSchema = z.strictObject({ branchId: z.uuid() });
export const supportLiveAvailabilityQuerySchema = z.strictObject({
  kind: z.enum(["ENQUIRY", "COMPLAINT"]).default("ENQUIRY"),
});
export const supportLiveAvailabilitySchema = z.strictObject({
  branchId: z.uuid(),
  kind: z.enum(["ENQUIRY", "COMPLAINT"]),
  state: z.enum(["disabled", "after_hours", "unavailable", "available"]),
  checkedAt: z.iso.datetime(),
  // There is no wait-time promise, queue position or agent identity in this projection.
  channel: z.literal("queued_customer_care"),
});
export const supportCoverageSchema = z.strictObject({
  branchId: z.uuid(),
  enabled: z.boolean(),
  schedule: supportCoverageScheduleSchema,
  maxConcurrentPerAgent: z.number().int().min(1).max(5),
  version: z.number().int().nonnegative(),
});
export const supportCoverageOperationParamsSchema = z.strictObject({
  branchId: z.uuid(),
  key: supportReplyKeySchema,
});
export const supportCoverageRecoverySchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("UNKNOWN"), coverage: supportCoverageSchema }),
  z.strictObject({ state: z.literal("CANCELLED"), coverage: supportCoverageSchema }),
  z.strictObject({
    state: z.literal("SAVED"),
    savedVersion: z.number().int().positive(),
    coverage: supportCoverageSchema,
  }),
]);
export const supportPresenceSchema = z.strictObject({
  enabled: z.boolean(),
  version: z.number().int().nonnegative(),
  branchId: z.uuid().nullable(),
  optedIn: z.boolean(),
  expiresAt: z.iso.datetime().nullable(),
  capacity: z.number().int().min(1).max(5),
  eligibleBranches: z.array(
    z.strictObject({
      branchId: z.uuid(),
      kinds: z.array(z.enum(["ENQUIRY", "COMPLAINT"])),
    }),
  ),
});

const lagosClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** Half-open support windows, independent of workshop/business hours. */
export function supportCoverageOpen(schedule: SupportCoverageSchedule, now: Date) {
  const parts = lagosClock.formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    part("weekday") ?? "",
  );
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  return schedule.windows.some(
    (w) => w.day === day && w.startMinute <= minute && minute < w.endMinute,
  );
}
