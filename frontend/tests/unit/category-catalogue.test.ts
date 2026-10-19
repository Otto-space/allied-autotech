import { describe, expect, it } from "vitest";
import {
  categoryFormSchema,
  categoryQuery,
  parseAdminCategoryPage,
} from "@/lib/admin/category-catalogue";

describe("administrator category boundary", () => {
  it("forwards supported prefix filters and signed cursor, keeping edit/history client-side", () => {
    const result = categoryQuery(
      new URLSearchParams(
        "search=%20M%20&isActive=false&cursor=signed_page&_trail=start&edit=d1000000-0000-4000-8000-000000000801",
      ),
    );
    expect(result.invalid).toBe(false);
    expect(Object.fromEntries(result.api)).toEqual({
      limit: "25",
      search: "M",
      isActive: "false",
      cursor: "signed_page",
    });
    expect(result.params.get("_trail")).toBe("start");
    expect(result.edit).toBe("d1000000-0000-4000-8000-000000000801");
  });
  it("does not issue requests for invalid or ambiguous queries", () => {
    for (const query of [
      "search=a&search=b",
      "isActive=1",
      "cursor=bad%2Fcursor",
      "edit=unknown",
      `search=${"a".repeat(121)}`,
      "search=a%00b",
    ])
      expect(categoryQuery(new URLSearchParams(query)).path).toBeNull();
  });
  it("drops malformed history without treating it as authority", () => {
    expect(
      categoryQuery(
        new URLSearchParams("cursor=signed_page&_trail=other,bad"),
      ).params.has("_trail"),
    ).toBe(false);
  });
  it("validates API text limits and trims optional description", () => {
    const input = {
      name: " Maintenance ",
      slug: "maintenance",
      description: "  ",
      isActive: true,
    };
    expect(categoryFormSchema.parse(input)).toEqual({
      ...input,
      name: "Maintenance",
      description: "",
    });
    for (const patch of [
      { name: "" },
      { name: "x".repeat(121) },
      { slug: "Bad Slug" },
      { description: "x".repeat(2001) },
      { description: "unsupported\ncontrol" },
    ])
      expect(categoryFormSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it("rejects incomplete, duplicate and oversized category records", () => {
    const row = {
      id: "d1000000-0000-4000-8000-000000000801",
      name: "Maintenance",
      slug: "maintenance",
      description: null,
      isActive: true,
      version: 0,
      createdAt: "2026-10-12T08:00:00Z",
      updatedAt: "2026-10-12T08:00:00Z",
    };
    expect(parseAdminCategoryPage({ items: [row] }).items).toHaveLength(1);
    expect(() => parseAdminCategoryPage({ items: [row, row] })).toThrow();
    expect(() => parseAdminCategoryPage({ items: [{ ...row, version: -1 }] })).toThrow();
    expect(() => parseAdminCategoryPage({ items: [{ id: row.id }] })).toThrow();
  });
});
