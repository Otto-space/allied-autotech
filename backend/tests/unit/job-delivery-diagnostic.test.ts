import { describe, expect, it } from "vitest";
import {
  jobDeliveryDiagnostic,
  supportDeliverySuppressionReasons,
} from "../../src/modules/audit/job-delivery-diagnostic.js";

const row = {
  eventType: "support.customer-email.requested",
  aggregateType: "SupportCustomerEmail",
  status: "DEAD_LETTER",
  lastError: "CONSENT_WITHDRAWN",
};
describe("safe support delivery diagnostic", () => {
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
