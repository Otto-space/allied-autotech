"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useResource } from "@/lib/api/use-resource";
import { normalizeProductQuery } from "@/lib/product-discovery";
import {
  fitmentDecisionSchema,
  partsEnquiryHref,
  vehicleSelectionKeys,
} from "@/lib/parts-fitment";
import { PartFitmentSummary } from "./part-fitment-summary";
import { Feedback } from "./feedback";

const parseDecision = (value: unknown) => fitmentDecisionSchema.parse(value);
export function ProductFitmentCheck({ productId }: { productId: string }) {
  const search = useSearchParams();
  const { params } = normalizeProductQuery(new URLSearchParams(search.toString()));
  const selection = new URLSearchParams();
  for (const key of vehicleSelectionKeys)
    if (key !== "fitment" && params.has(key)) selection.set(key, params.get(key)!);
  const result = useResource(
    params.has("vehicleModelId")
      ? `/public/fitment/products/${productId}?${selection}`
      : null,
    parseDecision,
  );
  return (
    <div className="product-configuration-fitment">
      {result.loading ? (
        <p role="status">Checking approved fitment evidence…</p>
      ) : result.error ? (
        <>
          <Feedback message={result.error} />
          <button className="button secondary" type="button" onClick={result.refresh}>
            Retry fitment check
          </button>
        </>
      ) : (
        <PartFitmentSummary decision={result.data} />
      )}
      <div className="actions">
        <Link
          className="pd-link"
          href={`/parts${selection.size ? `?${selection}` : ""}#products`}
        >
          Choose or update my vehicle
        </Link>
        <Link className="button secondary" href={partsEnquiryHref(params, productId)}>
          Request the right part
        </Link>
      </div>
    </div>
  );
}
