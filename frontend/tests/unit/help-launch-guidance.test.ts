import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
import { capabilityView } from "@/lib/public-capabilities";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe.each(["browse_enquiries", "catalogue", "full"])("Help in %s mode", (mode) => {
  it("keeps parts, payment and visit guidance consistent with available actions", async () => {
    vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", mode);
    vi.resetModules();
    const { getFaqs, answerFaq, business } = await import("@/lib/business");
    const { getHelpArticleGuidance } = await import("@/lib/help-article-guidance");
    const capabilities = capabilityView(publicCapabilitiesFixture(mode));
    const faqs = getFaqs(capabilities);
    const helpArticleGuidance = getHelpArticleGuidance(capabilities);
    const parts = faqs.find((item) => item.id === "shop-and-collection")!;
    const inspection = faqs.find((item) => item.id === "vehicle-inspections")!;
    expect(inspection.answer).toContain("does not");
    const payment = faqs.find((item) => item.id === "pending-payments")!;
    expect(answerFaq("parts compatibility stock", faqs)).toBe(parts);
    expect(parts.answer).toContain("unknown or needs verification");
    expect(parts.answer).toContain("does not reserve stock");
    expect(parts.answer).toContain("collection from the workshop");
    expect(helpArticleGuidance[parts.id][2]).toContain("engine, trim");
    if (mode === "full") {
      expect(inspection.answer).toContain("Use the inspection request option");
      expect(payment.href).toBe("/dashboard/payments");
      expect(helpArticleGuidance[payment.id][0]).toBe("Your order or payment reference");
      expect(parts.answer).toContain("Review quantities and the total at checkout");
    } else {
      expect(inspection.answer).toContain("Send a vehicle enquiry");
      expect(inspection.answer).not.toContain("Use the inspection request option");
      expect(inspection.answer).toContain("confirms any visit separately");
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
