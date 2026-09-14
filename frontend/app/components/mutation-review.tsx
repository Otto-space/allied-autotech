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
};
export function MutationReview({
  proposal,
  onClose,
  onSuccess,
}: {
  proposal: MutationProposal;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const opener = document.activeElement;
    dialog.current?.showModal();
    cancel.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  async function confirm() {
    if (submitting.current || (uncertain && !proposal.retrySafely)) return;
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await proposal.submit();
      onSuccess();
      onClose();
    } catch (value) {
      const rejected =
        value instanceof ApiError && value.status >= 400 && value.status < 500;
      setUncertain(!rejected);
      if (!rejected) proposal.onUncertain?.();
      setError(
        rejected
          ? value.message
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
      className="support-dialog"
      aria-labelledby="mutation-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
      onClose={onClose}
    >
      <h2 id="mutation-title">{proposal.title}</h2>
      <p>{proposal.description}</p>
      <dl className="totals">
        {proposal.facts.map((fact) => (
          <div className="spec-row" key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
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
          disabled={busy || (uncertain && !proposal.retrySafely)}
          onClick={() => void confirm()}
        >
          {busy
            ? "Submitting…"
            : uncertain && proposal.retrySafely
              ? "Retry same request"
              : "Confirm change"}
        </button>
      </div>
    </dialog>
  );
}
