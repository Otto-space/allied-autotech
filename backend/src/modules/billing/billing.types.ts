import { servicePaymentBinding } from "./service-payment-plan.js";
import { servicePaymentSummary } from "./service-payment-summary.js";

export function invoiceJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(invoiceJsonSafe);
  if (value !== null && typeof value === "object") {
    const result = Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            ![
              "documentSnapshot",
              "policySnapshot",
              "settledAttempt",
              "attempts",
              "anomalies",
              "completedAt",
            ].includes(key),
        )
        .map(([key, child]) => [key, invoiceJsonSafe(child)]),
    );
    if ("documentSnapshot" in value && "payments" in value) {
      const summary = servicePaymentSummary(
        value as Parameters<typeof servicePaymentSummary>[0],
      );
      if (summary) result["servicePayment"] = summary;
    }
    if ("policySnapshot" in value && "paymentNumber" in value) {
      const binding = servicePaymentBinding(value.policySnapshot);
      if (binding) result["serviceStage"] = binding.stage;
    }
    return result;
  }
  return value;
}
export function invoicePage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    ...(rows.length > limit && last !== undefined ? { nextCursor: last.id } : {}),
  };
}
