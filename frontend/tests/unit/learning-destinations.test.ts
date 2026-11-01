import { describe, expect, it } from "vitest";
import { catalogueSchema, learningHref } from "@/lib/learning/contracts";

const destinations = [
  "/admin/service-categories",
  "/admin/workforce/bookings",
  "/admin/workforce/aftercare",
  "/admin/refunds",
  "/admin/payment-disputes/work",
  "/admin/privacy",
  "/admin/finance-policy",
];

describe("authorised Help destinations", () => {
  it("accepts a catalogue containing the supported staff destinations", () => {
    const articles = destinations.map((href, index) => ({
      id: `staff-topic-${index}`,
      title: "Synthetic staff guidance",
      summary: "Read the guidance.",
      prerequisites: "Authorised access is required.",
      steps: ["Review the current record."],
      outcome: "The next step is clear.",
      recovery: "Contact the team.",
      keywords: "staff",
      page: "work",
      href,
      source: "Synthetic contract fixture",
      version: 1,
      status: "published",
      reviewedAt: "2026-11-01",
    }));
    const catalogue = {
      accessKey: "a".repeat(64),
      audience: "work",
      contentVersion: 1,
      mode: "browse_enquiries",
      flags: { guides: false, practice: false, ai: false },
      articles,
      guides: [],
      scenarios: [],
    };
    expect(
      catalogueSchema.parse(catalogue).articles.map((article) => article.href),
    ).toEqual(destinations);
  });
  it.each([
    "https://example.com",
    "//example.com",
    "javascript:alert(1)",
    "/admin/unknown",
    "/admin/privacy?redirect=https://example.com",
  ])("still rejects unsupported destination %s", (href) => {
    expect(learningHref.safeParse(href).success).toBe(false);
  });
});
