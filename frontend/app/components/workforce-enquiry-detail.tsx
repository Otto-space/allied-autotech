"use client";
import "./care-workspace.css";
import { CopyableValue } from "./copyable-value";
import { enquiryLabel } from "@/lib/support/enquiry-label";
import { NotificationRecordContext } from "./notification-record-context";
import { SupportTimelineEntry } from "./support-timeline-entry";
import { SupportEmailDeliverySummary } from "./support-email-delivery";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  canAssignEnquiry,
  canReplyEnquiry,
  enquiriesHref,
  enquiryRevision,
  enquiryStaffName,
  enquiryStatusLabels,
  parseWorkforceEnquiry,
  parseWorkforceEnquiryCandidates,
  validateEnquiryReceipt,
  workforceEnquiriesPageParams,
  type EnquiryChange,
  type WorkforceEnquiry,
  type WorkforceEnquiryCandidate,
} from "@/lib/admin/workforce-enquiries";
import {
  clearWorkforceEnquiryPending,
  markWorkforceEnquiryPending,
  readWorkforceEnquiryPending,
  type WorkforceEnquiryPending,
} from "@/lib/admin/workforce-enquiry-pending";
import { formatBusinessDate } from "@/lib/format/date";
import { careCaseAllows } from "@/lib/workforce-care";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
import { EnquiryCandidates } from "./workforce-enquiry-candidates";

