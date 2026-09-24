"use client";
import Link from "next/link";
import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { parsePromotion, type Promotion } from "@/lib/api/promotion-schemas";
import { promotionBody, type PromotionValues } from "@/lib/forms/promotion";
import { formatKobo } from "@/lib/format/money";
import { promotionDiscount, formatPromotionDate } from "./promotion-summary";
import { PromotionForm } from "./promotion-form";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
export function PromotionEditor({
  current,
  disabled = false,
  onRefresh,
}: {
  current?: Promotion;
  disabled?: boolean;
  onRefresh?: () => void;
}) {
  const [base, setBase] = useState(current);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [created, setCreated] = useState<Promotion>();
  const [message, setMessage] = useState<string>();
  const changed = !!base && current?.version !== base.version;
  function review(value: PromotionValues) {
    if (disabled || proposal || uncertain || changed) return;
    const body = promotionBody(value, base);
    const optionalMoney = (value: string | null | undefined) =>
      value == null ? "Not set" : formatKobo(value);
    setProposal({
      title: base ? "Review promotion changes" : "Review new promotion",
      description:
        "These settings affect future checkout eligibility. Existing order discount snapshots stay unchanged. Enabling a promotion does not guarantee eligibility or reserve its use.",
      facts: [
        { label: "Name", value: body.name },
        { label: "Code", value: body.code ?? "None; not redeemable by customers" },
        { label: "Description", value: body.description ?? "Not recorded" },
        {
          label: "Discount",
          value: promotionDiscount({
            discountType: body.discountType,
            percentageBasisPoints: body.percentageBasisPoints ?? null,
            fixedAmountKobo: body.fixedAmountKobo ?? null,
          }),
        },
        { label: "Minimum subtotal", value: optionalMoney(body.minimumOrderAmountKobo) },
        { label: "Discount cap", value: optionalMoney(body.maximumDiscountAmountKobo) },
        { label: "Total usage limit", value: body.usageLimit?.toString() ?? "Not set" },
        {
          label: "Per-customer limit",
          value: body.perCustomerLimit?.toString() ?? "Not set",
        },
        { label: "Starts", value: formatPromotionDate(body.startsAt) },
        { label: "Ends", value: formatPromotionDate(body.endsAt) },
        { label: "Configuration", value: body.isActive ? "Enabled" : "Disabled" },
      ],
      onUncertain: () => setUncertain(true),
      submit: async () => {
        try {
          const saved = parsePromotion(
            (
              await apiRequest<unknown>(
                base ? `/admin/promotions/${base.id}` : "/admin/promotions",
                {
                  method: base ? "PATCH" : "POST",
                  csrf: true,
                  body: base ? { ...body, expectedVersion: base.version } : body,
                },
              )
            ).data,
          );
          const matches = Object.entries(body).every(([key, value]) => {
            const actual = saved[key as keyof typeof body];
            return (key === "startsAt" || key === "endsAt") &&
              typeof value === "string" &&
              typeof actual === "string"
              ? Date.parse(actual) === Date.parse(value)
              : actual === value;
          });
          if (
            !matches ||
            (base && (saved.id !== base.id || saved.version !== base.version + 1))
          )
            throw new Error("Unexpected promotion response");
          if (base) setBase(saved);
          else setCreated(saved);
        } finally {
          onRefresh?.();
        }
      },
    });
  }
  return (
    <section className="detail-section">
      <h2>{base ? "Edit promotion" : "Promotion settings"}</h2>
      <Feedback message={message} tone="success" toast="Promotion change recorded." />
      {uncertain && (
        <p className="notice" role="status">
          The save could not be confirmed. Review the promotion records before making
          another change. This editor will not resend the request.
        </p>
      )}
      {changed && !uncertain && (
        <div className="notice">
          <p>
            This promotion has changed. Your draft is preserved. Reload the current
            settings before editing again.
          </p>
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => setBase(current)}
          >
            Reload promotion editor
          </button>
        </div>
      )}
      {created ? (
        <div className="notice success">
          <h3>Promotion created</h3>
          <p>
            {created.name} is{" "}
            {created.isActive ? "enabled, subject to its eligibility rules" : "disabled"}.
          </p>
          <Link className="text-link" href={`/admin/promotions/${created.id}`}>
            View created promotion
          </Link>
        </div>
      ) : (
        <PromotionForm
          key={base?.version ?? "new"}
          item={base}
          disabled={disabled || uncertain || changed}
          onReview={review}
        />
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() =>
            setMessage(
              base ? "Promotion changes confirmed." : "Promotion creation confirmed.",
            )
          }
        />
      )}
    </section>
  );
}
