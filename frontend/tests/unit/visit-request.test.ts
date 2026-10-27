import { describe, expect, it } from "vitest";
import { visitRequestMessage } from "@/lib/support/visit-request";

const now = new Date("2026-10-22T12:00:00Z");
const base = {
  requested: true,
  type: "SERVICE",
  date: "2026-10-23",
  time: "09:30",
  message: "Please change my tyres.",
};
describe("request-only service and inspection preferences", () => {
  it.each(["SERVICE", "VEHICLE"])(
    "records %s preferences without promising capacity or payment",
    (type) => {
      const result = visitRequestMessage({ ...base, type }, now);
      expect(result.error).toBeUndefined();
      expect(result.message).toContain("2026-10-23 09:30 (Africa/Lagos, UTC+01:00)");
      expect(result.message).toContain("Staff confirmation required");
      expect(result.message).toContain(
        "No appointment, vehicle reservation or payment is confirmed",
      );
      expect(result.message).toContain(base.message);
      expect(result.message).toContain(
        type === "VEHICLE" ? "Vehicle inspection request" : "Service visit request",
      );
    },
  );
  it.each([
    { date: "", time: "09:30", field: "date" },
    { date: "2026-10-23", time: "", field: "time" },
    { date: "2026-02-30", time: "09:30", field: "date" },
    { date: "2026-10-23", time: "24:00", field: "time" },
    { date: "2026-10-22", time: "12:59", field: "date" },
    { date: "2026-10-22", time: "13:00", field: "date" },
  ])("rejects invalid/past Nigeria-time preference %j", (preference) => {
    const result = visitRequestMessage({ ...base, ...preference }, now);
    expect(result.error).toBeTruthy();
    expect(result.field).toBe(preference.field);
  });
  it("accepts a future preference using Nigeria time, independently of browser timezone", () => {
    expect(
      visitRequestMessage({ ...base, date: "2026-10-22", time: "13:01" }, now).error,
    ).toBeUndefined();
  });
  it("rejects overflow after adding the preference instead of truncating the customer's message", () => {
    const result = visitRequestMessage({ ...base, message: "x".repeat(4000) }, now);
    expect(result.error).toContain("4,000");
    expect(result.field).toBe("message");
  });
  it("does not attach stale preferences to purchases or a deselected visit", () => {
    expect(visitRequestMessage({ ...base, type: "PRODUCT" }, now)).toEqual({
      message: base.message,
    });
    expect(visitRequestMessage({ ...base, requested: false }, now)).toEqual({
      message: base.message,
    });
  });
});