type Draft = {
  base: WorkforceEnquiry;
  body: string;
  reason: string;
  selected?: WorkforceEnquiryCandidate;
};
const newDraft = (base: WorkforceEnquiry): Draft => ({ base, body: "", reason: "" });
function rejection(message: string) {
  const error = new ApiError(409, { error: { code: "CONFLICT" } });
  error.message = message;
  return error;
}
export function WorkforceEnquiryDetail({
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
  else if (params.get("messageId")) api.set("messageId", params.get("messageId")!);
  const record = useResource(
    denied ? null : `/staff/workforce/enquiries/${id}?${api}`,
    parseWorkforceEnquiry,
    undefined,
    { refreshKey },
  );
  const [draft, setDraft] = useState<Draft>();
  const retainedDraft = useRef<Partial<Omit<Draft, "base">>>({});
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<WorkforceEnquiryPending>();
  const [storageReady, setStorageReady] = useState(false);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [error, setError] = useState<string>(),
    [message, setMessage] = useState<string>();
  const [invalidField, setInvalidField] = useState<"body" | "reason" | "staff">();
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
    (enquiryRevision(row) !== enquiryRevision(draft.base) ||
      !sameWorkforceScope(access, draft.base.access));
  const blocked = !row || !storageReady || !!pending || !!proposal || stale || recovering;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setPending(readWorkforceEnquiryPending(access.userId));
        setStorageReady(true);
      }
    });
    function discard() {
      retainedDraft.current = {};
      setDraft(undefined);
      setProposal(null);
      setInspection(undefined);
      setIndependent(false);
      setError(undefined);
      setMessage(undefined);
      setPending(readWorkforceEnquiryPending(access.userId));
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
        if (active) {
          setDraft({ ...newDraft(row), ...retainedDraft.current });
          retainedDraft.current = {};
        }
      });
    if (denied || record.denied || mismatch)
      queueMicrotask(() => {
        if (active) {
          retainedDraft.current = {};
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
      apiRequest(`/staff/workforce/enquiries/${id}?limit=25`),
    ]);
    const own = parseWorkforceAccess(ownResult.data),
      latest = parseWorkforceEnquiry(detailResult.data);
    if (
      !draftIdentity()?.startsWith(`${access.userId}:`) ||
      !sameWorkforceScope(access, own) ||
      !sameWorkforceScope(own, latest.access) ||
      latest.id !== id
    )
      throw rejection("Your responsibilities changed. Refresh access before continuing.");
    return latest;
  }
  function review(action: "reply" | "assignment") {
    if (!row || !draft || blocked || !["OPEN", "IN_PROGRESS"].includes(row.status))
      return;
    const base = row,
      chosen = draft.selected;
    const invalid = (field: "body" | "reason" | "staff", text: string) => {
      setInvalidField(field);
      setError(text);
      document.getElementById(`wfe-${field}`)?.focus();
    };
    let change: EnquiryChange;
    if (action === "reply") {
      if (!canReplyEnquiry(base, access)) return;
      const body = draft.body.trim();
      if (!body || body.length > 5000)
        return invalid("body", "Enter a reply between 1 and 5000 characters.");
      change = {
        action,
        body: {
          expectedVersion: base.version,
          expectedLatestMessageId: base.latestMessageId,
          body,
        },
      };
    } else {
      if (!canAssignEnquiry(base, access)) return;
      if (!chosen || chosen.id === base.assignedStaffId)
        return invalid("staff", "Choose a different eligible colleague.");
      const reason = draft.reason.trim();
      if (reason.length < 10 || reason.length > 1000)
        return invalid(
          "reason",
          "Enter a reassignment reason between 10 and 1000 characters.",
        );
      change = {
        action,
        body: { expectedVersion: base.version, staffId: chosen.id, reason },
      };
    }
    setError(undefined);
    setInvalidField(undefined);
    setMessage(undefined);
    setProposal({
      title:
        action === "reply"
          ? "Send this customer-visible reply?"
          : "Reassign this enquiry?",
      description:
        "Review the exact change. Current responsibilities and the latest conversation will be checked before saving.",
      facts: [
        { label: "Enquiry", value: base.subject },
        ...(change.action === "reply"
          ? [{ label: "Customer-visible reply", value: change.body.body }]
          : [
              { label: "Current assignee", value: enquiryStaffName(base.assignedStaff) },
              { label: "New assignee", value: enquiryStaffName(chosen!) },
              { label: "Staff reference", value: chosen!.id },
              { label: "Internal assignment reason", value: change.body.reason },
            ]),
      ],
      retryAfterRejection: false,
      submit: async () => {
        let sent = false,
          token: string | undefined;
        try {
          const latest = await current();
          if (
            enquiryRevision(latest) !== enquiryRevision(base) ||
            !["OPEN", "IN_PROGRESS"].includes(latest.status) ||
            (change.action === "reply" && !canReplyEnquiry(latest, latest.access))
          )
            throw rejection(
              "The conversation changed. Close this review, refresh and review your retained draft.",
            );
          if (change.action === "assignment") {
            if (!canAssignEnquiry(latest, latest.access))
              throw rejection("Assignment is no longer available.");
            const seen = new Set<string>();
            let staffCursor: string | undefined,
              found = false;
            do {
              const query = new URLSearchParams({
                limit: "25",
                q: enquiryStaffName(chosen!).replace(/\s+/g, " ").slice(0, 120),
              });
              if (staffCursor) query.set("cursor", staffCursor);
              const result = await apiRequest(
                `/staff/workforce/enquiries/${id}/assignees?${query}`,
              );
              const options = parseWorkforceEnquiryCandidates(result.data);
              if (
                options.enquiryId !== id ||
                options.enquiryVersion !== latest.version ||
                options.branchId !== latest.branchId ||
                !sameWorkforceScope(latest.access, options.access)
              )
                throw rejection("Staff options changed. Refresh before assigning.");
              const target = options.items.find(
                (item) => item.id === change.body.staffId,
              );
              if (target) {
                if (enquiryStaffName(target) !== enquiryStaffName(chosen!))
                  throw rejection("The selected colleague changed. Select them again.");
                found = true;
                break;
              }
              staffCursor = options.nextCursor;
              if (staffCursor && seen.has(staffCursor))
                throw rejection("Staff paging could not be verified.");
              if (staffCursor) seen.add(staffCursor);
            } while (staffCursor);
            if (!found)
              throw rejection(
                "The selected colleague is no longer eligible. Select another colleague.",
              );
          }
          const marker = await markWorkforceEnquiryPending(
            access.userId,
            { id, action, version: base.version },
            change.body,
          );
          token = marker.token;
          setPending(marker);
          sent = true;
          const result = await apiRequest(
            `/staff/workforce/enquiries/${id}/${action === "reply" ? "replies" : "assignment"}`,
            {
              method: action === "reply" ? "POST" : "PATCH",
              csrf: true,
              body: change.body,
            },
          );
          const receipt = validateEnquiryReceipt(result.data, base, change);
          confirmedVersion.current = receipt.version;
          clearWorkforceEnquiryPending(access.userId, token);
          setPending(undefined);
          retainedDraft.current =
            change.action === "assignment"
              ? { body: draft.body }
              : { reason: draft.reason, selected: draft.selected };
          setDraft(undefined);
        } catch (caught) {
          if (!sent)
            throw rejection(
              caught instanceof Error
                ? caught.message
                : "The change was not sent. Refresh before reviewing again.",
            );
          if (caught instanceof ApiError && [408, 429].includes(caught.status))
            throw Error("The change outcome could not be confirmed.");
          if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
            try {
              clearWorkforceEnquiryPending(access.userId, token);
            } finally {
              setPending(readWorkforceEnquiryPending(access.userId));
            }
          }
          throw caught;
        }
      },
      onUncertain: () =>
        setPending(readWorkforceEnquiryPending(access.userId) ?? "unknown"),
    });
  }
  async function reconcile(clear: boolean) {
    setRecovering(true);
    setError(undefined);
    try {
      const marker = readWorkforceEnquiryPending(access.userId);
      if (!marker || JSON.stringify(marker) !== JSON.stringify(pending))
        throw Error("The pending change changed. Reload before continuing.");
      if (marker !== "unknown" && marker.id !== id)
        throw Error("Open the enquiry with the pending change first.");
      const latest = await current(),
        fingerprint = JSON.stringify(marker) + enquiryRevision(latest);
      if (clear) {
        if (!independent || inspection !== fingerprint)
          throw Error(
            "Inspect the latest conversation and independently reconcile the earlier change first.",
          );
        clearWorkforceEnquiryPending(
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
        : workforceEnquiriesPageParams(
            paging,
            row?.messages.nextCursor,
            direction === "previous",
          );
    const target = new URLSearchParams(params);
    target.delete("messageCursor");
    target.delete("messageId");
    target.delete("_messageTrail");
    if (next.has("cursor")) target.set("messageCursor", next.get("cursor")!);
    if (next.has("_trail")) target.set("_messageTrail", next.get("_trail")!);
    navigate(target);
  }
  const errorId = error ? "wfe-action-error" : undefined;
  return (
    <section className="wfe-detail" aria-label="Selected enquiry" aria-busy={busy}>
      <div id="wfe-action-error">
        <Feedback message={error} />
      </div>
      {message && (
        <div className="notice success" role="status" tabIndex={-1} ref={confirmation}>
          {message}
        </div>
      )}
      {pending && (
        <section
          className="wfe-recovery"
          ref={recovery}
          tabIndex={-1}
          aria-labelledby="wfe-recovery-title"
        >
          <h2 id="wfe-recovery-title">Review an earlier enquiry change</h2>
          <p>
            The result could not be confirmed. Refreshing does not clear this lock.
            Current conversation data alone cannot prove whether the original request
            succeeded; no change will be resent automatically.
          </p>
          {pending !== "unknown" && pending.id !== id ? (
            <Link
              className="button secondary"
              href={enquiriesHref(new URLSearchParams({ selected: pending.id }))}
            >
              Open pending enquiry
            </Link>
          ) : (
            <>
              <button
                className="button secondary"
                disabled={recovering || !!proposal || !row}
                onClick={() => void reconcile(false)}
              >
                Inspect current enquiry
              </button>
              {inspection && (
                <>
                  <label className="wfe-check">
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
        <div className="wfe-feedback" role="alert">
          <h2>
            {record.denied || denied
              ? "Enquiry access unavailable"
              : "Enquiry could not be verified"}
          </h2>
          <p>Refresh enquiries to check the current conversation and your access.</p>
          <button className="button secondary" onClick={refresh}>
            Check enquiry again
          </button>
          <button className="button secondary" onClick={close}>
            Close selection
          </button>
        </div>
      )}
      {(busy || !enabled) && !denied && (
        <p className="wfe-state" role="status">
          Checking the selected enquiry…
        </p>
      )}
      {row && (
        <>
          <NotificationRecordContext
            resourceType="ENQUIRY"
            resourceId={row.id}
            supportMessageIds={row.messages.items.map((message) => message.id)}
          />
          <header className="wfe-detail-heading">
            <div>
              <h2 ref={title} tabIndex={-1}>
                {row.subject}
              </h2>
              <p>
                {enquiryLabel(row.type, row.vehicleEnquiryIntent)} ·{" "}
                <span
                  className={`wfe-status is-${row.status.toLowerCase()}`}
                  data-status={row.status}
                >
                  {enquiryStatusLabels[row.status]}
                </span>
              </p>
            </div>
            <button className="button secondary" onClick={close}>
              Close selection
            </button>
          </header>
          <div className="care-context">
            <strong>
              {row.contact?.name || "Customer identity not available in this scope"}
            </strong>
            {row.contact && (
              <CopyableValue value={row.contact.email} label="Copy customer email" />
            )}
            {canReplyEnquiry(row, access) && (
              <a className="care-next" href="#wfe-body">
                Write a reply
              </a>
            )}
          </div>{" "}
          <dl className="wfe-facts">
            <div>
              <dt>Branch</dt>
              <dd>{row.branch?.name ?? "Branch not recorded"}</dd>
            </div>
            <div>
              <dt>Assigned to</dt>
              <dd>{enquiryStaffName(row.assignedStaff)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>
                <time dateTime={row.createdAt}>{formatBusinessDate(row.createdAt)}</time>
              </dd>
            </div>
          </dl>
          {stale && (
            <section className="wfe-recovery">
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
          <div className="wfe-columns">
            <section
              className="wfe-panel wfe-conversation"
              aria-labelledby="wfe-conversation-title"
            >
              <h3 id="wfe-conversation-title">Conversation</h3>
              <div className="wfe-original">
                <h4>Original enquiry</h4>
                <p>{row.message}</p>
              </div>
              <ol className="wfe-messages">
                {[...row.messages.items].reverse().map((entry) => (
                  <li key={entry.id}>
                    <SupportTimelineEntry
                      entry={entry}
                      staff
                      highlighted={entry.id === params.get("messageId")}
                    />
                  </li>
                ))}
              </ol>
              {!row.messages.items.length && (
                <p>No customer-visible conversation updates have been recorded.</p>
              )}
              <footer>
                <p>Customer-visible messages only.</p>
                <nav className="wfe-paging" aria-label="Conversation pages">
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
            <div className="wfe-actions">
              <section className="wfe-panel" aria-labelledby="wfe-reply-title">
                <h3 id="wfe-reply-title">Reply to customer</h3>
                <p>This reply will be visible in the customer conversation.</p>
                {canReplyEnquiry(row, access) ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      review("reply");
                    }}
                  >
                    <div className="field">
                      <label htmlFor="wfe-body">Message</label>
                      <textarea
                        id="wfe-body"
                        value={draft?.body ?? ""}
                        maxLength={5000}
                        rows={5}
                        readOnly={blocked}
                        onChange={(e) => edit("body", e.target.value)}
                        aria-invalid={invalidField === "body"}
                        aria-describedby={`wfe-body-hint${invalidField === "body" && errorId ? ` ${errorId}` : ""}`}
                      />
                      <small id="wfe-body-hint">5000 characters maximum</small>
                    </div>
                    <button className="button" disabled={blocked || !draft}>
                      Review reply
                    </button>
                  </form>
                ) : (
                  <p>
                    {["OPEN", "IN_PROGRESS"].includes(row.status)
                      ? "Your current responsibilities allow viewing this enquiry. Replying requires reply access in this branch."
                      : `This enquiry is ${enquiryStatusLabels[row.status].toLowerCase()} and cannot receive a staff reply.`}
                  </p>
                )}
              </section>
              {canAssignEnquiry(row, access) && (
                <section className="wfe-panel" aria-labelledby="wfe-assignment-title">
                  <h3 id="wfe-assignment-title">
                    {careCaseAllows(access, "ENQUIRY", "assign", row)
                      ? "Care assignment"
                      : "Sales assignment"}
                  </h3>
                  <p>
                    Current assignee
                    <br />
                    <strong>{enquiryStaffName(row.assignedStaff)}</strong>
                  </p>
                  <button
                    className="button secondary"
                    aria-expanded={expanded}
                    aria-controls="wfe-assignment-fields"
                    onClick={() => setExpanded(!expanded)}
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                    {expanded ? "Hide assignment" : "Change assignee"}
                  </button>
                  {expanded && (
                    <div id="wfe-assignment-fields">
                      <p>
                        Choose an eligible colleague who can view and reply to this
                        enquiry in this branch.
                      </p>
                      <EnquiryCandidates
                        row={row}
                        selected={draft?.selected}
                        disabled={blocked}
                        onSelect={(value) => edit("selected", value)}
                        invalid={invalidField === "staff"}
                        errorId={errorId}
                      />
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          review("assignment");
                        }}
                      >
                        <div className="field">
                          <label htmlFor="wfe-reason">Reassignment reason</label>
                          <textarea
                            id="wfe-reason"
                            value={draft?.reason ?? ""}
                            maxLength={1000}
                            rows={4}
                            readOnly={blocked}
                            onChange={(e) => edit("reason", e.target.value)}
                            aria-invalid={invalidField === "reason"}
                            aria-describedby={`wfe-reason-hint${invalidField === "reason" && errorId ? ` ${errorId}` : ""}`}
                          />
                          <small id="wfe-reason-hint">
                            10–1000 characters. Internal; this is not sent as a customer
                            reply.
                          </small>
                        </div>
                        <button className="button" disabled={blocked || !draft}>
                          Review reassignment
                        </button>
                      </form>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
          <details className="care-secondary">
            <summary>Workflow and case reference</summary>
            <CopyableValue value={row.id} label="Copy case reference" />
            <WorkflowProgress workflow="enquiry" status={row.status} />
          </details>
          <SupportEmailDeliverySummary
            dismissPath={
              careCaseAllows(row.access, "ENQUIRY", "view", row)
                ? "/staff/workforce/enquiries/" + row.id + "/email-deliveries/dismiss"
                : undefined
            }
            page={row.emailDeliveries}
            loading={busy}
            error={failure}
            onRefresh={record.refresh}
          />
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
          onSuccess={() => setMessage("Enquiry change recorded.")}
        />
      )}
    </section>
  );
}
