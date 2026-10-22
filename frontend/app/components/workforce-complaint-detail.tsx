"use client";
import { SupportTimelineEntry } from "./support-timeline-entry";
import { SupportEmailDeliverySummary } from "./support-email-delivery";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  complaintsHref,
  complaintRevision,
  complaintStatusLabels,
  complaintPriorityLabels,
  parseWorkforceComplaint,
  validateComplaintReceipt,
  workforceComplaintsPageParams,
  type ComplaintChange,
  type WorkforceComplaint,
} from "@/lib/admin/workforce-complaints";
import {
  clearWorkforceComplaintPending,
  markWorkforceComplaintPending,
  readWorkforceComplaintPending,
  type WorkforceComplaintPending,
} from "@/lib/admin/workforce-complaint-pending";
import { formatBusinessDate } from "@/lib/format/date";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";

type Draft = {
  base: WorkforceComplaint;
  body: string;
};
const newDraft = (base: WorkforceComplaint): Draft => ({ base, body: "" });
function rejection(message: string) {
  const error = new ApiError(409, { error: { code: "CONFLICT" } });
  error.message = message;
  return error;
}
export function WorkforceComplaintDetail({
  id,
  access,
  params,
  navigate,
  close,
  refresh,
  refreshKey,
  enabled,
  denied,
}: {
  id: string;
  access: WorkforceAccess;
  params: URLSearchParams;
  navigate: (params: URLSearchParams) => void;
  close: () => void;
  refresh: () => void;
  refreshKey: number;
  enabled: boolean;
  denied: boolean;
}) {
  const cursor = params.get("messageCursor"),
    api = new URLSearchParams({ limit: "25" });
  if (cursor) api.set("cursor", cursor);
  const record = useResource(
    denied ? null : `/staff/workforce/complaints/${id}?${api}`,
    parseWorkforceComplaint,
    undefined,
    { refreshKey },
  );
  const [draft, setDraft] = useState<Draft>();
  const [pending, setPending] = useState<WorkforceComplaintPending>();
  const [storageReady, setStorageReady] = useState(false);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [error, setError] = useState<string>(),
    [message, setMessage] = useState<string>();
  const [invalidField, setInvalidField] = useState<"body">();
  const [inspection, setInspection] = useState<string>(),
    [independent, setIndependent] = useState(false),
    [recovering, setRecovering] = useState(false);
  const title = useRef<HTMLHeadingElement>(null),
    confirmation = useRef<HTMLDivElement>(null),
    recovery = useRef<HTMLElement>(null);
  const focused = useRef(false);
  const confirmedVersion = useRef(-1);
  const busy = record.loading || record.refreshing,
    failure = record.error || record.refreshError;
  const mismatch =
    !!record.data &&
    (record.data.id !== id || !sameWorkforceScope(access, record.data.access));
  const row =
    enabled && !denied && !busy && !failure && !mismatch ? record.data : undefined;
  const stale =
    !!row &&
    !!draft &&
    (complaintRevision(row) !== complaintRevision(draft.base) ||
      !sameWorkforceScope(access, draft.base.access));
  const blocked = !row || !storageReady || !!pending || !!proposal || stale || recovering;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setPending(readWorkforceComplaintPending(access.userId));
        setStorageReady(true);
      }
    });
    function discard() {
      setDraft(undefined);
      setProposal(null);
      setInspection(undefined);
      setIndependent(false);
      setError(undefined);
      setMessage(undefined);
      setPending(readWorkforceComplaintPending(access.userId));
    }
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [access.userId]);
  useEffect(() => {
    let active = true;
    if (row && !draft && row.version >= confirmedVersion.current)
      queueMicrotask(() => {
        if (active) setDraft(newDraft(row));
      });
    if (denied || record.denied || mismatch)
      queueMicrotask(() => {
        if (active) {
          setDraft(undefined);
          setProposal(null);
          setMessage(undefined);
        }
      });
    return () => {
      active = false;
    };
  }, [row, draft, denied, record.denied, mismatch]);
  useEffect(() => {
    if (row && !focused.current) {
      focused.current = true;
      title.current?.focus();
    }
  }, [row]);
  useEffect(() => {
    if (message) confirmation.current?.focus();
  }, [message]);
  useEffect(() => {
    if (pending && !proposal) recovery.current?.focus();
  }, [pending, proposal]);
  function edit<K extends keyof Omit<Draft, "base">>(key: K, value: Draft[K]) {
    setDraft((old) => (old ? { ...old, [key]: value } : old));
    setError(undefined);
    setInvalidField(undefined);
  }
  async function current() {
    const [ownResult, detailResult] = await Promise.all([
      apiRequest("/staff/workforce/access"),
      apiRequest(`/staff/workforce/complaints/${id}?limit=25`),
    ]);
    const own = parseWorkforceAccess(ownResult.data),
      latest = parseWorkforceComplaint(detailResult.data);
    if (
      !draftIdentity()?.startsWith(`${access.userId}:`) ||
      !sameWorkforceScope(access, own) ||
      !sameWorkforceScope(own, latest.access) ||
      latest.id !== id
    )
      throw rejection("Your responsibilities changed. Refresh access before continuing.");
    return latest;
  }
  function review() {
    if (!row || !draft || blocked || !["OPEN", "INVESTIGATING"].includes(row.status))
      return;
    const base = row,
      body = draft.body.trim();
    if (!body || body.length > 5000) {
      setInvalidField("body");
      setError("Enter a reply between 1 and 5000 characters.");
      document.getElementById("wfc-body")?.focus();
      return;
    }
    const change: ComplaintChange = {
      action: "reply",
      body: {
        expectedVersion: base.version,
        expectedLatestMessageId: base.latestMessageId,
        body,
      },
    };
    setError(undefined);
    setInvalidField(undefined);
    setMessage(undefined);
    setProposal({
      title: "Send this customer-visible reply?",
      description:
        "Review the exact reply. Current responsibilities and the latest conversation will be checked before saving.",
      facts: [
        { label: "Complaint", value: base.subject },
        { label: "Customer-visible reply", value: body },
      ],
      retryAfterRejection: false,
      submit: async () => {
        let sent = false,
          token: string | undefined;
        try {
          const latest = await current();
          if (
            complaintRevision(latest) !== complaintRevision(base) ||
            !["OPEN", "INVESTIGATING"].includes(latest.status)
          )
            throw rejection(
              "The conversation changed. Close this review, refresh and review your retained draft.",
            );
          const marker = await markWorkforceComplaintPending(
            access.userId,
            { id, action: "reply", version: base.version },
            change.body,
          );
          token = marker.token;
          setPending(marker);
          sent = true;
          const result = await apiRequest(`/staff/workforce/complaints/${id}/replies`, {
            method: "POST",
            csrf: true,
            body: change.body,
          });
          const receipt = validateComplaintReceipt(result.data, base, change);
          confirmedVersion.current = receipt.version;
          clearWorkforceComplaintPending(access.userId, token);
          setPending(undefined);
          setDraft(undefined);
        } catch (caught) {
          if (!sent)
            throw rejection(
              caught instanceof Error
                ? caught.message
                : "The change was not sent. Refresh before reviewing again.",
            );
          if (caught instanceof ApiError && [408, 429].includes(caught.status))
            throw Error("The reply outcome could not be confirmed.");
          if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
            try {
              clearWorkforceComplaintPending(access.userId, token);
            } finally {
              setPending(readWorkforceComplaintPending(access.userId));
            }
          }
          throw caught;
        }
      },
      onUncertain: () =>
        setPending(readWorkforceComplaintPending(access.userId) ?? "unknown"),
    });
  }
  async function reconcile(clear: boolean) {
    setRecovering(true);
    setError(undefined);
    try {
      const marker = readWorkforceComplaintPending(access.userId);
      if (!marker || JSON.stringify(marker) !== JSON.stringify(pending))
        throw Error("The pending change changed. Reload before continuing.");
      if (marker !== "unknown" && marker.id !== id)
        throw Error("Open the complaint with the pending change first.");
      const latest = await current(),
        fingerprint = JSON.stringify(marker) + complaintRevision(latest);
      if (clear) {
        if (!independent || inspection !== fingerprint)
          throw Error(
            "Inspect the latest conversation and independently reconcile the earlier change first.",
          );
        clearWorkforceComplaintPending(
          access.userId,
          marker === "unknown" ? undefined : marker.token,
        );
        setPending(undefined);
        setInspection(undefined);
        setIndependent(false);
        setDraft(newDraft(latest));
        setMessage(
          "Reconciliation recorded for this browser session. No change was resent.",
        );
      } else {
        setInspection(fingerprint);
        setIndependent(false);
      }
      record.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reconciliation unavailable.");
    } finally {
      setRecovering(false);
    }
  }
  function messages(direction: "first" | "previous" | "next") {
    const paging = new URLSearchParams();
    if (cursor) paging.set("cursor", cursor);
    if (params.has("_messageTrail")) paging.set("_trail", params.get("_messageTrail")!);
    const next =
      direction === "first"
        ? new URLSearchParams()
        : workforceComplaintsPageParams(
            paging,
            row?.messages.nextCursor,
            direction === "previous",
          );
    const target = new URLSearchParams(params);
    target.delete("messageCursor");
    target.delete("_messageTrail");
    if (next.has("cursor")) target.set("messageCursor", next.get("cursor")!);
    if (next.has("_trail")) target.set("_messageTrail", next.get("_trail")!);
    navigate(target);
  }
  const errorId = error ? "wfc-action-error" : undefined;
  return (
    <section className="wfc-detail" aria-label="Selected complaint" aria-busy={busy}>
      <div id="wfc-action-error">
        <Feedback message={error} />
      </div>
      {message && (
        <div className="notice success" role="status" tabIndex={-1} ref={confirmation}>
          {message}
        </div>
      )}
      {pending && (
        <section
          className="wfc-recovery"
          ref={recovery}
          tabIndex={-1}
          aria-labelledby="wfc-recovery-title"
        >
          <h2 id="wfc-recovery-title">Review an earlier complaint change</h2>
          <p>
            The result could not be confirmed. Refreshing does not clear this lock.
            Current conversation data alone cannot prove whether the original request
            succeeded; no change will be resent automatically.
          </p>
          {pending !== "unknown" && pending.id !== id ? (
            <Link
              className="button secondary"
              href={complaintsHref(new URLSearchParams({ selected: pending.id }))}
            >
              Open pending complaint
            </Link>
          ) : (
            <>
              <button
                className="button secondary"
                disabled={recovering || !!proposal || !row}
                onClick={() => void reconcile(false)}
              >
                Inspect current complaint
              </button>
              {inspection && (
                <>
                  <label className="wfc-check">
                    <input
                      type="checkbox"
                      checked={independent}
                      onChange={(e) => setIndependent(e.target.checked)}
                    />
                    I have independently reconciled the earlier change with the supervisor
                    or audit record.
                  </label>
                  <button
                    className="button secondary"
                    disabled={!independent || recovering || !!proposal || !row}
                    onClick={() => void reconcile(true)}
                  >
                    Finish reconciliation
                  </button>
                </>
              )}
            </>
          )}
        </section>
      )}
      {(failure || mismatch || denied) && (
        <div className="wfc-feedback" role="alert">
          <h2>
            {record.denied || denied
              ? "Complaint access unavailable"
              : "Complaint could not be verified"}
          </h2>
          <p>Refresh complaints to check the current conversation and your access.</p>
          <button className="button secondary" onClick={refresh}>
            Check complaint again
          </button>
          <button className="button secondary" onClick={close}>
            Close selection
          </button>
        </div>
      )}
      {(busy || !enabled) && !denied && (
        <p className="wfc-state" role="status">
          Checking the selected complaint…
        </p>
      )}
      {row && (
        <>
          <header className="wfc-detail-heading">
            <div>
              <h2 ref={title} tabIndex={-1}>
                {row.subject}
              </h2>
              <p>
                <span className={`wfc-status is-${row.priority.toLowerCase()}`}>
                  {complaintPriorityLabels[row.priority]}
                </span>{" "}
                <span
                  className={`wfc-status is-${row.status.toLowerCase()}`}
                  data-status={row.status}
                >
                  {complaintStatusLabels[row.status]}
                </span>
              </p>
            </div>
            <button className="button secondary" onClick={close}>
              Close selection
            </button>
          </header>
          <WorkflowProgress workflow="complaint" status={row.status} />
          <SupportEmailDeliverySummary
            page={row.emailDeliveries}
            loading={busy}
            error={failure}
            onRefresh={record.refresh}
          />
          <dl className="wfc-facts">
            <div>
              <dt>Branch</dt>
              <dd>{row.branch?.name ?? "Branch not recorded"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>
                <time dateTime={row.createdAt}>{formatBusinessDate(row.createdAt)}</time>
              </dd>
            </div>
          </dl>
          {stale && (
            <section className="wfc-recovery">
              <h3>The conversation has changed</h3>
              <p>
                Your unsent draft is retained. Review the current conversation before
                using it with the latest version.
              </p>
              <button
                className="button secondary"
                disabled={!!pending || !!proposal}
                onClick={() => {
                  setDraft((old) => (old ? { ...old, base: row } : newDraft(row)));
                  setError(undefined);
                }}
              >
                Use retained draft with latest conversation
              </button>
              <button
                className="button secondary"
                disabled={!!pending || !!proposal}
                onClick={() => setDraft(newDraft(row))}
              >
                Discard draft and start again
              </button>
            </section>
          )}
          <div className="wfc-columns">
            <section
              className="wfc-panel wfc-conversation"
              aria-labelledby="wfc-conversation-title"
            >
              <h3 id="wfc-conversation-title">Conversation</h3>
              <div className="wfc-original">
                <h4>Original complaint</h4>
                <p>{row.description}</p>
              </div>
              <ol className="wfc-messages">
                {[...row.messages.items].reverse().map((entry) => (
                  <li key={entry.id}>
                    <SupportTimelineEntry entry={entry} staff />
                  </li>
                ))}
              </ol>
              {!row.messages.items.length && (
                <p>No customer-visible conversation updates have been recorded.</p>
              )}
              <footer>
                <p>Customer-visible messages only.</p>
                <nav className="wfc-paging" aria-label="Conversation pages">
                  <button
                    className="button secondary"
                    disabled={!cursor}
                    onClick={() => messages("first")}
                  >
                    Newest messages
                  </button>
                  <button
                    className="button secondary"
                    disabled={!params.has("_messageTrail")}
                    onClick={() => messages("previous")}
                  >
                    Newer messages
                  </button>
                  <button
                    className="button secondary"
                    disabled={!row.messages.nextCursor}
                    onClick={() => messages("next")}
                  >
                    Older messages
                  </button>
                </nav>
              </footer>
            </section>
            <div className="wfc-actions">
              <section className="wfc-panel" aria-labelledby="wfc-reply-title">
                <h3 id="wfc-reply-title">Reply to customer</h3>
                <p>Your reply will be visible to the customer.</p>
                {["OPEN", "INVESTIGATING"].includes(row.status) ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      review();
                    }}
                  >
                    <div className="field">
                      <label htmlFor="wfc-body">Message</label>
                      <textarea
                        id="wfc-body"
                        value={draft?.body ?? ""}
                        maxLength={5000}
                        rows={5}
                        readOnly={blocked}
                        onChange={(e) => edit("body", e.target.value)}
                        aria-invalid={invalidField === "body"}
                        aria-describedby={`wfc-body-hint${invalidField === "body" && errorId ? ` ${errorId}` : ""}`}
                      />
                      <small id="wfc-body-hint">
                        {draft?.body.length ?? 0} / 5000 characters
                      </small>
                    </div>
                    <button className="button" disabled={blocked || !draft}>
                      Review reply
                    </button>
                  </form>
                ) : (
                  <p>
                    This complaint is {complaintStatusLabels[row.status].toLowerCase()}{" "}
                    and cannot receive a staff reply.
                  </p>
                )}
              </section>
              <section className="wfc-panel" aria-labelledby="wfc-tracking-title">
                <h3 id="wfc-tracking-title">Response tracking</h3>
                <dl className="wfc-tracking">
                  {(
                    [
                      ["Acknowledged", row.acknowledgedAt],
                      ["Acknowledgement due", row.acknowledgementDueAt],
                      ["Escalated", row.escalatedAt],
                      ...(row.resolvedAt ? [["Resolved", row.resolvedAt]] : []),
                      ...(row.closedAt ? [["Closed", row.closedAt]] : []),
                    ] as [string, string | null][]
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {value ? (
                          <time dateTime={value}>{formatBusinessDate(value)}</time>
                        ) : (
                          "Not recorded"
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                {row.resolution && (
                  <div className="wfc-resolution">
                    <h4>Recorded resolution</h4>
                    <p>{row.resolution}</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          exposeBusyState
          onClose={() => {
            setProposal(null);
            refresh();
          }}
          onSuccess={() =>
            setMessage("Your reply was recorded in the customer conversation.")
          }
        />
      )}
    </section>
  );
}
