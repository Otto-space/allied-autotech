"use client";
import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  staffAftercareSchema,
  matchesAftercareOrder,
  type Aftercare,
  type AftercareOrder,
} from "@/lib/api/aftercare-schemas";
import { nairaToKobo } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
const labels = {
  RECEIVED: "Record returned goods received",
  INSPECTED: "Record condition inspection",
  APPROVED: "Approve request",
  REJECTED: "Reject request",
} as const;
type Stage = keyof typeof labels;
export function AftercareReview({
  record,
  order,
  disabled,
  canDecide,
  onSaved,
  onRefresh,
  onUncertain,
}: {
  record: Aftercare;
  order: AftercareOrder;
  disabled: boolean;
  canDecide: boolean;
  onSaved: () => void;
  onRefresh: () => void;
  onUncertain: () => void;
}) {
  const [stage, setStage] = useState<Stage | "">("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const attempted = useRef(false);
  if (record.status === "APPROVED" || record.status === "REJECTED") return null;
  const stages: Stage[] = [
    ...(record.kind === "RETURN" && record.status === "REQUESTED"
      ? ["RECEIVED" as const]
      : []),
    ...(record.kind === "RETURN" && record.status === "RECEIVED"
      ? ["INSPECTED" as const]
      : []),
    ...(canDecide
      ? [
          ...(record.kind === "CANCELLATION" || record.status === "INSPECTED"
            ? ["APPROVED" as const]
            : []),
          "REJECTED" as const,
        ]
      : []),
  ];
  function invalid(message: string, field: string) {
    setValidation(message);
    document.getElementById(`${record.id}-${field}`)?.focus();
  }
  function review(form: FormData) {
    if (disabled || proposal || !stage || !stages.includes(stage)) return;
    setValidation(undefined);
    const note = String(form.get("note") ?? "").trim();
    if (note.length < 20 || note.length > 2000) {
      invalid("Explain the recorded action in 20–2,000 characters.", "note");
      return;
    }
    const condition = String(form.get("goodCondition") ?? "");
    if (stage === "INSPECTED" && !["true", "false"].includes(condition)) {
      invalid("Record the actual inspected condition.", "condition");
      return;
    }
    let fee: string | undefined;
    if (stage === "APPROVED") {
      try {
        fee = nairaToKobo(String(form.get("fee") ?? ""));
        if (
          BigInt(fee) > BigInt(order.totalKobo) ||
          fee.length > 18 ||
          (record.kind === "CANCELLATION" && order.confirmedAt === null && fee !== "0")
        )
          throw new Error();
      } catch {
        invalid(
          "Enter an explicit fee within the order total, including zero. Cancellation before confirmation has no fee.",
          "fee",
        );
        return;
      }
    }
    const body: RequestBody<"/staff/order-requests/{id}/review", "post"> = {
      stage,
      note,
      expectedStatus: record.status,
      ...(stage === "INSPECTED" ? { goodCondition: condition === "true" } : {}),
      ...(fee !== undefined ? { approvedFeeKobo: fee } : {}),
    };
    setProposal({
      title: "Record this order review?",
      description:
        stage === "RECEIVED"
          ? "This records receipt and saves the note in the audit trail. It does not inspect goods or add them to stock."
          : stage === "INSPECTED"
            ? "This records the observed condition and an internal inspection note. It does not approve the request or restock goods."
            : "The decision note is visible to the customer. Approval does not cancel the order, restock goods, initiate a refund or mark money received. Those steps have separate controls.",
      facts: [
        { label: "Order", value: order.orderNumber },
        { label: "Action", value: labels[stage] },
        ...(stage === "INSPECTED"
          ? [{ label: "Good condition", value: condition === "true" ? "Yes" : "No" }]
          : []),
        ...(fee !== undefined ? [{ label: "Reviewed fee", value: formatKobo(fee) }] : []),
        { label: "Note", value: note },
      ],
      submit: async () => {
        attempted.current = true;
        const saved = staffAftercareSchema.parse(
          (
            await apiRequest(`/staff/order-requests/${record.id}/review`, {
              method: "POST",
              csrf: true,
              body,
            })
          ).data,
        );
        if (
          saved.id !== record.id ||
          saved.kind !== record.kind ||
          saved.items.length !== record.items.length ||
          !saved.items.every((item) =>
            record.items.some(
              (original) =>
                original.orderItemId === item.orderItemId &&
                original.quantity === item.quantity,
            ),
          ) ||
          !matchesAftercareOrder(saved, order) ||
          saved.status !== body.stage ||
          (body.stage === "RECEIVED" && !saved.receivedAt) ||
          (body.stage === "INSPECTED" &&
            (!saved.inspectedAt ||
              saved.goodCondition !== body.goodCondition ||
              saved.inspectionNote !== body.note)) ||
          (["APPROVED", "REJECTED"].includes(body.stage) &&
            (!saved.reviewedAt || saved.reviewNote !== body.note)) ||
          (body.stage === "APPROVED" && saved.approvedFeeKobo !== body.approvedFeeKobo)
        )
          throw new Error("Unexpected order review result");
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  return (
    <section className="detail-section">
      <h4>Review this request</h4>
      {!canDecide && (
        <p>
          Approval and rejection require an active financial-policy approval permission.
        </p>
      )}
      <Feedback message={validation} />
      {stages.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            review(new FormData(e.currentTarget));
          }}
        >
          <fieldset disabled={disabled}>
            <legend>Recorded action</legend>
            <div className="field">
              <label htmlFor={`${record.id}-stage`}>Next review action</label>
              <select
                id={`${record.id}-stage`}
                required
                value={stage}
                onChange={(e) => setStage(e.target.value as Stage)}
              >
                <option value="">Choose action</option>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </select>
            </div>
            {stage === "INSPECTED" && (
              <div className="field">
                <label htmlFor={`${record.id}-condition`}>Goods in good condition?</label>
                <select
                  id={`${record.id}-condition`}
                  name="goodCondition"
                  required
                  defaultValue=""
                >
                  <option value="">Choose observed condition</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            )}
            {stage === "APPROVED" && (
              <div className="field">
                <label htmlFor={`${record.id}-fee`}>
                  Reviewed fee (NGN, enter zero if none)
                </label>
                <input
                  className="input"
                  id={`${record.id}-fee`}
                  name="fee"
                  required
                  inputMode="decimal"
                />
                <p className="field-hint">
                  Order total: {formatKobo(order.totalKobo)}. Explain the monetary basis
                  in the note.
                </p>
              </div>
            )}
            <div className="field">
              <label htmlFor={`${record.id}-note`}>
                {stage === "INSPECTED"
                  ? "Internal inspection note"
                  : stage === "RECEIVED"
                    ? "Receipt audit note"
                    : "Decision note visible to the customer"}
              </label>
              <textarea
                id={`${record.id}-note`}
                name="note"
                required
                minLength={20}
                maxLength={2000}
              />
            </div>
            <button className="button">Review recorded action</button>
          </fieldset>
        </form>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Save order review"
          onClose={() => {
            setProposal(null);
            if (attempted.current) onRefresh();
            attempted.current = false;
          }}
          onSuccess={onSaved}
        />
      )}
    </section>
  );
}
