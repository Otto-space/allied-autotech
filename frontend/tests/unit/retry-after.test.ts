import { describe, it, expect } from "vitest";
import { retryAfterSeconds } from "../../lib/api/retry-after";
describe("Retry-After", () => {
  it.each([
    ["60", 60],
    [" 5 ", 5],
    ["0", 0],
    ["999999999999", 86400],
  ] as const)("accepts bounded seconds %s", (input, seconds) => {
    expect(retryAfterSeconds(input)).toBe(seconds);
  });
  it("uses a future HTTP-date relative to the response time", () => {
    expect(
      retryAfterSeconds(
        "Thu, 08 Oct 2026 12:01:00 GMT",
        Date.parse("2026-10-08T12:00:00Z"),
      ),
    ).toBe(60);
  });
  it.each([null, "", "-1", "1.5", "tomorrow", "Thu, invalid", "9".repeat(129)])(
    "rejects malformed values %s",
    (input) => {
      expect(retryAfterSeconds(input)).toBeUndefined();
    },
  );
  it("ignores an expired HTTP-date", () => {
    expect(
      retryAfterSeconds(
        "Thu, 08 Oct 2026 12:00:00 GMT",
        Date.parse("2026-10-08T12:01:00Z"),
      ),
    ).toBeUndefined();
  });
});
