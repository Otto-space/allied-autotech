import styles from "./part-fitment-summary.module.css";
import { fitmentLabels, type FitmentDecision } from "@/lib/parts-fitment";

export function PartFitmentSummary({ decision }: { decision?: FitmentDecision }) {
  const status = decision?.status ?? "UNKNOWN";
  const label =
    status === "VERIFIED_FIT"
      ? decision?.scope === "UNIVERSAL"
        ? "Universal accessory"
        : "Verified fit"
      : status === "NEEDS_VERIFICATION"
        ? "Needs verification"
        : status === "NOT_COMPATIBLE"
          ? "Not compatible"
          : "Fitment unknown";
  return (
    <div className={`${styles.summary} ${styles[status]}`}>
      <strong>{label}</strong>
      <p>
        {decision?.message ??
          "Choose your vehicle to check approved fitment evidence. Make, model and year alone do not confirm suitability."}
      </p>
      {!!decision?.missingQualifiers.length && (
        <small>
          Confirm:{" "}
          {decision.missingQualifiers.map((key) => fitmentLabels[key]).join(", ")}.
        </small>
      )}
    </div>
  );
}
