"use client";
import Link from "next/link";
import { useResource } from "@/lib/api/use-resource";
import {
  parseFitmentModel,
  fitmentQualifierKeys,
  fitmentLabels,
} from "@/lib/parts-fitment";
import type { PurchaseSelection } from "@/lib/purchase/suitability";
import styles from "./cart-vehicle-summary.module.css";

export function CartVehicleSummary({
  selection,
  productId,
}: {
  selection?: PurchaseSelection | null;
  productId: string;
}) {
  const model = useResource(
    selection ? `/public/fitment/models/${selection.vehicleModelId}` : null,
    parseFitmentModel,
  );
  if (!selection) return null;
  const query = new URLSearchParams(
    Object.entries(selection).map(([key, value]) => [key, String(value)]),
  );
  const qualifiers = fitmentQualifierKeys
    .filter((key) => selection[key])
    .map((key) => `${fitmentLabels[key]}: ${selection[key]}`)
    .join(" · ");
  return (
    <div className={styles.summary}>
      <p>
        {model.data
          ? `For ${model.data.make.name} ${model.data.name}, ${selection.year}`
          : `Vehicle choice saved · ${selection.year}`}
      </p>
      {qualifiers && <p>{qualifiers}</p>}
      {(model.error || model.refreshError) && (
        <p role="status">Vehicle names could not be loaded. Your choice is retained.</p>
      )}
      <Link href={`/parts/${productId}?${query}`}>Review or change vehicle</Link>
    </div>
  );
}
