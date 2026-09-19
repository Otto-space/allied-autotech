"use client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { imageFormSchema, type ProductImageValues } from "@/lib/forms/product-extras";
import type { ProductImage } from "@/lib/api/product-extras-schemas";
import { isPublicMediaUrl, publicMediaHosts } from "@/lib/media";
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
  const form = useForm<ProductImageValues>({
    resolver: zodResolver(imageFormSchema),
    defaultValues: {
      url: item?.url ?? "",
      altText: item?.altText ?? "",
      sortOrder: item?.sortOrder.toString() ?? "0",
      isPrimary: item?.isPrimary ?? false,
    },
  });
  const url = useWatch({ control: form.control, name: "url" });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((value) => {
        if (!disabled) onReview(value);
      })}
    >
      <h3>{item ? "Edit product image" : "Add product image"}</h3>
      <p>
        Use an approved, durable public image URL. Do not paste private or expiring
        download links. Files must already be hosted; direct product-image upload is
        unavailable.
      </p>
      {url && !isPublicMediaUrl(url, hosts) && (
        <p className="notice">
          This URL is not approved for display by this site. A valid HTTPS URL can be
          saved, but its image will stay unavailable until its host is approved.
        </p>
      )}
      <fieldset className="handover-fields" disabled={disabled}>
        {(
          [
            { name: "url", label: "Public image URL", max: 2048 },
            { name: "altText", label: "Image description (optional)", max: 250 },
            { name: "sortOrder", label: "Sort position", max: 5 },
          ] as const
        ).map((field) => (
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
          Smaller sort positions appear first. The primary image is used for the main
          product preview.
        </p>
        <label className="check-label">
          <input type="checkbox" {...form.register("isPrimary")} /> Primary image
        </label>
        <button className="button secondary">Review product image</button>
      </fieldset>
      <button type="button" className="text-link" onClick={onCancel}>
        Cancel image edit
      </button>
    </form>
  );
}
