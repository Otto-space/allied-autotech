"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import {
  disputeProposal,
  prepareDisputeEvidence,
  type DisputeWork,
} from "@/lib/api/dispute-workflow";
import { validatePaymentEvidence } from "@/lib/api/payment-evidence";
import { trustedAssetUrl } from "@/lib/assets";
import { useAssetStorageHosts } from "./asset-storage-context";
import { FileUpload, type AssetSelection } from "./file-upload";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";
export function DisputeEvidence({
  record,
  disabled,
  onReview,
}: {
  record: DisputeWork;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const [evidence, setEvidence] = useState<AssetSelection>(null),
    [url, setUrl] = useState<string>(),
    [error, setError] = useState<string>(),
    [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null),
    hosts = useAssetStorageHosts();
  useEffect(() => () => pending.current?.abort(), []);
  async function access() {
    if (disabled || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    setUrl(undefined);
    try {
      const saved = z.object({ id: z.uuid(), url: z.string() }).parse(
        (
          await apiRequest(`/staff/disputes/${record.id}/evidence-access`, {
            method: "POST",
            csrf: true,
            body: {},
            signal: controller.signal,
          })
        ).data,
      );
      if (saved.id !== record.id) throw new Error("Unexpected evidence");
      const safe = trustedAssetUrl(saved.url, hosts, window.location.origin);
      if (!controller.signal.aborted) setUrl(safe);
    } catch (value) {
      if (!controller.signal.aborted)
        setError(
          value instanceof ApiError
            ? value.message
            : "The private dispute evidence could not be verified. Refresh the record before trying again.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section className="detail-section aftercare-record">
      <h3>Private dispute evidence</h3>
      <Feedback message={error} />
      {record.hasEvidence ? (
        <>
          <p>
            The original evidence is preserved. Add any later supplements through the
            provider&apos;s dashboard.
          </p>
          <button
            className="button secondary"
            disabled={disabled || busy}
            onClick={() => void access()}
          >
            {busy ? "Checking evidence..." : "Load private dispute evidence"}
          </button>
          {url && (
            <p>
              <a
                className="text-link"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                Open dispute evidence in a new tab
              </a>
            </p>
          )}
          <p className="field-hint">
            Document access is audited. The link is temporary; load it again if it
            expires.
          </p>
          {record.evidenceChecklist && (
            <p>Recorded bundle note: {record.evidenceChecklist.note}</p>
          )}
        </>
      ) : !record.resolvedAt ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled) return;
            const form = new FormData(event.currentTarget),
              note = String(form.get("note") ?? "").trim();
            if (!evidence?.prepared || evidence.prepared.expiresAt <= Date.now()) {
              setError("Upload a complete evidence bundle before reviewing it.");
              return;
            }
            if (
              ["invoice", "fulfillment", "messages"].some(
                (key) => form.get(key) !== "on",
              ) ||
              note.length < 10 ||
              note.length > 2000
            ) {
              setError(
                "Confirm all three evidence requirements and explain the bundle in 10-2,000 characters.",
              );
              return;
            }
            setError(undefined);
            onReview(
              disputeProposal(
                record,
                {
                  action: "evidence",
                  body: {
                    evidenceToken: evidence.prepared.token,
                    invoice: true,
                    fulfillmentOrHandoverProof: true,
                    relevantCustomerMessages: true,
                    note,
                  },
                },
                {
                  title: "Preserve this dispute evidence?",
                  description:
                    "This attaches the original private bundle to the dispute. It cannot be replaced here and is not automatically sent to the payment provider. Check that it contains the invoice, fulfillment or handover proof, and relevant customer messages.",
                  facts: [
                    { label: "Evidence file", value: evidence.name },
                    { label: "Bundle note", value: note },
                  ],
                },
                (saved) =>
                  saved.hasEvidence &&
                  saved.evidenceChecklist?.invoice === true &&
                  saved.evidenceChecklist?.fulfillmentOrHandoverProof === true &&
                  saved.evidenceChecklist?.relevantCustomerMessages === true &&
                  saved.evidenceChecklist?.note === note,
              ),
            );
          }}
        >
          <fieldset disabled={disabled}>
            <legend>Complete evidence bundle</legend>
            <FileUpload
              uploadId={`${record.id}-evidence`}
              label="Dispute evidence bundle"
              hint="PDF, JPEG or PNG, up to 10 MiB. Include only material relevant to this dispute."
              accept="application/pdf,image/jpeg,image/png"
              disabled={disabled}
              onChange={setEvidence}
              validate={validatePaymentEvidence}
              prepare={(options) =>
                prepareDisputeEvidence({ ...options, disputeId: record.id })
              }
            />
            {[
              ["invoice", "The invoice is included."],
              ["fulfillment", "Fulfillment or handover proof is included."],
              ["messages", "Relevant customer messages are included."],
            ].map(([name, label]) => (
              <label className="check-label" key={name} htmlFor={`${record.id}-${name}`}>
                <input id={`${record.id}-${name}`} name={name} type="checkbox" required />
                {label}
              </label>
            ))}
            <div className="field">
              <label htmlFor={`${record.id}-bundle-note`}>Evidence bundle note</label>
              <textarea
                id={`${record.id}-bundle-note`}
                name="note"
                required
                minLength={10}
                maxLength={2000}
              />
            </div>
            <button className="button secondary">Review evidence bundle</button>
          </fieldset>
        </form>
      ) : (
        <p>No evidence bundle is recorded.</p>
      )}
    </section>
  );
}
