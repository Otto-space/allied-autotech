"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { forgetPrivacyForm, parsePrivacyHolds } from "@/lib/admin/work-privacy";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  holdInputSchema,
  holdTypes,
  parseHolds,
  releaseReasonSchema,
  releasedHoldSchema,
  retentionHoldSchema,
  type RetentionHold,
  type PrivacyRequest,
} from "@/lib/api/privacy-schemas";
import { useResource } from "@/lib/api/use-resource";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function RetentionHolds({
  userId,
  disabled,
  onUncertain,
  onReview,
  onDenied,
  privacyRequest,
}: {
  userId: string;
  disabled: boolean;
  onUncertain: () => void;
  onReview?: (proposal: MutationProposal) => void;
  onDenied?: () => void;
  privacyRequest?: PrivacyRequest;
}) {
  const coordinated = !!onReview;
  const date = coordinated ? formatStockInstant : formatBusinessDate;
  const parse = useCallback(
    (value: unknown) => {
      const holds = coordinated ? parsePrivacyHolds(value, userId) : parseHolds(value);
      if (holds.some((hold) => hold.userId !== userId))
        throw new Error("Unexpected hold account");
      return holds;
    },
    [userId, coordinated],
  );
  const record = useResource(`/staff/retention-holds?userId=${userId}`, parse);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const creation = useRef<HTMLFormElement>(null);
  const locked =
    disabled ||
    record.loading ||
    record.refreshing ||
    !!record.error ||
    !!record.refreshError ||
    !record.data;
  useEffect(() => {
    if (record.denied) onDenied?.();
  }, [record.denied, onDenied]);
  function publish(offer: MutationProposal) {
    if (onReview && privacyRequest) onReview(offer);
    else setProposal(offer);
  }
  function invalid(message: string, field: string) {
    setValidation(message);
    document.getElementById(field)?.focus();
  }
  function create(form: FormData, element: HTMLFormElement) {
    if (locked || proposal) return;
    setValidation(undefined);
    setMessage(undefined);
    const reference = String(form.get("recordId") ?? "").trim();
    const parsed = holdInputSchema.safeParse({
      userId,
      recordType: form.get("recordType"),
      reason: form.get("reason"),
      ...(reference ? { recordId: reference } : {}),
    });
    if (!parsed.success) {
      invalid(
        "Choose a record type, use a valid record reference if provided, and explain the hold in 10–2,000 characters.",
        `hold-${String(parsed.error.issues[0]?.path[0] ?? "reason")}`,
      );
      return;
    }
    const body: RequestBody<"/staff/retention-holds", "post"> = parsed.data;
    publish({
      ...(privacyRequest
        ? { privacyChange: { kind: "hold" as const, request: privacyRequest, body } }
        : {}),
      onConfirmed: () => {
        if (onReview) {
          forgetPrivacyForm(element);
          element.reset();
          record.refresh();
        }
      },
      title: "Record this retention hold?",
      description:
        "This protects the account from privacy approval while the hold is active. No customer records will be changed or deleted by adding the hold.",
      facts: [
        { label: "Account", value: userId },
        { label: "Records", value: holdTypes[body.recordType] },
        {
          label: "Record reference",
          value: body.recordId ?? "No individual record specified",
        },
        { label: "Reason", value: body.reason },
      ],
      submit: async () => {
        const response = await apiRequest("/staff/retention-holds", {
          method: "POST",
          csrf: true,
          body,
        });
        const saved = retentionHoldSchema.parse(response.data);
        if (
          saved.userId !== userId ||
          saved.recordType !== body.recordType ||
          saved.recordId !== (body.recordId ?? null) ||
          saved.reason !== body.reason ||
          saved.releasedAt !== null
        )
          throw new Error("Unexpected retention hold");
        return response;
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  function release(hold: RetentionHold, form: FormData, element: HTMLFormElement) {
    if (locked || proposal || hold.releasedAt) return;
    setValidation(undefined);
    setMessage(undefined);
    const reason = releaseReasonSchema.safeParse(form.get("reason"));
    if (!reason.success) {
      invalid(
        "Explain why the hold can be released in 20–2,000 characters.",
        `hold-release-${hold.id}`,
      );
      return;
    }
    const body: RequestBody<"/staff/retention-holds/{id}/release", "post"> = {
      reason: reason.data,
    };
    publish({
      ...(privacyRequest
        ? {
            privacyChange: {
              kind: "release" as const,
              request: privacyRequest,
              hold,
              body,
            },
          }
        : {}),
      onConfirmed: () => {
        if (onReview) {
          forgetPrivacyForm(element);
          element.reset();
          record.refresh();
        }
      },
      title: "Release this retention hold?",
      description:
        "Only release a hold after its protection is no longer required. Releasing it does not approve a privacy request or schedule deletion. Other holds and disputes remain subject to review.",
      facts: [
        { label: "Account", value: userId },
        { label: "Records", value: holdTypes[hold.recordType] },
        { label: "Original reason", value: hold.reason },
        { label: "Release justification", value: reason.data },
      ],
      submit: async () => {
        const response = await apiRequest(`/staff/retention-holds/${hold.id}/release`, {
          method: "POST",
          csrf: true,
          body,
        });
        const saved = releasedHoldSchema.parse(response.data);
        if (saved.id !== hold.id) throw new Error("Unexpected hold release");
        return response;
      },
      onUncertain,
      retryAfterRejection: false,
    });
  }
  return (
    <section className="detail-section" aria-labelledby="retention-holds-title">
      {coordinated ? (
        <h3 id="retention-holds-title">Retention holds</h3>
      ) : (
        <h4 id="retention-holds-title">Retention holds</h4>
      )}
      <p>
        Latest 100 holds for this account, including released holds. Approval checks all
        active holds and unresolved disputes on the server.
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={record.loading || record.refreshing || !!proposal || disabled}
        onClick={record.refresh}
      >
        Refresh retention holds
      </button>
      <Feedback message={record.error || record.refreshError} />
      {record.refreshError && record.data && (
        <p>
          Previously loaded holds are shown. Changes remain disabled until a fresh read
          succeeds.
        </p>
      )}
      <Feedback message={validation} />
      <Feedback
        message={message}
        tone="success"
        toast="Retention hold change recorded."
      />
      {record.loading && <p role="status">Loading retention holds…</p>}
      {!record.error && record.data && (
        <>
          {record.data.length === 0 && (
            <p>No retention holds are recorded for this account.</p>
          )}
          {record.data.map((hold) => (
            <article className="detail-section" key={hold.id}>
              <h4>
                {holdTypes[hold.recordType]} ·{" "}
                {hold.releasedAt ? "Released" : "Active hold"}
              </h4>
              <p className="preserve-lines">{hold.reason}</p>
              <p>Hold reference: {hold.id}</p>
              <p>Recorded {date(hold.createdAt)}</p>
              {hold.recordId && <p>Record reference: {hold.recordId}</p>}
              {hold.releasedAt ? (
                <p>Released {date(hold.releasedAt)}</p>
              ) : (
                <form
                  data-draft-key={JSON.stringify(["retention-holds:1", userId, hold.id])}
                  onSubmit={(event) => {
                    event.preventDefault();
                    release(hold, new FormData(event.currentTarget), event.currentTarget);
                  }}
                >
                  <fieldset disabled={locked}>
                    <legend>Release this hold</legend>
                    <div className="field">
                      <label htmlFor={`hold-release-${hold.id}`}>
                        Release justification
                      </label>
                      <textarea
                        id={`hold-release-${hold.id}`}
                        name="reason"
                        required
                        minLength={20}
                        maxLength={2000}
                      />
                    </div>
                    <button className="button secondary">Review hold release</button>
                  </fieldset>
                </form>
              )}
            </article>
          ))}
          <form
            data-draft-key={JSON.stringify(["retention-holds:2", userId])}
            ref={creation}
            className="line-entry-form"
            onSubmit={(event) => {
              event.preventDefault();
              create(new FormData(event.currentTarget), event.currentTarget);
            }}
          >
            <fieldset disabled={locked}>
              <legend>Add a retention hold</legend>
              <div className="field">
                <label htmlFor="hold-recordType">Protected records</label>
                <select id="hold-recordType" name="recordType" required defaultValue="">
                  <option value="">Choose the protected records</option>
                  {Object.entries(holdTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="hold-recordId">
                  Individual record reference (optional)
                </label>
                <input
                  id="hold-recordId"
                  name="recordId"
                  maxLength={36}
                  aria-describedby="hold-reference-help"
                />
                <span id="hold-reference-help" className="field-hint">
                  Use the exact record identifier from the reviewed case. Leave empty for
                  an account-level hold.
                </span>
              </div>
              <div className="field">
                <label htmlFor="hold-reason">Reason for protection</label>
                <textarea
                  id="hold-reason"
                  name="reason"
                  required
                  minLength={10}
                  maxLength={2000}
                />
              </div>
              <button className="button secondary">Review new hold</button>
            </fieldset>
          </form>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Confirm hold change"
          onClose={() => setProposal(null)}
          onSuccess={() => {
            creation.current?.reset();
            setMessage(
              "Retention hold change recorded. Review the refreshed hold status below.",
            );
            record.refresh();
          }}
        />
      )}
    </section>
  );
}
