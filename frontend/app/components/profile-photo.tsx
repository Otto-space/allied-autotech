"use client";
import { useEffect, useState } from "react";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import {
  prepareProfilePhoto,
  validateProfilePhoto,
} from "@/lib/api/profile-photo-upload";
import type { RequestBody } from "@/lib/api/contracts";
import { FileUpload, type AssetSelection } from "./file-upload";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function ProfilePhoto({
  version,
  hasPhoto,
  refresh,
  disabled = false,
  onReviewChange,
}: {
  version: number;
  hasPhoto: boolean;
  refresh: () => void;
  disabled?: boolean;
  onReviewChange?: (value: boolean) => void;
}) {
  const [selection, setSelection] = useState<AssetSelection>(null);
  const [revision, setRevision] = useState(0);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState("");
  function review(value: MutationProposal | null) {
    setProposal(value);
    onReviewChange?.(!!value);
  }
  useEffect(() => {
    const discard = () => {
      setSelection(null);
      setProposal(null);
      setMessage("");
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => window.removeEventListener(SESSION_CHANGED, discard);
  }, []);
  return (
    <section className="detail-section" aria-labelledby="profile-photo-title">
      <p>
        Your current photo can appear beside your approved public reviews. Replacing or
        removing it also updates the portrait available through those reviews.
      </p>
      <Feedback message={message} tone="success" toast={message} />
      <FileUpload
        key={revision}
        uploadId="profile-photo-file"
        label={hasPhoto ? "Choose a replacement photo" : "Choose a profile photo"}
        hint="JPEG, PNG or WebP, up to 5 MiB. Images must be at least 32 pixels on each side."
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || !!proposal}
        onChange={setSelection}
        validate={validateProfilePhoto}
        prepare={prepareProfilePhoto}
        preparationHint="Choose a photo, check its preview, then upload it. Select Save profile photo to review and confirm the change."
        uploadedHint="Photo uploaded. Select Save profile photo to review and confirm it. Your current photo has not changed yet."
      />
      <div className="actions">
        <button
          type="button"
          className="button"
          disabled={disabled || !selection?.prepared || !!proposal}
          onClick={() => {
            if (disabled || !selection?.prepared) return;
            const body: RequestBody<"/customers/profile/photo", "put"> = {
              assetToken: selection.prepared.token,
              expectedVersion: version,
            };
            review({
              title: hasPhoto
                ? "Replace your profile photo?"
                : "Save your profile photo?",
              description:
                "Your current photo stays in place until the new image passes validation. The replacement can appear beside your approved public reviews.",
              facts: [{ label: "Selected file", value: selection.name }],
              retrySafely: true,
              retryAfterRejection: false,
              onUncertain: refresh,
              submit: () =>
                apiRequest("/customers/profile/photo", {
                  method: "PUT",
                  csrf: true,
                  body,
                }),
            });
          }}
        >
          Save profile photo
        </button>
        {hasPhoto && (
          <button
            type="button"
            className="button secondary"
            disabled={disabled || !!proposal}
            onClick={() => {
              const body: RequestBody<"/customers/profile/photo", "delete"> = {
                expectedVersion: version,
              };
              if (disabled) return;
              review({
                title: "Remove your profile photo?",
                description:
                  "Your initials will appear in place of the photo. The portrait will no longer be available through your approved public reviews.",
                facts: [],
                retryAfterRejection: false,
                onUncertain: refresh,
                submit: () =>
                  apiRequest("/customers/profile/photo", {
                    method: "DELETE",
                    csrf: true,
                    body,
                  }),
              });
            }}
          >
            Remove profile photo
          </button>
        )}
      </div>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => review(null)}
          onSuccess={() => {
            setSelection(null);
            setRevision((value) => value + 1);
            setMessage("Your profile photo has been updated.");
            refresh();
          }}
        />
      )}
    </section>
  );
}
