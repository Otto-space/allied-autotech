"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { Feedback } from "./feedback";

export type MutationProposal = {
  title: string;
  description: string;
  facts: { label: string; value: string }[];
  submit: () => Promise<unknown>;
  onUncertain?: () => void;
  retrySafely?: boolean;
  retryAfterRejection?: boolean;
};
export function MutationReview({
  proposal,
  onClose,
  onSuccess,
  confirmLabel = "Confirm change",
}: {
  proposal: MutationProposal;
  onClose: () => void;
  onSuccess: () => void;
  confirmLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string>();
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    // Keep the original opener across development Strict Mode's effect replay.
    previousFocus.current ??= document.activeElement;
    const modal = dialog.current;
    modal?.showModal();
    cancel.current?.focus();
    return () => {
      const opener = previousFocus.current;
      queueMicrotask(() => {
        if (!modal?.isConnected && opener instanceof HTMLElement && opener.isConnected)
          opener.focus();
      });
    };
  }, []);
  async function confirm() {
    if (
      submitting.current ||
      (uncertain && !proposal.retrySafely) ||
      (attempted && !uncertain && proposal.retryAfterRejection === false)
    )
      return;
    submitting.current = true;
    setBusy(true);
    setAttempted(true);
    setError(undefined);
    try {
      await proposal.submit();
      onSuccess();
      onClose();
    } catch (error_) {
      const rejected =
        error_ instanceof ApiError && error_.status >= 400 && error_.status < 500;
      setUncertain(!rejected);
      if (!rejected) proposal.onUncertain?.();
      setError(
        rejected
          ? error_.message
          : proposal.retrySafely
            ? "The outcome could not be confirmed. You can retry the same request safely using its original reference, or close this dialog and review the record."
            : "The outcome could not be confirmed. Close this dialog and refresh the record before making another change.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="support-dialog mutation-review"
      aria-labelledby="mutation-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
      onClose={onClose}
    >
      <h2 id="mutation-title">{proposal.title}</h2>
      <div
        className="mutation-review-content"
        role="region"
        aria-label="Review details"
        tabIndex={0}
      >
        <p>{proposal.description}</p>
        <dl className="totals">
          {proposal.facts.map((fact) => (
            <div className="spec-row" key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Feedback message={error} />
      <div className="actions">
        <button
          ref={cancel}
          className="button secondary"
          disabled={busy}
          onClick={onClose}
        >
          {uncertain ? "Close & review record" : "Go back"}
        </button>
        <button
          className="button"
          disabled={
            busy ||
            (uncertain && !proposal.retrySafely) ||
            (attempted && !uncertain && proposal.retryAfterRejection === false)
          }
          onClick={() => void confirm()}
        >
          {busy
            ? "Submitting…"
            : uncertain && proposal.retrySafely
              ? "Retry same request"
              : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
