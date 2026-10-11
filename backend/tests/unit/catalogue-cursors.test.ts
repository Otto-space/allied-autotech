import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  catalogueBinding,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
} from "../../src/common/security/catalogue-cursors.js";
describe("Catalogue cursor authentication", () => {
  it("binds query values and endpoint while permitting page-size changes and property reordering", () => {
    const binding = catalogueBinding("vehicles", {
      sort: "newest",
      make: "Toyota",
      limit: 2,
    });
    expect(
      catalogueBinding("vehicles", {
        make: "Toyota",
        limit: 50,
        cursor: "ignored",
        sort: "newest",
      }),
    ).toBe(binding);
    const cursor = encodeCatalogueCursor(binding, "position");
    expect(decodeCatalogueCursor(binding, cursor, z.string())).toBe("position");
    for (const other of [
      catalogueBinding("facets", { sort: "newest", make: "Toyota" }),
      catalogueBinding("vehicles", { sort: "newest", make: "Honda" }),
    ])
      expect(() => decodeCatalogueCursor(other, cursor, z.string())).toThrow(
        "Invalid catalogue cursor",
      );
  });
  it("rejects modified, truncated, oversized and structurally invalid payloads", () => {
    const cursor = encodeCatalogueCursor("binding", { unexpected: true });
    for (const invalid of [cursor, cursor.slice(0, -1), "A".repeat(1025), "not-a-cursor"])
      expect(() => decodeCatalogueCursor("binding", invalid, z.string())).toThrow(
        "Invalid catalogue cursor",
      );
  });
});
