import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe.each(["browse_enquiries", "catalogue", "full"])("Help in %s mode", (mode) => {
  it("keeps parts, payment and visit guidance consistent with available actions", async () => {
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", mode);
    vi.resetModules();
    const { faqs, answerFaq, business } = await import("@/lib/business");
    const { helpArticleGuidance } = await import("@/lib/help-article-guidance");
    const parts = faqs.find((item) => item.id === "shop-and-collection")!;
    const payment = faqs.find((item) => item.id === "pending-payments")!;
    expect(answerFaq("parts compatibility stock")).toBe(parts);
    expect(parts.answer).toContain("unknown or needs verification");
    expect(parts.answer).toContain("does not reserve stock");
    expect(parts.answer).toContain("collection from the workshop");
    expect(helpArticleGuidance[parts.id][2]).toContain("engine, trim");
    if (mode === "full") {
      expect(payment.href).toBe("/dashboard/payments");
      expect(helpArticleGuidance[payment.id][0]).toBe("Your order or payment reference");
      expect(parts.answer).toContain("Review quantities and the total at checkout");
    } else {
      expect(parts.answer).toContain("only a verified fit");
      expect(parts.answer).toContain("Online checkout is not available");
      expect(parts.answer).not.toContain("at checkout");
      expect(payment.href).toBe("/contact#enquiry");
      expect(helpArticleGuidance[payment.id].join(" ")).not.toMatch(
        /attempted|payment reference/,
      );
      expect(helpArticleGuidance["booking-a-service"][2]).toContain("before confirming");
      expect(
        faqs.find((item) => item.id === "policies-and-opening-hours")!.answer,
      ).toContain(business.customerCareHours);
    }
  });
});
