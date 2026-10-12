import type { PaymentDispute } from "@/lib/api/operations-schemas";
import { formatKobo } from "@/lib/format/money";

export function DisputeProviderFacts({
  dispute,
}: {
  dispute: Pick<
    PaymentDispute,
    | "chargebackAmountKobo"
    | "providerStatus"
    | "providerResolution"
    | "providerReviewReason"
  >;
}) {
  return (
    <>
      <dt>Confirmed chargeback</dt>
      <dd>
        {dispute.chargebackAmountKobo === null
          ? "Not confirmed"
          : formatKobo(dispute.chargebackAmountKobo)}
      </dd>
      {dispute.providerStatus && (
        <>
          <dt>Provider status</dt>
          <dd>{dispute.providerStatus.replaceAll("-", " ")}</dd>
        </>
      )}
      {dispute.providerResolution && (
        <>
          <dt>Provider resolution</dt>
          <dd>{dispute.providerResolution.replaceAll("-", " ")}</dd>
        </>
      )}
      {dispute.providerReviewReason && (
        <>
          <dt>Review required</dt>
          <dd>
            {dispute.providerReviewReason === "UNCONFIRMED_CHARGEBACK_AMOUNT"
              ? "The chargeback amount or resolution time is not confirmed. Check the provider record."
              : "The provider outcome needs review. No chargeback has been recorded from this observation."}
          </dd>
        </>
      )}
    </>
  );
}
