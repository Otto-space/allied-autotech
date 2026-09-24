import type { DisputeWork } from "@/lib/api/dispute-workflow";
export const disputeId = (n: number) =>
  `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const disputeFixture = (): DisputeWork => ({
  id: disputeId(20),
  paymentAttemptId: disputeId(30),
  provider: "PAYSTACK",
  providerDisputeId: "ISOLATED-DISPUTE-020",
  status: "AWAITING_RESPONSE",
  category: "NOT_RECEIVED",
  amountKobo: "1234567890123456",
  currency: "NGN",
  openedAt: "2026-09-17T09:00:00Z",
  responseDueAt: "2026-09-28T10:00:00Z",
  acknowledgementDueAt: "2026-09-17T11:00:00Z",
  primaryUserId: disputeId(10),
  backupUserId: disputeId(11),
  primaryOperator: { id: disputeId(10), label: "Synthetic primary" },
  backupOperator: { id: disputeId(11), label: "Synthetic backup" },
  acknowledgedAt: null,
  acknowledgedByUserId: null,
  respondedAt: null,
  resolvedAt: null,
  evidenceChecklist: null,
  providerSubmissionReference: null,
  updatedAt: "2026-09-17T09:00:00Z",
  hasEvidence: false,
});
