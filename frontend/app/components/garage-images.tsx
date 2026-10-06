"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  parseGarageDetail,
  prepareGarageImage,
  validateGarageImage,
  garageDetailSchema,
} from "@/lib/api/garage-media";
import { useResource } from "@/lib/api/use-resource";
import { FileUpload, type AssetSelection } from "./file-upload";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import styles from "./garage-images.module.css";

type Garage = z.infer<typeof garageDetailSchema>;
function UploadSlot({
  id,
  vehicleId,
  disabled,
  attach,
  discard,
}: {
  id: number;
  vehicleId: string;
  disabled: boolean;
  attach: (selection: NonNullable<AssetSelection>) => void;
  discard: () => void;
}) {
  const [selection, setSelection] = useState<AssetSelection>(null);
  return (
    <div role="group" aria-label={`Photo upload ${id + 1}`}>
      <FileUpload
        uploadId={`garage-photo-file-${id}`}
        label="Choose a vehicle photo"
        hint="JPEG, PNG or WebP, up to 10 MiB. Each side must be between 32 and 8192 pixels."
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={setSelection}
        validate={validateGarageImage}
        prepare={(options) => prepareGarageImage(vehicleId, options)}
      />
      <div className="actions">
        <button
          className="button"
          disabled={!selection?.prepared || disabled}
          onClick={() => {
            if (selection?.prepared) attach(selection);
          }}
        >
          Add photo
        </button>
        <button className="button secondary" disabled={disabled} onClick={discard}>
          Discard this upload
        </button>
      </div>
    </div>
  );
}
function Gallery({
  vehicle,
  refresh,
  refreshing,
}: {
  vehicle: Garage;
  refresh: () => void;
  refreshing: boolean;
}) {
  const [slots, setSlots] = useState([0]);
  const nextSlot = useRef(1);
  const [proposal, setProposal] = useState<
    (MutationProposal & { uploadSlot?: number }) | null
  >(null);
  const [message, setMessage] = useState("");
  const [savedVersion, setSavedVersion] = useState(0);
  const waitingForRead = refreshing || savedVersion > vehicle.mediaVersion;
  const endpoint = `/customers/vehicles/${vehicle.id}/images`;
  function propose(
    title: string,
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body: unknown,
    facts: MutationProposal["facts"],
    uploadSlot?: number,
  ) {
    setProposal({
      title,
      description:
        method === "DELETE"
          ? "The image will be removed from your private garage. If it is the cover, the first remaining image becomes the cover."
          : "Review the image details before saving to your private garage.",
      facts,
      retrySafely: method === "POST",
      retryAfterRejection: false,
      onUncertain: refresh,
      submit: async () => {
        const response = await apiRequest(path, { method, csrf: true, body });
        setSavedVersion(
          z.object({ version: z.number().int().nonnegative() }).parse(response.data)
            .version,
        );
        return response;
      },
      uploadSlot,
    });
  }
  return (
    <>
      <Feedback message={message} tone="success" toast={message} />
      <p>
        Your garage photos are private and visible only to you. {vehicle.images.length} of
        12 images.
      </p>
      {!vehicle.images.length && (
        <div className="empty">No photos yet. Add your first vehicle photo below.</div>
      )}
      <div className={styles.grid}>
        {vehicle.images.map((image, index) => (
          <article
            key={`${image.id}:${vehicle.mediaVersion}`}
            className={styles.card}
            aria-label={`Vehicle photo ${index + 1}`}
          >
            <Image
              unoptimized
              src={image.url}
              alt={
                image.altText || `${vehicle.make} ${vehicle.model}, photo ${index + 1}`
              }
              width={600}
              height={400}
              className={styles.image}
            />
            <h2>
              Photo {index + 1}
              {image.isPrimary ? " · Cover" : ""}
            </h2>
            <form
              data-draft-key={JSON.stringify(["garage-images:1", vehicle?.id])}
              onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                const body: RequestBody<
                  "/customers/vehicles/{vehicleId}/images/{imageId}",
                  "patch"
                > = {
                  expectedVersion: vehicle.mediaVersion,
                  altText: String(values.get("altText") ?? "").trim() || null,
                  sortOrder: Number(values.get("sortOrder")),
                };
                propose("Save image details?", `${endpoint}/${image.id}`, "PATCH", body, [
                  { label: "Description", value: body.altText || "No description" },
                  { label: "Display order", value: String(body.sortOrder) },
                ]);
              }}
            >
              <fieldset disabled={!!proposal || waitingForRead} className={styles.fields}>
                <legend className="sr-only">Photo {index + 1} details</legend>
                <div className="field">
                  <label htmlFor={`alt-${image.id}`}>Image description</label>
                  <input
                    id={`alt-${image.id}`}
                    name="altText"
                    maxLength={240}
                    defaultValue={image.altText ?? ""}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`order-${image.id}`}>Display order</label>
                  <input
                    id={`order-${image.id}`}
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    required
                    defaultValue={image.sortOrder}
                  />
                </div>
                <button type="submit" className="button secondary">
                  Save image details
                </button>
              </fieldset>
            </form>
            <div className="actions">
              {!image.isPrimary && (
                <button
                  className="button secondary"
                  disabled={!!proposal || waitingForRead}
                  onClick={() => {
                    const body: RequestBody<
                      "/customers/vehicles/{vehicleId}/images/{imageId}",
                      "patch"
                    > = { expectedVersion: vehicle.mediaVersion, isPrimary: true };
                    propose(
                      "Use this photo as the cover?",
                      `${endpoint}/${image.id}`,
                      "PATCH",
                      body,
                      [{ label: "Photo", value: String(index + 1) }],
                    );
                  }}
                >
                  Make cover
                </button>
              )}
              <button
                className="button secondary"
                disabled={!!proposal || waitingForRead}
                onClick={() => {
                  const body: RequestBody<
                    "/customers/vehicles/{vehicleId}/images/{imageId}",
                    "delete"
                  > = { expectedVersion: vehicle.mediaVersion };
                  propose(
                    "Remove this vehicle photo?",
                    `${endpoint}/${image.id}`,
                    "DELETE",
                    body,
                    [{ label: "Photo", value: String(index + 1) }],
                  );
                }}
              >
                Remove photo
              </button>
            </div>
          </article>
        ))}
      </div>
      <section className={styles.upload} aria-labelledby="add-garage-photo">
        <h2 id="add-garage-photo">Add a vehicle photo</h2>
        {vehicle.images.length >= 12 && (
          <p className="notice">
            Your gallery is full. Remove a photo before adding another.
          </p>
        )}
        <p>
          Prepare several photos with separate previews and upload progress. Confirm each
          photo when it is ready.
        </p>
        {slots.map((slot) => (
          <UploadSlot
            key={slot}
            id={slot}
            vehicleId={vehicle.id}
            disabled={!!proposal || waitingForRead || vehicle.images.length >= 12}
            discard={() => {
              const replacement = nextSlot.current++;
              setSlots((current) =>
                current.length === 1
                  ? [replacement]
                  : current.filter((id) => id !== slot),
              );
            }}
            attach={(selection) => {
              if (!selection.prepared) return;
              const body: RequestBody<"/customers/vehicles/{vehicleId}/images", "post"> =
                {
                  assetToken: selection.prepared.token,
                  expectedVersion: vehicle.mediaVersion,
                  sortOrder: Math.min(
                    10000,
                    Math.max(-1, ...vehicle.images.map((image) => image.sortOrder)) + 1,
                  ),
                  isPrimary: false,
                };
              propose(
                "Add this photo to your garage?",
                endpoint,
                "POST",
                body,
                [{ label: "Selected file", value: selection.name }],
                slot,
              );
            }}
          />
        ))}
        <button
          className="button secondary"
          disabled={
            !!proposal || waitingForRead || slots.length + vehicle.images.length >= 12
          }
          onClick={() => {
            const id = nextSlot.current++;
            setSlots((current) => [...current, id]);
          }}
        >
          Prepare another photo
        </button>
      </section>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {
            if (proposal.uploadSlot !== undefined) {
              const replacement = nextSlot.current++;
              setSlots((current) => {
                const remaining = current.filter((id) => id !== proposal.uploadSlot);
                return remaining.length ? remaining : [replacement];
              });
            }
            setMessage("Your garage photos have been updated.");
            refresh();
          }}
        />
      )}
    </>
  );
}
export function GarageImages({ vehicleId }: { vehicleId: string }) {
  const vehicle = useResource(`/customers/vehicles/${vehicleId}`, parseGarageDetail);
  return (
    <>
      <Link href="/dashboard/vehicles" className="text-link">
        Back to your vehicles
      </Link>
      <div className="dashboard-page-heading">
        <div>
          <h1>Vehicle photos</h1>
          <p className="lead">
            {vehicle.data
              ? `${vehicle.data.year} ${vehicle.data.make} ${vehicle.data.model}`
              : "Your private garage gallery"}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={vehicle.refresh}
          disabled={vehicle.loading}
        >
          Refresh photos
        </button>
      </div>
      <Feedback message={vehicle.error} />
      {vehicle.loading && <p role="status">Loading vehicle photos…</p>}
      {vehicle.data && (
        <Gallery
          key={vehicleId}
          vehicle={vehicle.data}
          refresh={vehicle.refresh}
          refreshing={vehicle.loading}
        />
      )}
    </>
  );
}
