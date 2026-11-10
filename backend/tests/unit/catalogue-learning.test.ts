import { expect, it } from "vitest";
import {
  learningEligible,
  publicLearningAccess,
} from "../../src/modules/learning/learning.service.js";
import {
  learningArticles,
  learningGuides,
} from "../../src/modules/learning/learning.content.js";

it("versions the People explanation without widening access or treating partial checks as complete", () => {
  const article = learningArticles.find((item) => item.id === "access-review")!;
  expect(article).toMatchObject({
    version: 5,
    gate: "access",
    href: "/admin/workforce/access",
    reviewedAt: "2026-11-10",
  });
  expect(article.steps.join(" ")).toContain("select View person");
  expect(article.steps.join(" ")).toContain("partial summary");
  expect(article.steps.join(" ")).toContain(
    "An unavailable check does not mean no access",
  );
  for (const role of ["PUBLIC", "CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
    const access = {
      ...publicLearningAccess,
      role,
      verified: true,
      managed: true,
      canManage: role === "SUPER_ADMIN",
    };
    expect(learningEligible(access, article.gate)).toBe(role === "SUPER_ADMIN");
    expect(
      learningEligible(
        { ...access, canManage: ["ADMIN", "SUPER_ADMIN"].includes(role) },
        article.gate,
      ),
    ).toBe(["ADMIN", "SUPER_ADMIN"].includes(role));
    expect(learningEligible({ ...access, verified: false }, article.gate)).toBe(false);
  }
});

it("keeps product estimates in the administrator audience without collection authority", () => {
  const item = learningArticles.find((article) => article.id === "product-timing")!;
  expect(item.version).toBe(1);
  expect(item.gate).toBe("admin");
  expect(item.steps.join(" ")).toContain("calendar days");
  expect(item.steps.join(" ")).toContain("Leave unknown values blank");
  expect(item.steps.join(" ")).toContain("not an order promise");
  expect(item.steps.join(" ")).toContain("For an uncertain save");
  for (const role of ["PUBLIC", "CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
    expect(
      learningEligible({ ...publicLearningAccess, role, verified: true }, item.gate),
    ).toBe(role === "ADMIN" || role === "SUPER_ADMIN");
    expect(
      learningEligible({ ...publicLearningAccess, role, verified: false }, item.gate),
    ).toBe(false);
  }
});

it("explains controllable workshop highlights without turning a discovery request into an appointment", () => {
  const home = learningArticles.find((item) => item.id === "home-next-step")!;
  expect(home.version).toBe(6);
  expect(home.gate).toBe("public");
  const text = home.steps.join(" ");
  expect(text).toContain("Generic Lube Oil Service");
  expect(text).toContain("explicitly choose Play");
  expect(text).toContain("does not reserve an appointment");
  expect(text).toContain("complete team photograph");
  expect(text).toContain("Search in the public header");
  expect(text).toContain(
    "Booking availability and checkout availability are checked separately",
  );
  expect(text).toContain("does not establish availability or compatibility");
});

it("versions catalogue instructions without changing public guide targets or write permissions", () => {
  const parts = learningArticles.find((item) => item.id === "parts-fitment")!;
  const vehicles = learningArticles.find((item) => item.id === "vehicle-enquiry")!;
  expect([parts.version, vehicles.version]).toEqual([14, 6]);
  expect(parts.steps.join(" ")).toContain("payment without another staff approval");
  expect(parts.steps.join(" ")).toContain("changing only quantity retains the vehicle");
  expect(parts.steps.join(" ")).toContain("If the offer changes, refresh and review");
  expect(parts.steps.join(" ")).toContain(
    "only after explicitly choosing the same vehicle",
  );
  expect(parts.steps.join(" ")).toContain(
    "stock quantity alone does not establish suitability",
  );
  expect(parts.steps.join(" ")).toContain("need staff review before payment");
  expect(parts.steps.join(" ")).toContain("Verified payment is separate from allocation");
  expect(parts.steps.join(" ")).not.toContain(
    "Payment does not confirm final compatibility",
  );
  expect(parts.steps.join(" ")).toContain("An account is optional");
  expect(parts.steps.join(" ")).toContain("browser that requested it");
  expect(parts.steps.join(" ")).toContain("download or share a verified receipt");
  expect(parts.steps.join(" ")).toContain("forwarding a link does not grant access");
  expect(parts.steps.join(" ")).toContain("Check original action");
  expect(parts.steps.join(" ")).toContain("Cancellation before confirmation is free");
  expect(vehicles.steps.join(" ")).toContain(
    "there is no online inspection request action",
  );
  for (const article of [parts, vehicles]) {
    expect(article.gate).toBe("public");
    expect(article.steps.join(" ")).toContain("Apply filters");
    expect(article.steps.join(" ")).toContain("preserves");
    expect(article.steps.join(" ")).toContain("Reset search");
  }
  const guide = learningGuides.find((item) => item.id === "parts-find")!;
  expect(guide.version).toBe(3);
  expect(guide.steps.map((step) => [step.target, step.event])).toEqual([
    ["parts-search", "input"],
    ["parts-results", "read"],
  ]);
  expect(guide.steps[1].text).toContain("never adds a live item to a cart");
});

it("versions reversal guidance without granting live lookups or writes", () => {
  const guidance = learningArticles.find((item) => item.id === "no-live-lookup")!;
  expect(guidance.version).toBe(3);
  expect(guidance.gate).toBe("public");
  expect(guidance.summary).toContain("does not look up");
  expect(guidance.steps.join(" ")).toContain("do not pay again");
  expect(guidance.steps.join(" ")).toContain("does not prove a refund");
});

it("versions guest refund handoff guidance while preserving separate financial authority", () => {
  const guidance = learningArticles.find((item) => item.id === "financial-aftercare")!;
  expect(guidance.version).toBe(5);
  expect(guidance.gate).toBe("financial-aftercare");
  expect(guidance.steps).toHaveLength(6);
  expect(guidance.steps.join(" ")).toContain("full remaining pre-confirmation refund");
  expect(guidance.steps.join(" ")).toContain("A different authorised operator");
  expect(guidance.steps.join(" ")).toContain("a queued refund is not money returned");
});

it("keeps concern guidance conditional on the real intake form and preserves pending confirmation", () => {
  const article = learningArticles.find((item) => item.id === "service-request")!;
  expect(article.version).toBe(29);
  expect(article.steps.join(" ")).toContain("only for a confirmed future appointment");
  expect(article.steps.join(" ")).toContain("wait for the current availability check");
  expect(article.steps.join(" ")).toContain(
    "unpaid requests do not depend on checkout being available",
  );
  expect(article.steps.join(" ")).toContain(
    "No permission is requested by the invitation",
  );
  expect(article.steps.join(" ")).toContain("alerts stop on sign-out or expiry");
  expect(article.steps.join(" ")).toContain(
    "group follows your draft through sign-in and review",
  );
  expect(article.steps.join(" ")).toContain("keeps the original group name");
  expect(article.steps.join(" ")).toContain(
    "cannot confirm a price or appointment from the group alone",
  );
  expect(article.steps.join(" ")).toContain("stored as a structured reference");
  expect(article.steps.join(" ")).toContain("not an individual priced service");
  expect(article.steps.join(" ")).toContain("no individual services listed yet");
  expect(article.steps.join(" ")).toContain("Declining keeps your existing appointment");
  expect(article.steps.join(" ")).toContain("still needs workshop confirmation");
  expect(article.steps.join(" ")).toContain(
    "update your account and do not submit the booking",
  );
  expect(article.steps.join(" ")).toContain(
    "does not confirm the visit, approve a quotation or charge you",
  );
  expect(article.gate).toBe("public");
  expect(article.steps.join(" ")).toContain("If your booking form offers");
  expect(article.steps.join(" ")).toContain(
    "no service price or confirmed time is implied",
  );
});

it("keeps reviewed contact facts public without promising workshop hours or sending messages", () => {
  const article = learningArticles.find((item) => item.id === "business-contact")!;
  expect(article.gate).toBe("public");
  expect(article.href).toBe("/contact");
  expect(article.summary).toBe(
    "Allied AutoTech is at 133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria.",
  );
  expect(article.steps.join(" ")).toContain("not confirmation of workshop availability");
  expect(article.steps.join(" ")).toContain("does not send a message");
  expect(article.steps.join(" ")).not.toMatch(/2348136075567|08136075567/);
  expect(article.source).toContain("frontend/lib/business.ts");
});

it("keeps category order and image instructions versioned and administrator-only", () => {
  const article = learningArticles.find((item) => item.id === "owner-service-groups")!;
  expect(article.version).toBe(3);
  expect(article.steps.join(" ")).toContain("Manage group image");
  expect(article.steps.join(" ")).toContain("administrator-only preview");
  expect(article.steps.join(" ")).toContain("Review each change before confirming");
  expect(article.gate).toBe("admin");
  expect(article.href).toBe("/admin/service-categories");
  expect(article.steps.join(" ")).toContain("Lower numbers appear first");
  expect(article.steps.join(" ")).toContain("Review and confirm the save");
  expect(article.steps.join(" ")).toContain("Existing groups keep their order");
});

it("keeps every reviewed article within the established client step bound without losing booking conditions", () => {
  for (const article of learningArticles)
    expect(article.steps.length, article.id).toBeLessThanOrEqual(12);
  const service = learningArticles.find((article) => article.id === "service-request")!;
  expect(service.steps).toHaveLength(12);
  const text = service.steps.join(" ");
  for (const condition of [
    "wait for the current availability check",
    "current availability check before submitting",
    "does not submit or confirm your draft",
    "staff",
    "Declining keeps your existing appointment",
    "No booking deposit is required",
    "not reserve capacity",
    "only for a confirmed future appointment",
  ])
    expect(text).toContain(condition);
});

it("explains confirmed calendar export without promising sync, completion or an alarm", () => {
  const text = learningArticles
    .find((item) => item.id === "service-request")!
    .steps.join(" ");
  for (const phrase of [
    "Only a confirmed future appointment",
    "not private notes or a promised job-end time",
    "may not sync automatically",
    "does not confirm a pending request or guarantee an alarm",
  ])
    expect(text).toContain(phrase);
});
it("explains reasoned pending reschedules without releasing the original appointment", () => {
  const booking = learningArticles.find((item) => item.id === "service-request")!;
  const text = booking.steps.join(" ");
  expect(text).toContain("provide a reason");
  expect(text).toContain(
    "original appointment and reminders remain unchanged until staff approves",
  );
  expect(text).toContain("original stays confirmed");
  expect(text).toContain("withdraw only the pending change");
  expect(text).toContain("Cancellation is a separate action");
});

it("versions saved financial breakdown guidance without expanding its independent duties", () => {
  const aftercare = learningArticles.find((value) => value.id === "financial-aftercare")!;
  const policy = learningArticles.find((value) => value.id === "financial-policy-work")!;
  expect(aftercare.version).toBe(5);
  expect(aftercare.gate).toBe("financial-aftercare");
  expect(aftercare.steps.join(" ")).toContain("Saved order amounts");
  expect(aftercare.steps.join(" ")).toContain(
    "does not prove payment or approve a partial refund",
  );
  expect(policy.version).toBe(5);
  expect(policy.gate).toBe("financial-policy");
  expect(policy.steps.join(" ")).toContain("exact halves rounded up");
  expect(policy.steps.join(" ")).toContain("Preserve issued historical amounts");
});

it("explains recorded-start cancellation and missed reminder boundaries without inventing a cutoff", () => {
  const article = learningArticles.find((value) => value.id === "service-request")!;
  expect(article.version).toBe(29);
  const text = article.steps.join(" ");
  expect(text).toContain("only before work starts");
  expect(text).toContain("older status still says Confirmed");
  expect(text).toContain("skips already missed reminders");
});

it("explains resource-aware offers without promising a reservation or hiding preferred-time requests", () => {
  const article = learningArticles.find((value) => value.id === "service-request")!;
  expect(article.version).toBe(29);
  expect(article.gate).toBe("public");
  const text = article.steps.join(" ");
  for (const phrase of [
    "including preparation and cleanup",
    "A listed time is not reserved",
    "preferred-time request for staff assessment",
    "when you submit a request for an offered time",
    "workshop must still confirm it",
  ])
    expect(text).toContain(phrase);
});

it("explains supplied engine and feature information without changing vehicle learning audiences", () => {
  const work = learningArticles.find((item) => item.id === "vehicle-operations")!;
  const enquiry = learningArticles.find((item) => item.id === "vehicle-enquiry")!;
  expect(work.version).toBe(3);
  expect(work.gate).toBe("vehicle-admin");
  expect(enquiry.gate).toBe("public");
  expect(work.steps.join(" ")).toContain("commas within an item are preserved");
  expect(enquiry.steps.join(" ")).toContain("not a certification");
});
