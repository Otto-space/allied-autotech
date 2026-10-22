export const workflowStages = {
  enquiry: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  complaint: ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"],
  booking: ["REQUESTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED"],
  order: ["PENDING", "CONFIRMED", "PROCESSING", "READY", "COMPLETED"],
  workOrder: [
    "DRAFT",
    "APPROVED",
    "IN_PROGRESS",
    "AWAITING_PARTS",
    "QUALITY_CHECK",
    "COMPLETED",
  ],
  quote: ["DRAFT", "ISSUED", "ACCEPTED"],
  invoice: ["DRAFT", "ISSUED", "PAID"],
  payment: ["REQUIRES_PAYMENT", "PROCESSING", "SUCCEEDED"],
  inspection: ["REQUESTED", "CONFIRMED", "COMPLETED"],
  vehicle: [
    "ENQUIRY",
    "INSPECTION_SCHEDULED",
    "INSPECTION_COMPLETED",
    "NEGOTIATING",
    "PAYMENT_PENDING",
    "RESERVED",
    "PARTIALLY_PAID",
    "PAID",
    "HANDOVER_PENDING",
    "COMPLETED",
  ],
  stock: ["DRAFT", "AVAILABLE", "RESERVED", "SOLD"],
  refund: ["REQUESTED", "APPROVED", "PENDING", "PROCESSING", "SUCCEEDED"],
  aftercare: ["REQUESTED", "RECEIVED", "INSPECTED", "APPROVED"],
  privacy: ["REQUESTED", "UNDER_REVIEW", "APPROVED_PENDING_POLICY"],
  review: ["PENDING", "APPROVED"],
  handover: ["PENDING", "READY", "COMPLETED"],
  dispute: ["AWAITING_RESPONSE", "UNDER_REVIEW"],
} as const;
export type Workflow = keyof typeof workflowStages;
export function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (s) => s.toUpperCase());
}
export function progressStages(workflow: Workflow, status: string): readonly string[] {
  const stages: readonly string[] = workflowStages[workflow];
  // Exceptional and unknown states remain explicit. Never present cancellation,
  // expiry, rejection or an unrecognized status as successful completion.
  return stages.includes(status) ? stages : [...stages, status];
}
