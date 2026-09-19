import type { Promotion } from "@/lib/api/promotion-schemas";
import { koboToInput } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
export function formatPromotionDate(value: string) {
  return (
    new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    }).format(new Date(value)) + " (Lagos time)"
  );
}
export function promotionDiscount(
  item: Pick<Promotion, "discountType" | "percentageBasisPoints" | "fixedAmountKobo">,
) {
  return item.discountType === "PERCENTAGE"
    ? `${koboToInput(String(item.percentageBasisPoints))}%`
    : formatKobo(item.fixedAmountKobo ?? "0");
}
export function PromotionSummary({ item }: { item: Promotion }) {
  return (
    <dl className="totals">
      <dt>Code</dt>
      <dd>{item.code ?? "No redemption code"}</dd>
      <dt>Discount</dt>
      <dd>{promotionDiscount(item)}</dd>
      <dt>Configuration</dt>
      <dd>{item.isActive ? "Enabled" : "Disabled"}</dd>
      <dt>Starts</dt>
      <dd>{formatPromotionDate(item.startsAt)}</dd>
      <dt>Ends</dt>
      <dd>{formatPromotionDate(item.endsAt)}</dd>
      <dt>Minimum subtotal</dt>
      <dd>
        {item.minimumOrderAmountKobo === null
          ? "Not set"
          : formatKobo(item.minimumOrderAmountKobo)}
      </dd>
      <dt>Discount cap</dt>
      <dd>
        {item.maximumDiscountAmountKobo === null
          ? "Not set"
          : formatKobo(item.maximumDiscountAmountKobo)}
      </dd>
      <dt>Total usage limit</dt>
      <dd>{item.usageLimit ?? "Not set"}</dd>
      <dt>Per-customer limit</dt>
      <dd>{item.perCustomerLimit ?? "Not set"}</dd>
    </dl>
  );
}
