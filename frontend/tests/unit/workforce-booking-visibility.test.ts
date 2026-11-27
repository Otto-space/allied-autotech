import { describe, expect, it } from "vitest";
import { showWorkforceBookingRecord } from "@/lib/admin/workforce-booking-visibility";

describe("staff booking record visibility", () => {
  const current = { loading: false, scopeChanged: false, version: 4, minimumVersion: 0 };

  it("keeps the record mounted while existing data is revalidated", () => {
    expect(showWorkforceBookingRecord(current)).toBe(true);
  });

  it("hides records when loading from scratch or access scope changes", () => {
    expect(showWorkforceBookingRecord({ ...current, loading: true })).toBe(false);
    expect(showWorkforceBookingRecord({ ...current, scopeChanged: true })).toBe(false);
  });

  it("waits for the authoritative version after a saved mutation", () => {
    expect(showWorkforceBookingRecord({ ...current, minimumVersion: 5 })).toBe(false);
    expect(
      showWorkforceBookingRecord({ ...current, version: 5, minimumVersion: 5 }),
    ).toBe(true);
    expect(showWorkforceBookingRecord({ ...current, version: undefined })).toBe(false);
  });
});
