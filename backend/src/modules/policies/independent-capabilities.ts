import { z } from "zod";

// Existing owner-granted UserCapability duties. These never become branch
// responsibility actions, delegation authority or an exemption from domain checks.
export const independentCapabilitySchema = z.enum([
  "REFUND_APPROVE",
  "REFUND_TRANSFER",
  "REFUND_CHECK",
  "FINANCE_POLICY_APPROVE",
  "BOOKING_CONFIRM",
  "PRIVACY_REVIEW",
  "DISPUTE_MANAGE",
]);
export type IndependentCapability = z.infer<typeof independentCapabilitySchema>;
export function recognisedIndependentCapabilities(values: readonly string[]) {
  return [
    ...new Set(
      values.filter(
        (value): value is IndependentCapability =>
          independentCapabilitySchema.safeParse(value).success,
      ),
    ),
  ].sort();
}

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// Exact existing endpoints, not module-prefix exemptions. Every destination still
// checks current account/MFA, capability, record stage/ownership and review/CSRF.
// BOOKING_CONFIRM requires its scoped booking adapter; it is recorded here but
// deliberately does not open the broad legacy bookings API.
export function independentEndpointCapabilities(
  path: string,
  method: string,
): readonly IndependentCapability[] {
  if (method === "GET" || method === "HEAD") {
    if (new RegExp(`^/api/v1/staff/refunds(?:/${uuid})?$`).test(path))
      return ["REFUND_APPROVE", "REFUND_TRANSFER", "REFUND_CHECK"];
    if (new RegExp(`^/api/v1/staff/disputes(?:/(?:operators|${uuid}))?$`).test(path))
      return ["DISPUTE_MANAGE"];
    if (/^\/api\/v1\/staff\/finance-policy(?:\/current)?$/.test(path))
      return ["FINANCE_POLICY_APPROVE"];
    if (
      path === "/api/v1/staff/privacy-requests" ||
      path === "/api/v1/staff/retention-holds"
    )
      return ["PRIVACY_REVIEW"];
  }
  if (method === "POST") {
    if (new RegExp(`^/api/v1/staff/refunds/${uuid}/decision$`).test(path))
      return ["REFUND_APPROVE"];
    if (
      new RegExp(`^/api/v1/staff/refunds/${uuid}/(?:transfer|evidence-upload)$`).test(
        path,
      )
    )
      return ["REFUND_TRANSFER"];
    if (
      new RegExp(`^/api/v1/staff/refunds/${uuid}/(?:check|evidence-access)$`).test(path)
    )
      return ["REFUND_CHECK"];
    if (
      new RegExp(
        `^/api/v1/staff/disputes/${uuid}/(?:assign|acknowledge|evidence-upload|evidence|evidence-access|submission)$`,
      ).test(path)
    )
      return ["DISPUTE_MANAGE"];
    if (path === "/api/v1/admin/policies") return ["FINANCE_POLICY_APPROVE"];
    if (
      path === "/api/v1/staff/retention-holds" ||
      new RegExp(`^/api/v1/staff/retention-holds/${uuid}/release$`).test(path) ||
      new RegExp(`^/api/v1/staff/privacy-requests/${uuid}/review$`).test(path)
    )
      return ["PRIVACY_REVIEW"];
  }
  return [];
}
