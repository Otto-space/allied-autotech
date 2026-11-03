import { expect, it } from "vitest";
import { parseWorkSlots } from "../../lib/api/work-slot-schema";
import { slotRecord } from "../fixtures/work-slots";
it("retains stale-offer review metadata and distinguishes zero from unknown buffers", () => {
  const row = { ...slotRecord(1), timingReviewRequired: true };
  row.service.preparationMinutes = null;
  row.service.cleanupMinutes = 0;
  const parsed = parseWorkSlots({ items: [row] }).items[0];
  expect(parsed.timingReviewRequired).toBe(true);
  expect(parsed.service.preparationMinutes).toBeNull();
  expect(parsed.service.cleanupMinutes).toBe(0);
  expect(() =>
    parseWorkSlots({
      items: [{ ...row, service: { ...row.service, cleanupMinutes: -1 } }],
    }),
  ).toThrow();
});
