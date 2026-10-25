"use client";

import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { categorySchema, productSchema } from "@/lib/api/commerce-schemas";
import {
  fitmentLabels,
  fitmentQualifierKeys,
  parseFitmentModel,
} from "@/lib/parts-fitment";
import { PublicEnquiryForm } from "./public-enquiry-form";

const parseProduct = (value: unknown) => productSchema.parse(value);
const parseCategory = (value: unknown) => categorySchema.parse(value);
const text = z
  .string()
  .trim()
  .max(100)
  .refine((value) =>
    [...value].every(
      (char) => (char.codePointAt(0) ?? 0) > 31 && char.codePointAt(0) !== 127,
    ),
  );
const uuid = (value: string | null) => (z.uuid().safeParse(value).success ? value! : "");

/** URL values supply editable enquiry context, never identity, ownership or redirects. */
export function ContactPartsEnquiry({ onlyParts = false }: { onlyParts?: boolean }) {
  const params = useSearchParams();
  const enabled = params.get("parts") === "1";
  const modelId = enabled ? uuid(params.get("part_vehicleModelId")) : "";
  const productId = enabled ? uuid(params.get("part_productId")) : "";
  const categoryId = enabled ? uuid(params.get("part_categoryId")) : "";
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
  if (!enabled) return onlyParts ? null : <PublicEnquiryForm presentation="contact" />;
  if (model.loading || product.loading || category.loading)
    return <p role="status">Preparing your parts enquiry…</p>;
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
  const details = [
    ...fitmentQualifierKeys.flatMap((key) => {
      const parsed = text.safeParse(params.get(`part_${key}`) ?? "");
      return parsed.success && parsed.data
        ? [`${fitmentLabels[key]}: ${parsed.data}`]
        : [];
    }),
    ...(category.data?.id === categoryId
      ? [`Requested category: ${category.data.name}`]
      : []),
    ...(validProduct
      ? [`Requested product: ${validProduct.name} (SKU ${validProduct.sku}).`]
      : []),
    ...["search", "brand", "productType", "condition", "classification"].flatMap(
      (key) => {
        const parsed = text.safeParse(params.get(`part_${key}`) ?? "");
        return parsed.success && parsed.data
          ? [`Requested ${key === "search" ? "part / search" : key}: ${parsed.data}`]
          : [];
      },
    ),
  ];
  const lines = [
    "Please help me verify the right part.",
    ...(validModel
      ? [`Vehicle: ${validModel.make.name} ${validModel.name}, model year ${year}.`]
      : ["Vehicle: please add the make, model and year below."]),
    ...details,
    "Make, model and year alone do not confirm compatibility. Please verify the necessary specifications before collection.",
    "Collection only. I understand delivery is unavailable.",
    "",
    "Additional details:",
  ];
  const subject =
    `Parts verification${validModel ? `: ${validModel.make.name} ${validModel.name} ${year}` : " request"}`.slice(
      0,
      160,
    );
  const message = lines.join("\n").slice(0, 3500);
  const hasContext = !!validModel || details.length > 0;
  return (
    <>
      <p className="notice">
        {hasContext
          ? "Your available vehicle or part details are included below. Review and edit them before sending."
          : "Add the part name or number and any vehicle details you know below."}{" "}
        This request does not confirm fitment, reserve stock or place an order.
      </p>
      {((modelId && !validModel) || (productId && !validProduct)) && (
        <p role="status">
          Some linked details are unavailable. Describe the vehicle and part in your
          message so our team can check them.
        </p>
      )}
      <PublicEnquiryForm
        key={params.toString()}
        presentation="contact"
        initialSubject={subject}
        initialMessage={message}
        initialContextKey={params.toString()}
        initialEnquiryType="PRODUCT"
        productId={validProduct?.id}
        productName={validProduct?.name}
      />
    </>
  );
}
