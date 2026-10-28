import { describe, expect, it } from "vitest";
import {
  supportCoverageOpen,
  supportCoverageScheduleSchema,
  supportCoverageUpdateSchema,
  supportLiveAvailabilitySchema,
  supportPresenceHeartbeatSchema,
  supportPresenceUpdateSchema,
} from "../../src/modules/support/support-live.schemas.js";

const window = { day: 1, startMinute: 9 * 60, endMinute: 17 * 60 };
const schedule = { timezone: "Africa/Lagos" as const, windows: [window] };
describe("explicit support coverage and presence contracts", () => {
  it.each([
    ["2026-10-26T07:59:59Z", false],
    ["2026-10-26T08:00:00Z", true],
    ["2026-10-26T15:59:59Z", true],
    ["2026-10-26T16:00:00Z", false],
    ["2026-10-27T09:00:00Z", false],
  ])("uses Lagos days and half-open hours at %s", (at, expected) => {
    expect(supportCoverageOpen(schedule, new Date(at))).toBe(expected);
  });
  it("handles midnight and explicit overnight windows across the week boundary", () => {
    const overnight = supportCoverageScheduleSchema.parse({
      timezone: "Africa/Lagos",
      windows: [
        { day: 6, startMinute: 23 * 60, endMinute: 1440 },
        { day: 0, startMinute: 0, endMinute: 60 },
      ],
    });
    expect(supportCoverageOpen(overnight, new Date("2026-10-31T22:30:00Z"))).toBe(true);
    expect(supportCoverageOpen(overnight, new Date("2026-10-31T23:30:00Z"))).toBe(true);
    expect(supportCoverageOpen(overnight, new Date("2026-11-01T00:00:00Z"))).toBe(false);
  });
  it("permits unsorted adjacent windows without treating them as overlapping", () => {
    expect(
      supportCoverageScheduleSchema.safeParse({
        ...schedule,
        windows: [{ ...window, startMinute: 1020, endMinute: 1080 }, window],
      }).success,
    ).toBe(true);
  });
  it.each([
    [{ ...window, endMinute: 540 }],
    [{ ...window, startMinute: 1380, endMinute: 60 }],
    [window, { ...window, startMinute: 600 }],
    [{ ...window, day: 7 }],
    [{ ...window, startMinute: 540.5 }],
    [{ ...window, endMinute: 1441 }],
  ])("rejects invalid, overnight or overlapping windows %#", (...windows) => {
    expect(
      supportCoverageScheduleSchema.safeParse({ ...schedule, windows }).success,
    ).toBe(false);
  });
  it("requires explicit nonempty support hours before coverage is enabled", () => {
    const value = {
      expectedVersion: 0,
      enabled: true,
      schedule: { ...schedule, windows: [] },
      maxConcurrentPerAgent: 1,
      reason: "Reviewed support schedule",
    };
    expect(supportCoverageUpdateSchema.safeParse(value).success).toBe(false);
    expect(
      supportCoverageUpdateSchema.safeParse({ ...value, enabled: false }).success,
    ).toBe(true);
  });
  it("does not accept workshop schedules, other zones or unknown choices", () => {
    expect(
      supportCoverageScheduleSchema.safeParse({ ...schedule, timezone: "UTC" }).success,
    ).toBe(false);
    expect(
      supportCoverageScheduleSchema.safeParse({ ...schedule, workshopHours: true })
        .success,
    ).toBe(false);
  });
  it("bounds capacity, revisions and heartbeat shape", () => {
    const presence = {
      expectedVersion: 0,
      branchId: "51b2d340-565b-4592-b536-8f249eb81d48",
      available: true,
      capacity: 1,
    };
    expect(supportPresenceUpdateSchema.safeParse(presence).success).toBe(true);
    for (const capacity of [0, 6, 1.5])
      expect(
        supportPresenceUpdateSchema.safeParse({ ...presence, capacity }).success,
      ).toBe(false);
    expect(
      supportPresenceUpdateSchema.safeParse({ ...presence, expectedVersion: 2147483647 })
        .success,
    ).toBe(false);
    expect(supportPresenceHeartbeatSchema.safeParse({ expectedVersion: 0 }).success).toBe(
      false,
    );
    expect(
      supportPresenceHeartbeatSchema.safeParse({ expectedVersion: 1, available: true })
        .success,
    ).toBe(false);
  });
  it("does not advertise an enabled channel, staff identities or fabricated waits", () => {
    const data = {
      branchId: "51b2d340-565b-4592-b536-8f249eb81d48",
      kind: "ENQUIRY",
      state: "available",
      checkedAt: "2026-10-26T09:00:00.000Z",
      channel: "queued_customer_care",
    };
    expect(supportLiveAvailabilitySchema.safeParse(data).success).toBe(true);
    for (const extra of [
      { waitMinutes: 1 },
      { agentName: "Invented agent" },
      { queuePosition: 1 },
    ])
      expect(supportLiveAvailabilitySchema.safeParse({ ...data, ...extra }).success).toBe(
        false,
      );
  });
});
