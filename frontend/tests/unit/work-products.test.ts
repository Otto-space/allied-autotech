import { describe, expect, it } from "vitest";
import {
  productQuery,
  productFormSchema,
  productBody,
  parseAdminProducts,
  parseAdminProduct,
} from "@/lib/admin/product-catalogue";
import { parseProductExtrasSource } from "@/lib/api/product-extras-schemas";
const id = "a0000000-0000-4000-8000-000000000001";
const record = {
  id,
  name: "Brake pad",
  slug: "brake-pad",
  sku: "PAD-1",
  brand: null,
  manufacturerPartNumber: null,
  description: null,
  priceKobo: "9999999999999999",
  compareAtPriceKobo: null,
  currency: "NGN",
  featured: false,
  isActive: true,
  mediaVersion: 0,
  createdAt: "2026-10-13T08:00:00.000Z",
  updatedAt: "2026-10-13T08:00:00.000Z",
  category: { id, name: "Braking", slug: "braking", isActive: true },
  images: [],
  compatibilities: [],
  availability: [],
};
const values = {
  name: "Brake pad",
  slug: "brake-pad",
  sku: "pad-1",
  categoryId: id,
  brand: "",
  manufacturerPartNumber: "",
  description: "",
  priceKobo: "99999999999999.99",
  compareAtPriceKobo: "",
  featured: false,
  isActive: true,
};
describe("administrator product boundaries", () => {
  it("keeps large prices exact and binds edits to the observed version", () => {
    const body = productBody(productFormSchema.parse(values), parseAdminProduct(record));
    expect(body).toMatchObject({
      priceKobo: "9999999999999999",
      sku: "PAD-1",
      brand: null,
      expectedUpdatedAt: record.updatedAt,
    });
    expect(productBody(productFormSchema.parse(values))).not.toHaveProperty(
      "expectedUpdatedAt",
    );
  });
  it.each(["100000000000000.00", "1e5", "-1", "1.001"])(
    "rejects unrepresentable price %s",
    (priceKobo) => {
      expect(productFormSchema.safeParse({ ...values, priceKobo }).success).toBe(false);
    },
  );
  it("enforces comparison price and complete text limits", () => {
    expect(
      productFormSchema.safeParse({ ...values, priceKobo: "2", compareAtPriceKobo: "1" })
        .success,
    ).toBe(false);
    expect(
      productFormSchema.safeParse({ ...values, description: "a".repeat(10000) }).success,
    ).toBe(true);
    expect(
      productFormSchema.safeParse({ ...values, description: "a".repeat(10001) }).success,
    ).toBe(false);
    expect(productFormSchema.safeParse({ ...values, name: "bad\nname" }).success).toBe(
      false,
    );
  });
  it("keeps workspace and cursor history out of API queries", () => {
    const q = productQuery(
      new URLSearchParams(
        `search=+brake+&categoryId=${id}&isActive=false&featured=true&sort=price_desc&brand=Bosch&make=Toyota&model=Camry&year=2020&cursor=${id}&_trail=start&edit=${id}`,
      ),
    );
    expect(q.invalid).toBe(false);
    expect(q.edit).toBe(id);
    expect(q.api.get("search")).toBe("brake");
    expect(q.api.get("year")).toBe("2020");
    expect(q.api.has("edit")).toBe(false);
    expect(q.api.has("_trail")).toBe(false);
  });
  it.each([
    "search=a&search=b",
    "sort=wrong",
    "isActive=1",
    "year=2101",
    "year=2e3",
    "cursor=invalid",
    `edit=${id}&view=create`,
    "search=%00bad",
  ])("fails closed on invalid query %s", (input) => {
    const q = productQuery(new URLSearchParams(input));
    expect(q.invalid).toBe(true);
    expect(q.path).toBeNull();
  });
  it("discards invalid or oversized optional history without changing valid API paging", () => {
    const q = productQuery(new URLSearchParams(`cursor=${id}&_trail=start,wrong`));
    expect(q.invalid).toBe(false);
    expect(q.params.has("_trail")).toBe(false);
    expect(q.api.get("cursor")).toBe(id);
  });
  it("rejects duplicate products, oversized pages and missing media versions", () => {
    expect(() => parseAdminProducts({ items: [record, record] })).toThrow();
    expect(() => parseAdminProducts({ items: Array(26).fill(record) })).toThrow();
    expect(() => parseAdminProduct({ ...record, mediaVersion: undefined })).toThrow();
  });
  it("supports direct media records and legacy list callers", () => {
    expect(parseProductExtrasSource(record).items[0].id).toBe(id);
    expect(parseProductExtrasSource({ items: [record] }).items[0].id).toBe(id);
    expect(() => parseProductExtrasSource({ id })).toThrow();
  });
});
