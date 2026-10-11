"use client";
import { useCallback, useRef, useState } from "react";
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
import { GaragePhotoReview, type PhotoProposal } from "./garage-photo-review";
import { profilePhotoSchema } from "@/lib/api/profile-schemas";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  LockKeyhole,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import styles from "./garage-images.module.css";

type Garage = z.infer<typeof garageDetailSchema>;
const resultSchema = z.object({
  version: z.number().int().nonnegative(),
  images: z.array(profilePhotoSchema).max(12),
});
function focusUploads() {
  const heading = document.getElementById("add-garage-photo");
  heading?.focus();
  heading?.scrollIntoView({ block: "center", behavior: "instant" });
}
function Photo({
  image,
  fallback,
}: {
  image: Garage["images"][number];
  fallback: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.imageFrame}>
      {failed ? (
        <div
          className={styles.imageError}
          role="img"
          aria-label={`${fallback}: image unavailable`}
        >
          <Camera size={28} aria-hidden="true" />
          <span>Photo unavailable</span>
        </div>
      ) : (
        <Image
          unoptimized
          src={image.url}
          alt={image.altText || fallback}
          width={image.width}
          height={image.height}
          className={styles.image}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
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
  hidden,
  imageRevision,
}: {
  vehicle: Garage;
  refresh: () => void;
  refreshing: boolean;
  hidden: boolean;
  imageRevision: number;
}) {
  const [slots, setSlots] = useState([0]);
  const nextSlot = useRef(1);
  const [proposal, setProposal] = useState<PhotoProposal | null>(null);
  const [message, setMessage] = useState("");
  const [savedVersion, setSavedVersion] = useState(0);
  const waitingForRead = refreshing || savedVersion > vehicle.mediaVersion;
  const endpoint = `/customers/vehicles/${vehicle.id}/images`;
  function propose(
    title: string,
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body: unknown,
    facts: PhotoProposal["facts"],
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
      submit: async () => {
        const response = await apiRequest(path, { method, csrf: true, body });
        const parsed = resultSchema.parse(response.data);
        if (parsed.version <= vehicle.mediaVersion)
          throw new Error("Unconfirmed image version");
        return parsed.version;
      },
      uploadSlot,
    });
  }
  return (
    <div hidden={hidden}>
      <Feedback message={message} tone="success" toast={message} />
      <div className={styles.privacy}>
        <LockKeyhole size={24} aria-hidden="true" />
        <div>
          <h2>Private vehicle photos</h2>
          <p>Only you can view these photos.</p>
        </div>
        <span>{vehicle.images.length} of 12 photos</span>
      </div>
      <div className={styles.workspace}>
        <div>
          {!vehicle.images.length && (
            <div className={styles.empty}>
              <Camera size={32} aria-hidden="true" />
              <h2>No photos yet</h2>
              <p>Add your first vehicle photo to keep your gallery together.</p>
              <button
                className="button secondary"
                disabled={waitingForRead}
                onClick={focusUploads}
              >
                Add your first photo
              </button>
            </div>
          )}
          <div className={styles.grid}>
            {vehicle.images.map((image, index) => (
              <article
                key={`${image.id}:${vehicle.mediaVersion}`}
                className={styles.card}
                aria-label={`Vehicle photo ${index + 1}`}
              >
                <Photo
                  key={`${image.id}:${imageRevision}`}
                  image={image}
                  fallback={`${vehicle.make} ${vehicle.model}, photo ${index + 1}`}
                />
                <h2>
                  Photo {index + 1}
                  {image.isPrimary ? " · Cover" : ""}
                </h2>
                <form
                  data-draft-key={JSON.stringify([
                    "garage-images:2",
                    vehicle.id,
                    image.id,
                  ])}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (proposal || waitingForRead) return;
                    const values = new FormData(event.currentTarget);
                    const body: RequestBody<
                      "/customers/vehicles/{vehicleId}/images/{imageId}",
                      "patch"
                    > = {
                      expectedVersion: vehicle.mediaVersion,
                      altText: String(values.get("altText") ?? "").trim() || null,
                      sortOrder: Number(values.get("sortOrder")),
                    };
                    propose(
                      "Save image details?",
                      `${endpoint}/${image.id}`,
                      "PATCH",
                      body,
                      [
                        { label: "Description", value: body.altText || "No description" },
                        { label: "Display order", value: String(body.sortOrder) },
                      ],
                    );
                  }}
                >
                  <fieldset
                    disabled={!!proposal || waitingForRead}
                    className={styles.fields}
                  >
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
                    <div className={styles.orderRow}>
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
                    </div>
                  </fieldset>
                </form>
                <div className={styles.photoActions}>
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
                      <Star size={16} aria-hidden="true" />
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
                    <Trash2 size={16} aria-hidden="true" />
                    Remove photo
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
        <section className={styles.upload} aria-labelledby="add-garage-photo">
          <h2 id="add-garage-photo" tabIndex={-1}>
            Add a vehicle photo
          </h2>
          {vehicle.images.length >= 12 && (
            <p className="notice">
              Your gallery is full. Remove a photo before adding another.
            </p>
          )}
          <p>Prepare each photo, then confirm it for your gallery.</p>
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
                const body: RequestBody<
                  "/customers/vehicles/{vehicleId}/images",
                  "post"
                > = {
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
      </div>
      {proposal && (
        <GaragePhotoReview
          proposal={proposal}
          onClose={(attempted) => {
            setProposal(null);
            if (attempted) refresh();
          }}
          onSuccess={(version) => {
            setSavedVersion(version);
            setProposal(null);
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
    </div>
  );
}
export function GarageImages({ vehicleId }: { vehicleId: string }) {
  const parse = useCallback(
    (value: unknown) => {
      const parsed = parseGarageDetail(value);
      if (parsed.id !== vehicleId) throw new Error("Vehicle identity mismatch");
      return parsed;
    },
    [vehicleId],
  );
  const vehicle = useResource(`/customers/vehicles/${vehicleId}`, parse);
  const available = !!vehicle.data && !vehicle.loading && !vehicle.error;
  const identity = available
    ? `${vehicle.data!.year} ${vehicle.data!.make} ${vehicle.data!.model}`
    : "Vehicle photos";
  return (
    <section className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
            <ChevronRight size={14} aria-hidden="true" />
          </li>
          <li>
            <Link href="/dashboard/vehicles">My vehicles</Link>
            <ChevronRight size={14} aria-hidden="true" />
          </li>
          <li aria-current="page" title={identity}>
            {identity}
          </li>
        </ol>
      </nav>
      <header className={styles.heading}>
        <div>
          <h1>Vehicle photos</h1>
          <p>
            {available ? (
              <>
                {identity}
                {vehicle.data!.registrationNumber
                  ? ` · ${vehicle.data!.registrationNumber}`
                  : ""}
              </>
            ) : (
              "Your private garage gallery"
            )}
          </p>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            onClick={vehicle.refresh}
            disabled={vehicle.loading || vehicle.refreshing}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh photos
          </button>
          <button
            id="garage-add"
            className="button"
            onClick={focusUploads}
            disabled={!available || vehicle.refreshing || !!vehicle.refreshError}
          >
            <Plus size={18} aria-hidden="true" />
            Add photos
          </button>
        </div>
      </header>
      {vehicle.loading && (
        <div className={styles.loading} role="status">
          <p>Loading vehicle photos…</p>
          <div aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      {vehicle.error && (
        <div className={styles.empty}>
          <LockKeyhole size={28} aria-hidden="true" />
          <h2>Vehicle photos unavailable</h2>
          <Feedback message={vehicle.error} />
          <button className="button secondary" onClick={vehicle.refresh}>
            Retry photos
          </button>
        </div>
      )}
      {vehicle.refreshError && (
        <p role="alert" className={styles.stale}>
          These photos may be out of date. Refresh before making changes.
        </p>
      )}
      {vehicle.refreshing && <p role="status">Updating vehicle photos…</p>}
      {vehicle.data && (
        <Gallery
          key={vehicleId}
          vehicle={vehicle.data}
          refresh={vehicle.refresh}
          refreshing={
            vehicle.loading ||
            vehicle.refreshing ||
            !!vehicle.refreshError ||
            !!vehicle.error
          }
          hidden={!available}
          imageRevision={vehicle.settledRevision ?? -1}
        />
      )}
      <Link href="/dashboard/vehicles" className={styles.back}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to your vehicles
      </Link>
    </section>
  );
}
