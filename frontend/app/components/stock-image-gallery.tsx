"use client";
import { useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import { PublicMedia } from "./public-media";
import { VehicleAttachmentForm } from "./vehicle-attachment-form";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";
type Photo = StaffVehicle["images"][number];
const receipt = z.object({ version: z.number().int() });
export function StockImageGallery({
  vehicle,
  disabled,
  onReview,
  onVersion,
}: {
  vehicle: StaffVehicle;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
  onVersion: (version: number) => void;
}) {
  const [editor, setEditor] = useState<{
    kind: "edit" | "replace";
    photo: Photo;
    version: number;
  } | null>(null);
  const constrained =
    vehicle.images.length === 1 &&
    vehicle.listings.some(
      (listing) => listing.status === "AVAILABLE" || listing.status === "RESERVED",
    );
  const stale = editor !== null && editor.version !== vehicle.version;
  function saved(version: number) {
    onVersion(version);
    setEditor(null);
  }
  function remove(photo: Photo) {
    if (disabled || constrained) return;
    const body: RequestBody<"/staff/vehicles/{vehicleId}/images/{imageId}", "delete"> = {
      expectedVersion: vehicle.version,
    };
    onReview({
      title: "Remove this vehicle photo?",
      description:
        "The photo will disappear from every listing for this vehicle. Removing the primary photo selects the first remaining photo. Owned files are queued for cleanup; external files stay with their host.",
      facts: [{ label: "Photo", value: photo.altText ?? "No description" }],
      retryAfterRejection: false,
      submit: async () => {
        const result = await apiRequest(
          `/staff/vehicles/${vehicle.id}/images/${photo.id}`,
          { method: "DELETE", csrf: true, body },
        );
        saved(receipt.parse(result.data).version);
      },
    });
  }
  return (
    <section className="detail-section" aria-labelledby="vehicle-photos-heading">
      <h2 id="vehicle-photos-heading">Vehicle photos</h2>
      <p>
        Photos are shared across this vehicle’s available listings. Upload approved public
        images only. Up to 20 photos; lower display orders appear first.
      </p>
      {constrained && (
        <p className="notice">
          Keep at least one photo while a listing is available or reserved. You can safely
          replace this photo.
        </p>
      )}
      {!vehicle.images.length && <p>No photos have been attached.</p>}
      <div className="record-grid">
        {vehicle.images.map((photo, index) => (
          <article
            className="vehicle-photo"
            key={photo.id}
            aria-label={`Vehicle photo ${index + 1}`}
          >
            <h3>
              Photo {index + 1}
              {photo.isPrimary ? " · Primary photo" : ""}
            </h3>
            <PublicMedia
              key={photo.url}
              src={photo.url}
              alt={photo.altText ?? `${vehicle.make} ${vehicle.model}`}
              stockPreview
            />
            <p>{photo.altText ?? "No photo description recorded"}</p>
            <p className="muted">Display order: {photo.sortOrder}</p>
            <div className="actions">
              <button
                className="button secondary"
                disabled={disabled || !!editor}
                onClick={() =>
                  setEditor({ kind: "edit", photo, version: vehicle.version })
                }
              >
                Edit photo {index + 1}
              </button>
              <button
                className="button secondary"
                disabled={disabled || !!editor}
                onClick={() =>
                  setEditor({ kind: "replace", photo, version: vehicle.version })
                }
              >
                Replace photo {index + 1}
              </button>
              <button
                className="button secondary"
                disabled={disabled || !!editor || constrained}
                onClick={() => remove(photo)}
              >
                Remove photo {index + 1}
              </button>
            </div>
          </article>
        ))}
      </div>
      {editor && (
        <section className="detail-section" aria-labelledby="stock-photo-editor">
          <h3 id="stock-photo-editor">
            {editor.kind === "edit" ? "Edit vehicle photo" : "Replace vehicle photo"}
          </h3>
          {stale && (
            <p className="notice" role="alert">
              The stock record changed. Your draft is still shown. Cancel and review the
              latest photo before making another change.
            </p>
          )}
          {editor.kind === "edit" ? (
            <PhotoEditor
              key={editor.photo.id}
              vehicleId={vehicle.id}
              photo={editor.photo}
              version={editor.version}
              disabled={disabled || stale}
              onReview={onReview}
              onVersion={saved}
            />
          ) : (
            <>
              <p>
                The current photo stays in place until the new image is verified.
                Replacement also works when the gallery is full.
              </p>
              <VehicleAttachmentForm
                key={editor.photo.id}
                vehicleId={vehicle.id}
                kind="IMAGE"
                expectedVersion={editor.version}
                replacement={editor.photo}
                disabled={disabled || stale}
                onReview={onReview}
                onVersion={saved}
              />
            </>
          )}
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => setEditor(null)}
          >
            Cancel photo {editor.kind === "edit" ? "edit" : "replacement"}
          </button>
        </section>
      )}
      {!editor &&
        (vehicle.images.length >= 20 ? (
          <p className="notice">
            The gallery is full. Replace an existing photo or remove one before adding
            another.
          </p>
        ) : (
          <details>
            <summary>Add a vehicle photo</summary>
            <VehicleAttachmentForm
              key={`image-${vehicle.version}`}
              vehicleId={vehicle.id}
              kind="IMAGE"
              expectedVersion={vehicle.version}
              disabled={disabled}
              onReview={onReview}
              onVersion={saved}
            />
          </details>
        ))}
    </section>
  );
}
function PhotoEditor({
  vehicleId,
  photo,
  version,
  disabled,
  onReview,
  onVersion,
}: {
  vehicleId: string;
  photo: Photo;
  version: number;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
  onVersion: (version: number) => void;
}) {
  const [alt, setAlt] = useState(photo.altText ?? "");
  const [order, setOrder] = useState(String(photo.sortOrder));
  const [primary, setPrimary] = useState(photo.isPrimary);
  const [error, setError] = useState<string>();
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        if (
          !/^\d{1,5}$/.test(order) ||
          Number(order) > 10000 ||
          alt.trim().length > 240
        ) {
          setError(
            "Use a display order from 0 to 10000 and a description of up to 240 characters.",
          );
          return;
        }
        setError(undefined);
        const body: RequestBody<"/staff/vehicles/{vehicleId}/images/{imageId}", "patch"> =
          {
            expectedVersion: version,
            altText: alt.trim() || null,
            sortOrder: Number(order),
            isPrimary: primary,
          };
        onReview({
          title: "Update this vehicle photo?",
          description:
            "Description, ordering and primary selection apply to all listings for this vehicle.",
          facts: [
            { label: "Description", value: alt.trim() || "No description" },
            { label: "Display order", value: order },
            { label: "Primary photo", value: primary ? "Yes" : "No" },
          ],
          retryAfterRejection: false,
          submit: async () => {
            const result = await apiRequest(
              `/staff/vehicles/${vehicleId}/images/${photo.id}`,
              { method: "PATCH", csrf: true, body },
            );
            onVersion(receipt.parse(result.data).version);
          },
        });
      }}
    >
      <Feedback message={error} />
      <fieldset className="handover-fields" disabled={disabled}>
        <div className="field">
          <label htmlFor="stock-photo-alt">Photo description (optional)</label>
          <input
            id="stock-photo-alt"
            value={alt}
            maxLength={240}
            onChange={(event) => setAlt(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="stock-photo-order">Photo display order</label>
          <input
            id="stock-photo-order"
            value={order}
            inputMode="numeric"
            maxLength={5}
            onChange={(event) => setOrder(event.target.value)}
          />
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={primary}
            onChange={(event) => setPrimary(event.target.checked)}
          />
          Use as the primary photo
        </label>
        <button className="button">Review photo changes</button>
      </fieldset>
    </form>
  );
}
