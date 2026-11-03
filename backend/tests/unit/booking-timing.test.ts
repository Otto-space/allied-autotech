import { describe, expect, it } from "vitest";
import { timingWindow } from "../../src/modules/service-operations/booking-timing.js";
describe("explicit occupied appointment interval", () => {
  it("keeps preparation before arrival and cleanup after actual job time", () => {
    const result = timingWindow(new Date("2040-01-02T09:00:00Z"), {
      durationMinutes: 60,
      preparationMinutes: 15,
      cleanupMinutes: 20,
    });
    expect(result.startsAt.toISOString()).toBe("2040-01-02T08:45:00.000Z");
    expect(result.jobEndsAt.toISOString()).toBe("2040-01-02T10:00:00.000Z");
    expect(result.endsAt.toISOString()).toBe("2040-01-02T10:20:00.000Z");
  });
  it("accepts explicitly assessed zero buffers", () => {
    const at = new Date("2040-01-02T09:00:00Z");
    expect(
      timingWindow(at, { durationMinutes: 15, preparationMinutes: 0, cleanupMinutes: 0 })
        .startsAt,
    ).toEqual(at);
  });
  it.each(["durationMinutes", "preparationMinutes", "cleanupMinutes"] as const)(
    "does not convert unknown %s into a guessed interval",
    (field) => {
      expect(() =>
        timingWindow(new Date(), {
          durationMinutes: 60,
          preparationMinutes: 0,
          cleanupMinutes: 0,
          [field]: null,
        }),
      ).toThrow(/Unknown is not zero/);
    },
  );
  it.each([-1, 1.5, NaN, Infinity, 1441])("rejects invalid buffers %s", (value) => {
    expect(() =>
      timingWindow(new Date(), {
        durationMinutes: 60,
        preparationMinutes: value,
        cleanupMinutes: 0,
      }),
    ).toThrow();
  });
  it("rejects an invalid time and too-short job duration", () => {
    expect(() =>
      timingWindow(new Date("invalid"), {
        durationMinutes: 60,
        preparationMinutes: 0,
        cleanupMinutes: 0,
      }),
    ).toThrow();
    expect(() =>
      timingWindow(new Date(), {
        durationMinutes: 0,
        preparationMinutes: 0,
        cleanupMinutes: 0,
      }),
    ).toThrow();
  });
});
