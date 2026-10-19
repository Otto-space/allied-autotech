import { describe, expect, it } from "vitest";
import {
  productCategoryQuery,
  productCategoryBody,
  parseAdminProductCategories,
  categoryFormSchema,
} from "@/lib/admin/product-categories";
const id = "00000000-0000-4000-8000-000000000001";
const record = {
  id,
  name: "Braking",
  slug: "braking",
  description: null,
  isActive: true,
  createdAt: "2026-10-13T08:00:00.000Z",
  updatedAt: "2026-10-13T08:00:00.000Z",
};
describe("product category boundary", () => {
  it("keeps literal prefix and strips editor/history from API requests", () => {
    const q = productCategoryQuery(
      new URLSearchParams({
        search: "  %_  ",
        isActive: "false",
        cursor: id,
        _trail: "start",
        edit: id,
      }),
    );
    expect(q.invalid).toBe(false);
    expect(Object.fromEntries(q.api)).toEqual({
      limit: "25",
      search: "%_",
      isActive: "false",
      cursor: id,
    });
    expect(q.edit).toBe(id);
  });
  it.each([
    "edit=bad",
    "cursor=bad",
    "view=unknown",
    `view=create&edit=${id}`,
    "isActive=yes",
    "search=a&search=b",
    "search=%00",
    `search=${"a".repeat(121)}`,
  ])("blocks invalid query %s", (input) => {
    const q = productCategoryQuery(new URLSearchParams(input));
    expect(q.invalid).toBe(true);
    expect(q.path).toBeNull();
    expect(q.edit).toBeUndefined();
    expect(q.creating).toBe(false);
  });
  it("bounds browser paging history without treating it as an API cursor", () => {
    const q = productCategoryQuery(
      new URLSearchParams({
        cursor: id,
        _trail: ["start", ...Array(21).fill(id)].join(","),
      }),
    );
    expect(q.params.has("_trail")).toBe(false);
    expect(q.api.get("cursor")).toBe(id);
  });
  it("rejects duplicate or malformed category records", () => {
    expect(() => parseAdminProductCategories({ items: [record, record] })).toThrow();
    expect(() =>
      parseAdminProductCategories({ items: [{ ...record, isActive: "true" }] }),
    ).toThrow();
    expect(() =>
      parseAdminProductCategories({ items: [record], nextCursor: "opaque" }),
    ).toThrow();
  });
  it("uses observed timestamp only for edits and explicitly clears descriptions", () => {
    const values = {
      name: " Braking ",
      slug: " braking ",
      description: " ",
      isActive: false,
    };
    expect(productCategoryBody(values, record)).toEqual({
      name: "Braking",
      slug: "braking",
      description: null,
      isActive: false,
      expectedUpdatedAt: record.updatedAt,
    });
    expect(productCategoryBody(values)).not.toHaveProperty("expectedUpdatedAt");
  });
  it("rejects blank names, invalid URL names and oversized descriptions", () => {
    for (const changes of [
      { name: " " },
      { slug: "UPPER" },
      { description: "x".repeat(2001) },
    ])
      expect(
        categoryFormSchema.safeParse({
          name: "Braking",
          slug: "braking",
          description: "",
          isActive: true,
          ...changes,
        }).success,
      ).toBe(false);
  });
});
