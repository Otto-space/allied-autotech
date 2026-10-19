"use client";
import { useState } from "react";
import { Wrench } from "lucide-react";
import { ServicePhoto } from "./service-photo";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import {
  parseServiceImages,
  prepareServiceImage,
  validateServiceImage,
} from "@/lib/api/service-media";
import { FileUpload, type AssetSelection } from "./file-upload";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import styles from "./service-image.module.css";

export function ServiceImageEditor({
  serviceId,
  name,
  onUpdated,
  onClose,
  blocked = false,
}: {
  serviceId: string;
  name: string;
  onUpdated: () => void;
  onClose: () => void;
  blocked?: boolean;
}) {
  const endpoint = `/admin/services/${serviceId}`;
  const resource = useResource(`${endpoint}/images`, parseServiceImages);
  const [selection, setSelection] = useState<AssetSelection>(null);
  const [revision, setRevision] = useState(0);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);
  const [message, setMessage] = useState("");
  const image = resource.data?.images[0];
  const disabled =
    blocked ||
    !!proposal ||
    resource.loading ||
    resource.refreshing ||
    !!resource.error ||
    !!resource.refreshError ||
    !resource.data ||
    savedVersion > resource.data.version;
  function propose(
    title: string,
    path: string,
    method: "PUT" | "PATCH" | "DELETE",
    body: unknown,
    altText?: string,
  ) {
    setProposal({
      title,
      description:
        "Active services display this photo publicly. Inactive services keep it available for administrator preview.",
      facts: [
        { label: "Service", value: name },
        ...(altText ? [{ label: "Description", value: altText }] : []),
      ],
      retrySafely: method === "PUT",
      retryAfterRejection: false,
      onUncertain: resource.refresh,
      submit: async () => {
        const response = await apiRequest(path, { method, csrf: true, body });
        setSavedVersion(parseServiceImages(response.data).version);
        return response;
      },
    });
  }
  return (
    <section className="detail-section" aria-labelledby="service-image-title">
      <h2 id="service-image-title" tabIndex={-1}>
        Image for {name}
      </h2>
      <p>
        Choose one image for the service card and detail page. Services without a photo
        keep their existing presentation.
      </p>
      <Feedback message={resource.error} />
      <Feedback
        message={
          resource.refreshError
            ? "This image may be out of date. Refresh before making changes."
            : undefined
        }
        tone="info"
      />
      <Feedback message={message} tone="success" toast={message} />
      {resource.loading && <p role="status">Loading service image…</p>}
      <div className="actions">
        <button
          type="button"
          className="button secondary"
          disabled={resource.loading || !!proposal}
          onClick={resource.refresh}
        >
          Refresh image
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={!!proposal}
          onClick={onClose}
        >
          Close image editor
        </button>
      </div>
      {resource.data && !resource.error && (
        <>
          {image ? (
            <div className={styles.editor}>
              <ServicePhoto
                key={image.id}
                url={image.url}
                alt={image.altText || name}
                width={600}
                height={400}
              />
              <form
                data-draft-key={JSON.stringify(["service-image-editor:1", serviceId])}
                key={`${image.id}:${resource.data.version}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (disabled || !resource.data) return;
                  const altText = String(
                    new FormData(event.currentTarget).get("altText") ?? "",
                  ).trim();
                  const body: RequestBody<
                    "/admin/services/{serviceId}/images/{imageId}",
                    "patch"
                  > = {
                    expectedVersion: resource.data.version,
                    altText: altText || null,
                  };
                  propose(
                    "Save image description?",
                    `${endpoint}/images/${image.id}`,
                    "PATCH",
                    body,
                    altText,
                  );
                }}
              >
                <div className="field">
                  <label htmlFor="service-image-alt">Image description (optional)</label>
                  <input
                    id="service-image-alt"
                    name="altText"
                    maxLength={240}
                    defaultValue={image.altText ?? ""}
                    disabled={disabled}
                  />
                  <span className="field-hint">
                    Describe the visible work or equipment for people using screen
                    readers.
                  </span>
                </div>
                <div className="actions">
                  <button className="button secondary" disabled={disabled}>
                    Save description
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={disabled}
                    onClick={() => {
                      if (!resource.data) return;
                      const body: RequestBody<
                        "/admin/services/{serviceId}/images/{imageId}",
                        "delete"
                      > = { expectedVersion: resource.data.version };
                      propose(
                        "Remove service image?",
                        `${endpoint}/images/${image.id}`,
                        "DELETE",
                        body,
                      );
                    }}
                  >
                    Remove service image
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <p className="empty">
              <Wrench size={24} aria-hidden="true" /> No service image yet.
            </p>
          )}
          <div className={styles.upload}>
            <FileUpload
              key={revision}
              uploadId="service-image-file"
              label={
                image ? "Choose a replacement service image" : "Choose a service image"
              }
              hint="JPEG, PNG or WebP, up to 10 MiB. Each side must be between 32 and 8192 pixels."
              accept="image/jpeg,image/png,image/webp"
              disabled={disabled}
              onChange={setSelection}
              validate={validateServiceImage}
              prepare={(options) => prepareServiceImage(serviceId, options)}
            />
            <div className="actions">
              <button
                className="button"
                disabled={disabled || !selection?.prepared}
                onClick={() => {
                  if (!selection?.prepared || !resource.data) return;
                  const body: RequestBody<"/admin/services/{serviceId}/image", "put"> = {
                    assetToken: selection.prepared.token,
                    expectedVersion: resource.data.version,
                    altText: image?.altText ?? null,
                  };
                  propose(
                    image ? "Replace service image?" : "Save service image?",
                    `${endpoint}/image`,
                    "PUT",
                    body,
                  );
                }}
              >
                Save service image
              </button>
            </div>
          </div>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {
            setSelection(null);
            setRevision((value) => value + 1);
            setMessage("Service image updated.");
            resource.refresh();
            onUpdated();
          }}
        />
      )}
    </section>
  );
}
