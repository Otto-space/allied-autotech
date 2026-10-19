import { describe, expect, it } from "vitest";
import {
  adminServiceQuery,
  parseAdminServices,
  serviceFormSchema,
} from "../../lib/admin/service-catalogue";
const uuid = "d1000000-0000-4000-8000-000000000900";
describe("Administrator service query and record boundaries", () => {
  it("sends only canonical API filters, retaining UI history separately", () => {
    const q = adminServiceQuery(
      new URLSearchParams(
        `search=%20Brake%20&categoryId=${uuid}&isActive=false&pricingType=QUOTE_REQUIRED&cursor=${uuid}&_trail=start&limit=100`,
      ),
    );
    expect(q.invalid).toBe(false);
    expect(q.api.get("search")).toBe("Brake");
    expect(q.api.get("limit")).toBe("25");
    expect(q.api.has("_trail")).toBe(false);
    expect(q.params.get("_trail")).toBe("start");
  });
  it("rejects ambiguous or malformed filters without issuing a catalogue path", () => {
    for (const query of [
      "search=a",
      "search=ab&search=cd",
      "isActive=TRUE",
      "categoryId=no",
      "cursor=no",
      "pricingType=OTHER",
      "search=ab%0Acd",
    ])
      expect(adminServiceQuery(new URLSearchParams(query)).path).toBeNull();
    expect(
      adminServiceQuery(
        new URLSearchParams(`cursor=${uuid}&_trail=${"start,".repeat(60)}`),
      ).params.has("_trail"),
    ).toBe(false);
  });
  it("validates monetary and duration boundaries without floating point rounding", () => {
    const base = {
      name: "Service",
      slug: "service",
      categoryId: "",
      shortDescription: "",
      description: "",
      pricingType: "FIXED",
      price: "99999999999999.99",
      duration: "1440",
      isActive: true,
    };
    expect(serviceFormSchema.safeParse(base).success).toBe(true);
    for (const patch of [
      { price: "100000000000000.00" },
      { price: "1.001" },
      { price: "1,000" },
      { price: "" },
      { duration: "14" },
      { duration: "1441" },
      { duration: "15.5" },
      { pricingType: "" },
    ])
      expect(serviceFormSchema.safeParse({ ...base, ...patch }).success).toBe(false);
    expect(
      serviceFormSchema.safeParse({ ...base, pricingType: "QUOTE_REQUIRED", price: "" })
        .success,
    ).toBe(true);
  });
  it("rejects mismatched category and media identities, duplicate or oversized pages", () => {
    const r = {
      id: uuid,
      name: "Service",
      slug: "service",
      categoryId: null,
      category: null,
      image: null,
      shortDescription: null,
      description: null,
      pricingType: "QUOTE_REQUIRED",
      priceKobo: null,
      currency: "NGN",
      durationMinutes: null,
      isActive: false,
      version: 0,
      createdAt: "2026-10-12T08:00:00Z",
      updatedAt: "2026-10-12T08:00:00Z",
    };
    expect(parseAdminServices({ items: [r] }).items).toHaveLength(1);
    for (const items of [
      [r, r],
      [{ ...r, categoryId: uuid }],
      [
        {
          ...r,
          image: {
            id: uuid,
            url: "https://external.test/image",
            width: 100,
            height: 100,
            altText: null,
          },
        },
      ],
      Array.from({ length: 26 }, () => r),
    ])
      expect(() => parseAdminServices({ items })).toThrow();
  });
});
