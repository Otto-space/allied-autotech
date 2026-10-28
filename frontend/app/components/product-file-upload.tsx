"use client";
import { useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { prepareProductImage, validateProductImage } from "@/lib/api/product-media";
import { FileUpload, type AssetSelection } from "./file-upload";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";

export function ProductFileUpload({
  productId,
  version,
  disabled,
  refresh,
  onSaved,
  onCancel,
  onPendingChange,
}: {
  productId: string;
  version: number;
  disabled: boolean;
  refresh: () => void;
  onSaved: (version: number) => void;
  onCancel: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [selection, setSelection] = useState<AssetSelection>(null);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [error, setError] = useState("");
  const savedVersion = useRef<number>(undefined);
  return (
    <section className="detail-section" aria-labelledby="product-upload-heading">
      <h3 id="product-upload-heading">Upload file</h3>
      <p>
        Upload a photo from your device, then review its placement in the product gallery.
      </p>
      <FileUpload
        uploadId="product-image-file"
        label="Choose a product image"
        hint="Non-animated JPEG, PNG or WebP, up to 10 MiB and 40 million pixels. Each side must be 32–8192 pixels and remain at least 32 pixels after resizing to fit 2048 pixels."
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || !!proposal}
        onChange={setSelection}
        validate={validateProductImage}
        prepare={(options) => prepareProductImage(productId, options)}
      />
      <Feedback message={error} />
      <form
        data-draft-key={JSON.stringify(["product-file-upload:1", productId])}
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || proposal || !selection?.prepared) return;
          if (selection.prepared.expiresAt <= Date.now()) {
            setError(
              "This prepared upload expired. Upload the selected file again; your description and placement are preserved.",
            );
            return;
          }
          setError("");
          const values = new FormData(event.currentTarget);
          const altText = String(values.get("altText") ?? "").trim();
          const sortOrder = Number(values.get("sortOrder")) - 1;
          const isPrimary = values.has("isPrimary");
          const body: RequestBody<
            "/admin/catalog/products/{productId}/images/confirm",
            "post"
          > = {
            assetToken: selection.prepared.token,
            expectedVersion: version,
            altText: altText || null,
            sortOrder,
            isPrimary,
          };
          setProposal({
            title: "Attach uploaded product image?",
            description:
              "The image will appear publicly when the product and its category are active. Existing photos stay in place.",
            facts: [
              { label: "File", value: selection.name },
              { label: "Description", value: altText || "Product name used as fallback" },
              { label: "Display order", value: String(sortOrder + 1) },
              { label: "Main image", value: isPrimary ? "Yes" : "No" },
            ],
            retrySafely: true,
            retryAfterRejection: false,
            onUncertain: () => {
              onPendingChange?.(true);
              refresh();
            },
            submit: async () => {
              onPendingChange?.(true);
              try {
                const response = await apiRequest(
                  `/admin/catalog/products/${productId}/images/confirm`,
                  { method: "POST", csrf: true, body },
                );
                savedVersion.current = z
                  .object({ version: z.number().int().nonnegative() })
                  .parse(response.data).version;
                onPendingChange?.(false);
                return response;
              } catch (error) {
                if (
                  error instanceof ApiError &&
                  error.status >= 400 &&
                  error.status < 500
                )
                  onPendingChange?.(false);
                throw error;
              }
            },
          });
        }}
      >
        <fieldset className="handover-fields" disabled={disabled || !!proposal}>
          <div className="field">
            <label htmlFor="product-upload-alt">
              Image description (alt text, optional)
            </label>
            <input id="product-upload-alt" name="altText" maxLength={240} />
          </div>
          <div className="field">
            <label htmlFor="product-upload-order">Display order (1 first)</label>
            <input
              id="product-upload-order"
              name="sortOrder"
              type="number"
              min={1}
              max={10001}
              step={1}
              defaultValue={1}
              required
            />
          </div>
          <label className="check-label">
            <input name="isPrimary" type="checkbox" /> Use as main image
          </label>
          <div className="actions">
            <button className="button" disabled={!selection?.prepared}>
              Review uploaded image
            </button>
          </div>
        </fieldset>
      </form>
      <div className="actions">
        <button
          type="button"
          className="button secondary"
          disabled={!!proposal}
          onClick={onCancel}
        >
          Cancel file upload
        </button>
      </div>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {
            if (savedVersion.current !== undefined) onSaved(savedVersion.current);
          }}
        />
      )}
    </section>
  );
}
