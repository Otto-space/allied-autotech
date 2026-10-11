"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { GarageDialog } from "./garage-dialog";
import { Feedback } from "./feedback";

export type PhotoProposal = {
  title: string;
  description: string;
  facts: { label: string; value: string }[];
  retrySafely: boolean;
  submit: () => Promise<number>;
  uploadSlot?: number;
};

export function GaragePhotoReview({
  proposal,
  onClose,
  onSuccess,
}: {
  proposal: PhotoProposal;
  onClose: (attempted: boolean) => void;
  onSuccess: (version: number) => void;
}) {
  const active = useRef(true),
    lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const blocked = attempted && (!uncertain || !proposal.retrySafely);
  async function confirm() {
    if (lock.current || blocked) return;
    lock.current = true;
    setBusy(true);
    setAttempted(true);
    setError("");
    try {
      const version = await proposal.submit();
      if (active.current) onSuccess(version);
    } catch (failure) {
      if (!active.current) return;
      const rejected =
        failure instanceof ApiError && failure.status >= 400 && failure.status < 500;
      setUncertain(!rejected);
      setError(
        rejected
          ? failure.message
          : proposal.retrySafely
            ? "The outcome could not be confirmed. You can retry the same request safely using its original reference, or close this dialog and review the record."
            : "The outcome could not be confirmed. Close this dialog and refresh the record before making another change.",
      );
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <GarageDialog title={proposal.title} busy={busy} onClose={() => onClose(attempted)}>
      <div className="garage-dialog-body">
        <p>{proposal.description}</p>
        <dl className="photo-review-facts">
          {proposal.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <Feedback message={error} />
      </div>
      <footer className="garage-dialog-footer">
        <button
          className="button secondary"
          disabled={busy}
          data-initial-focus
          onClick={() => onClose(attempted)}
        >
          {uncertain ? "Close & review record" : "Go back"}
        </button>
        <button
          className="button"
          disabled={busy || blocked}
          aria-busy={busy}
          onClick={() => void confirm()}
        >
          {busy
            ? "Submitting…"
            : uncertain && proposal.retrySafely
              ? "Retry same request"
              : "Confirm change"}
        </button>
      </footer>
    </GarageDialog>
  );
}
