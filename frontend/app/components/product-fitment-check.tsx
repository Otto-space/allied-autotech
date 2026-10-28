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
import { usePartsMakeCatalogue } from "./find-parts-for-car";

const parseDecision = (value: unknown) => fitmentDecisionSchema.parse(value);
export function ProductFitmentCheck({ productId }: { productId: string }) {
  const search = useSearchParams();
  const makes = usePartsMakeCatalogue();
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
  const noVehicleChoices =
    !params.has("vehicleModelId") &&
    !makes.loading &&
    !makes.error &&
    !makes.refreshError &&
    makes.data?.items.length === 0;
  const vehicleChoicesFailed =
    !params.has("vehicleModelId") &&
    !makes.loading &&
    !makes.data?.items.length &&
    !!(makes.error || makes.refreshError);
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
        <PartFitmentSummary
          decision={result.data}
          unknownMessage={
            noVehicleChoices
              ? "Vehicle choices are not available in the parts finder yet. Ask our team to check suitability before requesting this product."
              : vehicleChoicesFailed
                ? "Vehicle choices could not be checked right now. Retry below or ask our team to verify suitability."
                : undefined
          }
        />
      )}
      <div className="actions">
        {vehicleChoicesFailed && (
          <button className="button secondary" type="button" onClick={makes.refresh}>
            Retry vehicle choices
          </button>
        )}
        <Link
          className="pd-link"
          href={`/parts${selection.size ? `?${selection}` : ""}#products`}
        >
          {params.has("vehicleModelId") || makes.data?.items.length
            ? "Choose or update my vehicle"
            : "Browse products"}
        </Link>
        <Link className="button secondary" href={partsEnquiryHref(params, productId)}>
          Request the right part
        </Link>
      </div>
    </div>
  );
}
