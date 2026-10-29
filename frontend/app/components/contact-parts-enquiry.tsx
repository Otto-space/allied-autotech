"use client";

import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { categorySchema, productSchema } from "@/lib/api/commerce-schemas";
import { listingSchema } from "@/lib/api/vehicle-schemas";
import { parseFitmentModel } from "@/lib/parts-fitment";
import {
  catalogueEnquiryContext,
  productEnquiryDraft,
  vehicleEnquiryDraft,
} from "@/lib/catalogue-enquiry";
import { PublicEnquiryForm } from "./public-enquiry-form";
import { CatalogueEnquiryDrafts } from "./catalogue-enquiry-drafts";

const parseProduct = (value: unknown) => productSchema.parse(value);
const parseCategory = (value: unknown) => categorySchema.parse(value);
const parseListing = (value: unknown) => listingSchema.parse(value);
const uuid = (value: string | null) => (z.uuid().safeParse(value).success ? value! : "");

/** Transfer values are editable context, never identity, permissions or redirects. */
export function ContactPartsEnquiry({
  onlyParts = false,
  labelledBy,
}: {
  onlyParts?: boolean;
  labelledBy?: string;
}) {
  const input = useSearchParams();
  const params = new URLSearchParams(input.toString());
  if (onlyParts && params.get("parts") !== "1" && params.get("vehicle") !== "1")
    return null;
  const incoming = catalogueEnquiryContext(params);
  return (
    <CatalogueEnquiryDrafts incoming={incoming}>
      {(context) => {
        const selected = new URL(context.href, "https://catalogue.invalid").searchParams;
        return selected.get("vehicle") === "1" ? (
          <VehicleEnquiryContext
            key={context.id}
            params={selected}
            contextKey={context.contextKey}
            labelledBy={labelledBy}
          />
        ) : selected.get("parts") === "1" ? (
          <ProductEnquiryContext
            key={context.id}
            params={selected}
            contextKey={context.contextKey}
            labelledBy={labelledBy}
          />
        ) : (
          <PublicEnquiryForm
            key={context.id}
            presentation="contact"
            labelledBy={labelledBy}
          />
        );
      }}
    </CatalogueEnquiryDrafts>
  );
}

function VehicleEnquiryContext({
  params,
  contextKey,
  labelledBy,
}: {
  params: URLSearchParams;
  contextKey?: string;
  labelledBy?: string;
}) {
  const listingRequested = params.has("vehicle_listingId");
  const id = uuid(params.get("vehicle_listingId"));
  const listing = useResource(id ? `/public/vehicles/${id}` : null, parseListing);
  if (listing.loading) return <p role="status">Preparing your vehicle enquiry…</p>;
  if (
    listingRequested &&
    (!id || listing.data?.id !== id || listing.error || listing.refreshError)
  )
    return (
      <div role="status" className="notice">
        <p>
          This listing could not be verified. Your draft is kept; it has not been changed
          to a vehicle requirements request.
        </p>
        {id && (
          <button className="button secondary" type="button" onClick={listing.refresh}>
            Retry listing check
          </button>
        )}
      </div>
    );
  const draft = vehicleEnquiryDraft(params, listing.data?.title);
  return (
    <>
      <p className="notice">
        Your vehicle preferences are included below. Review and edit them before sending.
        An enquiry does not reserve a vehicle or guarantee sourcing.
      </p>
      {draft.invalid && (
        <p role="status">
          Some invalid preferences were omitted. Review the details before sending.
        </p>
      )}
      <PublicEnquiryForm
        presentation="contact"
        initialEnquiryType="VEHICLE"
        labelledBy={labelledBy}
        initialVehicleEnquiryIntent={listingRequested ? "LISTING" : "REQUIREMENTS"}
        initialSubject={draft.subject}
        initialMessage={draft.message}
        initialContextKey={contextKey}
        vehicleListingId={listing.data?.id}
        vehicleListingTitle={listing.data?.title}
      />
    </>
  );
}

function ProductEnquiryContext({
  params,
  contextKey,
  labelledBy,
}: {
  params: URLSearchParams;
  contextKey?: string;
  labelledBy?: string;
}) {
  const modelId = uuid(params.get("part_vehicleModelId"));
  const productId = uuid(params.get("part_productId"));
  const categoryId = uuid(params.get("part_categoryId"));
  const model = useResource(
    modelId ? `/public/fitment/models/${modelId}` : null,
    parseFitmentModel,
  );
  const product = useResource(
    productId ? `/public/catalog/products/${productId}` : null,
    parseProduct,
  );
  const category = useResource(
    categoryId ? `/public/catalog/categories/${categoryId}` : null,
    parseCategory,
  );
  if (model.loading || product.loading || category.loading)
    return <p role="status">Preparing your product enquiry…</p>;
  const year = params.get("part_year") ?? "";
  const validModel =
    model.data?.id === modelId &&
    /^\d{4}$/.test(year) &&
    +year >= model.data.yearFrom &&
    +year <= model.data.yearTo &&
    (!params.has("part_vehicleMakeId") ||
      params.get("part_vehicleMakeId") === model.data.makeId)
      ? model.data
      : undefined;
  const validProduct = product.data?.id === productId ? product.data : undefined;
  const draft = productEnquiryDraft(params, {
    productName: validProduct?.name,
    sku: validProduct?.sku,
    categoryName: category.data?.id === categoryId ? category.data.name : undefined,
    vehicleName: validModel
      ? `${validModel.make.name} ${validModel.name}, model year ${year}`
      : undefined,
  });
  return (
    <>
      <p className="notice">
        Your product details are included below. Review and edit them before sending. This
        request does not confirm suitability, reserve stock or place an order.
      </p>
      {(draft.invalid || (modelId && !validModel) || (productId && !validProduct)) && (
        <p role="status">
          Some linked or invalid details are unavailable. Describe what you need below so
          our team can check.
        </p>
      )}
      <PublicEnquiryForm
        presentation="contact"
        initialEnquiryType="PRODUCT"
        labelledBy={labelledBy}
        initialSubject={draft.subject}
        initialMessage={draft.message}
        initialContextKey={contextKey}
        productId={validProduct?.id}
        productName={validProduct?.name}
      />
    </>
  );
}
