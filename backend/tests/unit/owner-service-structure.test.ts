import { describe, expect, it } from "vitest";
import {
  ownerServiceGroups,
  planOwnerServiceGroups,
} from "../../src/modules/service-operations/owner-service-structure.js";
describe("owner service structure reconciliation", () => {
  it("reuses existing identities and legacy URLs without inventing service offerings", () => {
    const rows = [
      {
        id: "existing-wheel-group",
        slug: "existing-wheel-url",
        name: "Tyre & Wheel Maintenance",
      },
    ];
    const result = planOwnerServiceGroups(rows);
    expect(result).toHaveLength(8);
    expect(result[0]).toMatchObject({
      action: "reuse",
      id: rows[0].id,
      slug: rows[0].slug,
    });
    expect(rows).toEqual([
      {
        id: "existing-wheel-group",
        slug: "existing-wheel-url",
        name: "Tyre & Wheel Maintenance",
      },
    ]);
    expect(result.filter((row) => row.action === "create")).toHaveLength(7);
  });
  it("does not create duplicates after the planned import", () => {
    const imported = planOwnerServiceGroups([]).map((row, index) => ({
      id: String(index),
      name: row.name,
      slug: row.slug,
    }));
    expect(planOwnerServiceGroups(imported).every((row) => row.action === "reuse")).toBe(
      true,
    );
    expect(new Set(ownerServiceGroups.map((row) => row.slug)).size).toBe(8);
  });
  it("stops on conflicting slug and name matches instead of silently merging records", () => {
    expect(() =>
      planOwnerServiceGroups([
        { id: "one", slug: "tyre-wheel-maintenance", name: "Old wheel name" },
        { id: "two", slug: "another-slug", name: "Tyre & Wheel Maintenance" },
      ]),
    ).toThrow("Ambiguous existing service category");
  });
});
