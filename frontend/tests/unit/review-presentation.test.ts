import { describe, expect, it } from "vitest";
import { formatReviewDate, reviewerInitials } from "@/lib/reviews/presentation";
import { publicReviewSchema } from "@/lib/api/review-schemas";

const review = {
  id: "a7100000-0000-4000-8000-000000000001",
  targetType: "BUSINESS",
  rating: 3,
  title: null,
  comment: "Synthetic customer feedback",
  createdAt: "2026-09-18T10:03:00Z",
  product: null,
  service: null,
};

describe("public review presentation", () => {
  it("formats an understated calendar date in the business timezone", () => {
    expect(formatReviewDate("2026-09-17T23:30:00Z")).toMatch(/18.*Sept.*2026/);
    expect(formatReviewDate(review.createdAt)).not.toMatch(/10:03|11:03|Lagos time/);
    expect(formatReviewDate("invalid")).toBe("Date unavailable");
  });
  it.each([
    ["Ada Okafor", "AO"],
    ["  Ada   Nneka  Okafor ", "AO"],
    ["Ada", "A"],
    ["", "C"],
  ])("uses honest initials for %s", (name, initials) => {
    expect(reviewerInitials(name)).toBe(initials);
  });
  it("accepts current reviewer details and remains compatible with anonymous older API responses", () => {
    expect(publicReviewSchema.parse(review).reviewer).toBeUndefined();
    expect(
      publicReviewSchema.parse({
        ...review,
        reviewer: {
          displayName: "Ada Okafor",
          photoUrl: `/api/v1/public/support/reviews/${review.id}/photo`,
        },
      }).reviewer?.displayName,
    ).toBe("Ada Okafor");
    expect(
      publicReviewSchema.parse({
        ...review,
        reviewer: {
          displayName: "Ada Okafor",
          photoUrl: `/api/v1/public/support/reviews/${review.id}/photo?v=2`,
        },
      }).reviewer?.photoUrl,
    ).toContain("?v=2");
  });
  it.each([
    "https://untrusted.example/photo",
    "/api/v1/customers/media/images/a7100000-0000-4000-8000-000000000001",
    "javascript:alert(1)",
  ])("rejects unrelated reviewer photo paths: %s", (photoUrl) => {
    expect(
      publicReviewSchema.safeParse({
        ...review,
        reviewer: { displayName: "Ada", photoUrl },
      }).success,
    ).toBe(false);
  });
});
