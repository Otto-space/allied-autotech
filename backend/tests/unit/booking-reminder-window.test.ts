import { afterEach, expect, it, vi } from "vitest";
import { scheduleReminders } from "../../src/modules/service-operations/service-operations.service.js";
afterEach(() => vi.useRealTimers());
it("does not turn already missed reminders into immediate catch-up notifications", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-05-01T08:00:00Z"));
  const createMany = vi.fn();
  const tx = { bookingReminder: { createMany } } as unknown as Parameters<
    typeof scheduleReminders
  >[0];
  for (const minutes of [-30, 0, 30, 60])
    await scheduleReminders(tx, {
      id: "synthetic-booking",
      scheduledAt: new Date(Date.now() + minutes * 60000),
      scheduleVersion: 4,
    });
  expect(createMany).not.toHaveBeenCalled();
});
it("retains the existing future one-hour schedule and versioned deduplication", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-05-01T08:00:00Z"));
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  await scheduleReminders(
    { bookingReminder: { createMany } } as unknown as Parameters<
      typeof scheduleReminders
    >[0],
    {
      id: "synthetic-booking",
      scheduledAt: new Date("2030-05-01T10:00:00Z"),
      scheduleVersion: 4,
    },
  );
  expect(createMany).toHaveBeenCalledWith({
    data: [
      {
        bookingId: "synthetic-booking",
        kind: "ONE_HOUR",
        scheduledFor: new Date("2030-05-01T09:00:00Z"),
        scheduleVersion: 4,
      },
    ],
    skipDuplicates: true,
  });
});
