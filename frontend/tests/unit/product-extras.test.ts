import { describe, expect, it } from "vitest";
import {
  compatibilityBody,
  compatibilityFormSchema,
  imageFormSchema,
} from "@/lib/forms/product-extras";

describe("product metadata input boundaries", () => {
  it("rejects malformed, credential-bearing and non-HTTPS image addresses without throwing", () => {
    for (const url of [
      "",
      "not a URL",
      "https://",
      "http://images.invalid/a.jpg",
      "https://user:password@images.invalid/a.jpg",
      "javascript:alert(1)",
    ]) {
      expect(
        imageFormSchema.safeParse({ url, altText: "", sortOrder: "0", isPrimary: false })
          .success,
      ).toBe(false);
    }
  });

  it("preserves an explicitly cleared year bound and rejects impossible ranges", () => {
    const draft = {
      make: "Test make",
      model: "",
      yearFrom: "",
      yearTo: "2020",
      notes: "",
    };
    expect(compatibilityBody(compatibilityFormSchema.parse(draft))).toEqual({
      make: "Test make",
      model: null,
      yearFrom: null,
      yearTo: 2020,
      notes: null,
    });
    for (const yearFrom of ["1885", "2101", "2021", "2e03", "2020.5"]) {
      expect(compatibilityFormSchema.safeParse({ ...draft, yearFrom }).success).toBe(
        false,
      );
    }
    expect(
      compatibilityFormSchema.safeParse({ ...draft, notes: "First line\nSecond line" })
        .success,
    ).toBe(false);
  });
});
