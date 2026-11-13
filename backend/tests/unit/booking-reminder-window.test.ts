import { afterEach, expect, it, vi } from "vitest";
import { scheduleReminders } from "../../src/modules/service-operations/service-operations.service.js";
import {
  defaultReminderMinutes,
  reminderMinutesSchema,
  reminderSchedule,
} from "../../src/modules/service-operations/booking-reminder-schedule.js";
const now = Date.parse("2030-05-01T08:00:00Z");
const booking = (minutes: number) => ({
  id: "synthetic-booking",
  scheduledAt: new Date(now + minutes * 60000),
  scheduleVersion: 4,
});
afterEach(() => vi.useRealTimers());
it("skips past and exact-boundary notices while retaining applicable short-notice reminders", () => {
  for (const minutes of [-30, 0, 30])
    expect(reminderSchedule(booking(minutes), defaultReminderMinutes, now)).toEqual([]);
  expect(reminderSchedule(booking(60), defaultReminderMinutes, now)).toEqual([
    {
      bookingId: "synthetic-booking",
      kind: "NOTICE_3",
      scheduleVersion: 4,
      scheduledFor: new Date(now + 30 * 60000),
    },
  ]);
});
it("schedules all three delegated defaults with versioned identities", () => {
  expect(
    reminderSchedule(booking(2880), defaultReminderMinutes, now).map((r) => [
      r.kind,
      (booking(2880).scheduledAt.getTime() - r.scheduledFor.getTime()) / 60000,
    ]),
  ).toEqual([
    ["NOTICE_1", 1440],
    ["NOTICE_2", 120],
    ["NOTICE_3", 30],
  ]);
});
it("supports custom sorted offsets and explicit disabling", () => {
  expect(
    reminderSchedule(booking(180), [5, 90], now).map((r) => r.scheduledFor.getTime()),
  ).toEqual([now + 90 * 60000, now + 175 * 60000]);
  expect(reminderSchedule(booking(180), [], now)).toEqual([]);
});
it.each([[[0]], [[-1]], [[1.5]], [[10081]], [[30, 30]], [[1, 2, 3, 4]]])(
  "rejects invalid settings %j",
  (values) => {
    expect(reminderMinutesSchema.safeParse(values).success).toBe(false);
  },
);
it("reads the saved appointment approval and preserves deduplication", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const findPolicy = vi
    .fn()
    .mockResolvedValue({
      approvalStatus: "APPROVED",
      settings: { reminderMinutes: [90, 5] },
    });
  const tx = {
    booking: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ capacityPolicyVersionId: "saved-policy" }),
    },
    businessPolicyVersion: { findUniqueOrThrow: findPolicy },
    bookingReminder: { createMany },
  } as unknown as Parameters<typeof scheduleReminders>[0];
  await scheduleReminders(tx, booking(180));
  expect(findPolicy).toHaveBeenCalledWith({
    where: { id: "saved-policy" },
    select: { settings: true, approvalStatus: true },
  });
  expect(createMany).toHaveBeenCalledWith({
    data: reminderSchedule(booking(180), [90, 5], now),
    skipDuplicates: true,
  });
});
