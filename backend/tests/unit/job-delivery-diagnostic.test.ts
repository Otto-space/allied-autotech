import { describe, expect, it } from "vitest";
import {
  jobDeliveryDiagnostic,
  supportDeliverySuppressionReasons,
} from "../../src/modules/audit/job-delivery-diagnostic.js";
import { operationalJobQuerySchema } from "../../src/modules/audit/audit.schemas.js";

const row = {
  eventType: "support.customer-email.requested",
  aggregateType: "SupportCustomerEmail",
  status: "DEAD_LETTER",
  lastError: "CONSENT_WITHDRAWN",
};
describe("safe support delivery diagnostic", () => {
  it("requires an explicit bounded opt-in without changing legacy requests", () => {
    expect(operationalJobQuerySchema.parse({})).toEqual({});
    expect(operationalJobQuerySchema.parse({ diagnostics: "safe_delivery" })).toEqual({
      diagnostics: "safe_delivery",
    });
    for (const query of [
      { diagnostics: "raw" },
      { diagnostics: ["safe_delivery"] },
      { diagnostics: "safe_delivery", payload: true },
    ]) {
      expect(operationalJobQuerySchema.safeParse(query).success).toBe(false);
    }
  });
  it.each(supportDeliverySuppressionReasons)(
    "returns only the recorded %s reason",
    (lastError) => {
      expect(jobDeliveryDiagnostic({ ...row, lastError })).toBe(lastError);
    },
  );
  it.each([
    null,
    "",
    "secret recipient@example.invalid",
    "CONSENT_WITHDRAWN\nprivate",
    "RETRY_EXHAUSTED",
  ])("does not expose unknown diagnostics %s", (lastError) => {
    expect(jobDeliveryDiagnostic({ ...row, lastError })).toBeNull();
  });
  it.each([
    { eventType: "notification.delivery.requested" },
    { aggregateType: "Other" },
    { status: "PUBLISHED" },
    { status: "PENDING" },
  ])("does not classify an unrelated lifecycle %j", (change) => {
    expect(jobDeliveryDiagnostic({ ...row, ...change })).toBeNull();
  });
});
