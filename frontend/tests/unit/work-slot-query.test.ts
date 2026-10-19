import { describe, expect, it } from "vitest";
import { workSlotQuery } from "../../lib/work-slot-query";
describe("workshop slot query", () => {
  it("uses inclusive Lagos days and no unsupported maximum range", () => {
    const result = workSlotQuery(new URLSearchParams("from=2026-01-01&to=2027-12-31"));
    expect(result.invalid).toBe(false);
    expect(result.api.get("startsFrom")).toBe("2025-12-31T23:00:00.000Z");
    expect(result.api.get("startsTo")).toBe("2027-12-31T23:00:00.000Z");
  });
  it.each([
    "from=2026-02-30",
    "from=2027-01-02&to=2027-01-01",
    "status=OPEN&status=CLOSED",
    "staffId=invalid",
    "to=9999-12-31",
  ])("rejects invalid filters %s", (query) =>
    expect(workSlotQuery(new URLSearchParams(query)).path).toBeNull(),
  );
  it("forbids staff branch override and excludes UI traversal from API", () => {
    const id = "30000000-0000-4000-8000-000000000001";
    expect(workSlotQuery(new URLSearchParams(`branchId=${id}`), false).invalid).toBe(
      true,
    );
    const result = workSlotQuery(new URLSearchParams(`cursor=${id}&_trail=start`));
    expect(result.params.get("_trail")).toBe("start");
    expect(result.api.has("_trail")).toBe(false);
  });
});
