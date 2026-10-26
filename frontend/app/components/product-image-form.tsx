"use client";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  imageFormSchema,
  uploadedImageFormSchema,
  type ProductImageValues,
} from "@/lib/forms/product-extras";
import type { ProductImage } from "@/lib/api/product-extras-schemas";
import { isPublicMediaUrl, publicMediaHosts } from "@/lib/media";
import { PublicMedia } from "./public-media";
import { isDurablePublicImageUrl } from "@/lib/product-image-url";
const hosts = publicMediaHosts(process.env.NEXT_PUBLIC_MEDIA_HOSTS);
export function ProductImageForm({
  item,
  disabled,
  onReview,
  onCancel,
}: {
  item: ProductImage | null;
  disabled: boolean;
  onReview: (value: ProductImageValues) => void;
  onCancel: () => void;
}) {
  const uploaded = item?.source === "UPLOADED";
  const form = useForm<ProductImageValues>({
    resolver: zodResolver(
      (uploaded ? uploadedImageFormSchema : imageFormSchema).extend({
        sortOrder: z
          .string()
          .regex(/^\d+$/, "Enter a whole number.")
          .refine(
            (value) => Number(value) >= 1 && Number(value) <= 10001,
            "Use display order 1 to 10001.",
          ),
      }),
    ),
    defaultValues: {
      url: item?.url ?? "",
      altText: item?.altText ?? "",
      sortOrder: String((item?.sortOrder ?? 0) + 1),
      isPrimary: item?.isPrimary ?? false,
    },
  });
  const url = useWatch({ control: form.control, name: "url" });
  return (
    <form
      data-draft-key={JSON.stringify(["product-image-form:1", item?.id])}
      noValidate
      onSubmit={form.handleSubmit((value) => {
        if (!disabled)
          onReview({ ...value, sortOrder: String(Number(value.sortOrder) - 1) });
      })}
    >
      <h3>{item ? "Edit product image" : "Add product image"}</h3>
      {uploaded ? (
        <p>Edit the uploaded image’s description, display order or primary selection.</p>
      ) : (
        <p>
          Use an approved, durable public image URL. Do not paste private or expiring
          download links. Choose Upload file to add an image from your device.
        </p>
      )}
      {url && !uploaded && !isPublicMediaUrl(url, hosts) && (
        <p className="notice">
          This URL is not approved for display by this site. A valid HTTPS URL can be
          saved, but its image will stay unavailable until its host is approved.
        </p>
      )}
      {url &&
        (uploaded || (isPublicMediaUrl(url, hosts) && isDurablePublicImageUrl(url))) && (
          <div className="product-image-preview">
            <PublicMedia
              key={url}
              src={url}
              alt="Selected product image preview"
              adminPreview={uploaded}
            />
            <p className="field-hint">
              Preview only. Review and save to update this product.
            </p>
          </div>
        )}
      <fieldset className="handover-fields" disabled={disabled}>
        {(
          [
            { name: "url", label: "Public image URL", max: 2048 },
            {
              name: "altText",
              label: "Image description (alt text, optional)",
              max: 250,
            },
            { name: "sortOrder", label: "Display order (1 first)", max: 5 },
          ] as const
        )
          .filter((field) => !uploaded || field.name !== "url")
          .map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`product-image-${field.name}`}>{field.label}</label>
              <input
                id={`product-image-${field.name}`}
                type={field.name === "url" ? "url" : "text"}
                inputMode={field.name === "sortOrder" ? "numeric" : undefined}
                maxLength={field.max}
                {...form.register(field.name)}
                aria-invalid={!!form.formState.errors[field.name]}
                aria-describedby={
                  form.formState.errors[field.name]
                    ? `product-image-${field.name}-error`
                    : undefined
                }
              />
              {form.formState.errors[field.name] && (
                <p
                  role="alert"
                  className="field-error"
                  id={`product-image-${field.name}-error`}
                >
                  {form.formState.errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
        <p className="field-hint">
          Describe what the photo shows. Smaller display orders appear first; tied orders
          use the saved image reference. Use gallery move controls for an exact position.
        </p>
        <label className="check-label">
          <input type="checkbox" {...form.register("isPrimary")} /> Use as main image
        </label>
        <button className="button secondary">Review product image</button>
      </fieldset>
      <button type="button" className="text-link" onClick={onCancel}>
        Cancel image edit
      </button>
    </form>
  );
}
