import { z } from "zod";

const windowSchema = z
  .strictObject({
    day: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine(
    (window) => window.endMinute > window.startMinute,
    "End must follow start; split overnight coverage across two days.",
  );
export const careCoverageScheduleSchema = z
  .strictObject({
    timezone: z.literal("Africa/Lagos"),
    windows: z.array(windowSchema).max(28),
  })
  .superRefine((schedule, context) => {
    const sorted = orderedCoverageWindows(schedule.windows);
    for (let i = 1; i < sorted.length; i++) {
      if (
        sorted[i - 1].day === sorted[i].day &&
        sorted[i - 1].endMinute > sorted[i].startMinute
      )
        context.addIssue({
          code: "custom",
          path: ["windows"],
          message: "Support windows on the same day must not overlap.",
        });
    }
  });
export function orderedCoverageWindows<
  T extends { day: number; startMinute: number; endMinute: number },
>(windows: T[]) {
  return [...windows].sort(
    (a, b) => a.day - b.day || a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  );
}
export const careCoverageSchema = z.strictObject({
  branchId: z.uuid(),
  enabled: z.boolean(),
  schedule: careCoverageScheduleSchema,
  maxConcurrentPerAgent: z.number().int().min(1).max(5),
  version: z.number().int().nonnegative(),
});
export const careCoverageBodySchema = z
  .strictObject({
    expectedVersion: z.number().int().min(0).max(2147483646),
    enabled: z.boolean(),
    schedule: careCoverageScheduleSchema,
    maxConcurrentPerAgent: z.number().int().min(1).max(5),
    reason: z.string().trim().min(5).max(500),
  })
  .refine((body) => !body.enabled || body.schedule.windows.length > 0, {
    path: ["schedule"],
    message: "Enabled coverage requires explicit support hours.",
  });
export const careCoverageRecoverySchema = z
  .discriminatedUnion("state", [
    z.strictObject({ state: z.literal("UNKNOWN"), coverage: careCoverageSchema }),
    z.strictObject({ state: z.literal("CANCELLED"), coverage: careCoverageSchema }),
    z.strictObject({
      state: z.literal("SAVED"),
      savedVersion: z.number().int().positive(),
      coverage: careCoverageSchema,
    }),
  ])
  .refine(
    (value) => value.state !== "SAVED" || value.savedVersion <= value.coverage.version,
    "Invalid saved coverage revision.",
  );
export type CareCoverage = z.infer<typeof careCoverageSchema>;
export type CareCoverageBody = z.infer<typeof careCoverageBodySchema>;
export const coverageDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export const coverageTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export type CoverageDraft = {
  base: CareCoverage;
  enabled: boolean;
  capacity: string;
  reason: string;
  windows: { key: string; day: string; start: string; end: string }[];
};
export function newCoverageDraft(base: CareCoverage): CoverageDraft {
  return {
    base,
    enabled: base.enabled,
    capacity: String(base.maxConcurrentPerAgent),
    reason: "",
    windows: orderedCoverageWindows(base.schedule.windows).map((window) => ({
      key: crypto.randomUUID(),
      day: String(window.day),
      start: coverageTime(window.startMinute),
      end: coverageTime(window.endMinute),
    })),
  };
}
export function coverageDraftBody(draft: CoverageDraft): CareCoverageBody {
  if (!/^[1-5]$/.test(draft.capacity))
    throw Error(
      "Choose a maximum between one and five conversations per representative.",
    );
  const minute = (value: string, end: boolean, row: number) => {
    if (end && value.trim() === "24:00") return 1440;
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.trim()))
      throw Error(
        `Window ${row}: use HH:mm in 24-hour time. Only an end time may be 24:00.`,
      );
    const [hours, minutes] = value.trim().split(":").map(Number);
    return hours * 60 + minutes;
  };
  const windows = draft.windows.map((window, i) => {
    if (!/^[0-6]$/.test(window.day))
      throw Error(`Window ${i + 1}: choose a support day.`);
    return {
      day: Number(window.day),
      startMinute: minute(window.start, false, i + 1),
      endMinute: minute(window.end, true, i + 1),
    };
  });
  const parsed = careCoverageBodySchema.safeParse({
    expectedVersion: draft.base.version,
    enabled: draft.enabled,
    maxConcurrentPerAgent: Number(draft.capacity),
    reason: draft.reason,
    schedule: { timezone: "Africa/Lagos", windows: orderedCoverageWindows(windows) },
  });
  if (!parsed.success)
    throw Error(parsed.error.issues[0]?.message ?? "Check the support coverage fields.");
  return parsed.data;
}
export function assertCoverageTarget(value: unknown, branchId: string) {
  const record = careCoverageSchema.parse(value);
  if (record.branchId !== branchId)
    throw Error("The coverage response belongs to another branch.");
  return record;
}
export function coverageMatches(record: CareCoverage, body: CareCoverageBody) {
  return (
    record.enabled === body.enabled &&
    record.maxConcurrentPerAgent === body.maxConcurrentPerAgent &&
    JSON.stringify(orderedCoverageWindows(record.schedule.windows)) ===
      JSON.stringify(orderedCoverageWindows(body.schedule.windows))
  );
}
