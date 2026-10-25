"use client";
import { enquiryLabel } from "@/lib/support/enquiry-label";
import { NotificationRecordContext } from "./notification-record-context";
import { SupportTimelineEntry } from "./support-timeline-entry";
import { CopyableValue } from "./copyable-value";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { SupportEmailDelivery } from "./support-email-delivery";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, ArrowLeft } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { type SupportKind, type SupportRecord } from "@/lib/api/support-schemas";
import {
  clearThreadPending,
  forgetThreadDrafts,
  markThreadPending,
  mergeThread,
  parseStaffThread,
  parseThreadMessages,
  readThreadPending,
  threadAtLeast,
  threadMessagesQuery,
  threadPageParams,
  threadSnapshot,
  validateThreadChange,
  type ThreadPending,
  type ThreadReceipt,
} from "@/lib/admin/work-support-detail";
import { supportLabel } from "@/lib/admin/work-support";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { SupportStaffActions } from "./support-staff-actions";
import { ComplaintAcknowledgement } from "./complaint-acknowledgement";
import { SupportReplyForm } from "./support-reply-form";
type HistorySeed = { path: string; data: ReturnType<typeof parseThreadMessages> };
export function WorkSupportDetail({ kind, id }: { kind: SupportKind; id: string }) {
  const session = useAccountSession();
  if (!session) return null;
  return ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <ThreadAccess
      key={`${session.user.id}:${session.user.role}:${kind}:${id}`}
      owner={session.user.id}
      role={session.user.role}
      kind={kind}
      id={id}
    />
  ) : (
    <Feedback message="Staff access is required to view this conversation." />
  );
}
function ThreadAccess({
  owner,
  role,
  kind,
  id,
}: {
  owner: string;
  role: string;
  kind: SupportKind;
  id: string;
}) {
  const access = useOwnStaffPermissions(),
    p = access.data,
    error =
      access.error ||
      access.refreshError ||
      (p &&
      (p.id !== owner ||
        p.role !== role ||
        p.status !== "ACTIVE" ||
        (role === "STAFF" && !p.staffProfile?.branchId))
        ? "Current conversation access and branch assignment could not be confirmed."
        : undefined);
  if (!p || error)
    return (
      <div className="work-inspections work-support-detail">
        <h1>Conversation</h1>
        {error ? (
          <>
            <Feedback message={error} />
            <button
              className="button secondary"
              disabled={access.loading || access.refreshing}
              onClick={access.refresh}
            >
              Retry conversation access
            </button>
          </>
        ) : (
          <p role="status">Checking conversation access…</p>
        )}
      </div>
    );
  return (
    <ThreadWorkspace
      key={`${kind}:${id}:${role === "STAFF" ? p.staffProfile?.branchId : "all"}`}
      owner={owner}
      role={role}
      kind={kind}
      id={id}
      branchId={role === "STAFF" ? p.staffProfile?.branchId : undefined}
      refreshAccess={access.refresh}
    />
  );
}
function ThreadWorkspace({
  owner,
  role,
  kind,
  id,
  branchId,
  refreshAccess,
}: {
  owner: string;
  role: string;
  kind: SupportKind;
  id: string;
  branchId?: string | null;
  refreshAccess: () => void;
}) {
  const base = `/staff/support/${kind}/${id}`,
    seen = useRef<SupportRecord | undefined>(undefined),
    active = useRef(true),
    request = useRef<AbortController | null>(null);
  const [observed, setObserved] = useState<SupportRecord>(),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [pending, setPending] = useState<ThreadPending | undefined>(() =>
      readThreadPending(owner, role, kind, id),
    ),
    [message, setMessage] = useState<string>(),
    [tone, setTone] = useState<"error" | "success">("error"),
    [checking, setChecking] = useState(false),
    [unavailable, setUnavailable] = useState(false),
    [generation, setGeneration] = useState(0),
    [revision, setRevision] = useState(0),
    [lastReceipt, setLastReceipt] = useState<ThreadReceipt>(),
    [historySeed, setHistorySeed] = useState<HistorySeed>();
  const parse = useCallback(
      (value: unknown) => {
        const row = parseStaffThread(value, id, kind, role, branchId);
        if (seen.current && !threadAtLeast(row, seen.current))
          throw Error("An older conversation was returned.");
        return row;
      },
      [id, kind, role, branchId],
    ),
    resource = useResource(base, parse);
  useEffect(() => {
    if (resource.data) seen.current = mergeThread(seen.current, resource.data);
  }, [resource.data]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const current =
      unavailable || !resource.data ? undefined : mergeThread(observed, resource.data),
    busy = resource.loading || resource.refreshing || checking,
    error = resource.error || resource.refreshError,
    disabled = busy || !!error || !!pending || !!proposal || !current;
  const deny = useCallback(() => {
    setUnavailable(true);
    setHistorySeed(undefined);
    setLastReceipt(undefined);
    refreshAccess();
  }, [refreshAccess]);
  function identity(signal: AbortSignal) {
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Conversation account changed");
  }
  function adopt(row: SupportRecord) {
    const next = mergeThread(seen.current, row);
    seen.current = next;
    setObserved(next);
  }
  async function fresh(signal: AbortSignal) {
    const p = parseOwnStaffProfile((await apiRequest("/staff/profile", { signal })).data);
    identity(signal);
    if (
      p.id !== owner ||
      p.role !== role ||
      p.status !== "ACTIVE" ||
      (role === "STAFF" && p.staffProfile?.branchId !== branchId)
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    const row = parseStaffThread(
      (await apiRequest(base, { signal })).data,
      id,
      kind,
      role,
      branchId,
    );
    identity(signal);
    if (seen.current && !threadAtLeast(row, seen.current))
      throw Error("Older conversation snapshot");
    return row;
  }
  function notSent() {
    const e = new ApiError(400, { error: { code: "REQUEST_FAILED" } });
    e.message =
      "No change was sent. Current access, reviewed facts or recovery storage could not be confirmed. Your draft is kept; refresh and reload affected fields before reviewing again.";
    return e;
  }
  function review(offer: MutationProposal) {
    const change = offer.supportChange;
    if (disabled || !current || !change) return;
    const before = current,
      snapshot = threadSnapshot(before, change);
    let sent = false,
      marker: Exclude<ThreadPending, "unknown"> | undefined,
      added = true;
    setMessage(undefined);
    setTone("error");
    setProposal({
      ...offer,
      retrySafely: false,
      retryAfterRejection: false,
      onConfirmed: () => {
        if (added) offer.onConfirmed?.();
      },
      onUncertain: () => {
        if (sent && active.current)
          setPending(readThreadPending(owner, role, kind, id) ?? "unknown");
      },
      submit: async () => {
        if (request.current || !active.current) throw notSent();
        const controller = new AbortController();
        request.current = controller;
        try {
          const latest = await fresh(controller.signal);
          if (threadSnapshot(latest, change) !== snapshot) {
            adopt(latest);
            throw notSent();
          }
          if (
            (change.kind === "reply" || change.kind === "acknowledgement") &&
            latest.status === "CLOSED"
          )
            throw notSent();
          marker = markThreadPending(owner, role, kind, id, change.kind, before.version);
          sent = true;
          setPending(marker);
          const response = await offer.submit();
          identity(controller.signal);
          const saved = validateThreadChange(response, change, before, role, branchId);
          added = saved.added;
          if (saved.record) adopt(saved.record);
          if (saved.receipt) setLastReceipt(saved.receipt);
          try {
            clearThreadPending(owner, role, kind, id, marker.token);
            setPending(undefined);
          } catch {
            setPending(readThreadPending(owner, role, kind, id) ?? "unknown");
          }
          setTone("success");
          setMessage(
            added
              ? "Conversation change recorded. Review the saved facts and messages."
              : "This complaint was already acknowledged. Your response was not added.",
          );
          setRevision((v) => v + 1);
          resource.refresh();
        } catch (e) {
          const submitted = sent;
          if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
          if (sent && e instanceof ApiError && [408, 429].includes(e.status))
            throw Error("Conversation outcome needs reconciliation");
          if (sent && e instanceof ApiError && e.status >= 400 && e.status < 500) {
            clearThreadPending(owner, role, kind, id, marker!.token);
            sent = false;
            setPending(undefined);
          }
          if (!sent) {
            setPending(readThreadPending(owner, role, kind, id));
            if (submitted) throw e;
            throw notSent();
          }
          throw e;
        } finally {
          request.current = null;
        }
      },
    });
  }
  async function loadCurrent() {
    if (request.current || proposal) return;
    const c = new AbortController();
    request.current = c;
    setChecking(true);
    setTone("error");
    setMessage(undefined);
    try {
      const row = await fresh(c.signal),
        query = threadMessagesQuery(new URLSearchParams(window.location.search), base);
      if (!query.path) throw Error("Reset invalid message filters first");
      const history = parseThreadMessages(
        (await apiRequest(query.path, { signal: c.signal })).data,
        query.params.get("cursor"),
      );
      identity(c.signal);
      if (pending) {
        forgetThreadDrafts(owner, role, kind, id);
        clearThreadPending(owner, role, kind, id);
        setPending(undefined);
        setGeneration((v) => v + 1);
      }
      adopt(row);
      setHistorySeed({ path: query.path, data: history });
      setLastReceipt(undefined);
      setUnavailable(false);
      setTone("success");
      setMessage(
        pending
          ? "Current conversation and message page loaded. No change was resent; the previous request outcome is not proven. Unsaved fields were replaced."
          : "Current conversation and message page loaded. No change was resent.",
      );
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) deny();
      if (active.current)
        setMessage(
          "Current conversation details could not be confirmed. No change was resent. Check access, message filters and recovery storage before trying again.",
        );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  return (
    <div
      className="work-inspections work-support-detail"
      data-support-owner={`${owner}:${role}`}
      data-support-path={`/admin/support/${kind}/${id}`}
    >
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link href="/admin/support">Customer care</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{current?.subject ?? "Conversation"}</span>
      </nav>
      <header className="wi-header">
        <div>
          <h1>{current?.subject ?? "Conversation"}</h1>
          {current && (
            <div className="wst-badges">
              <span className="status" data-status={current.status}>
                {supportLabel(current.status)}
              </span>
              <span>
                {current.kind === "enquiries"
                  ? enquiryLabel(current.type, current.vehicleEnquiryIntent)
                  : `${supportLabel(current.priority)} priority`}
              </span>
            </div>
          )}
        </div>
        <div className="wst-actions">
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => (unavailable ? void loadCurrent() : resource.refresh())}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh conversation
          </button>
          <Link className="button secondary" href="/admin/support">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to customer care
          </Link>
        </div>
      </header>
      <Feedback message={message} tone={tone} />
      {pending && (
        <section className="wi-state">
          <h2>A conversation change needs reconciliation</h2>
          <p>
            Loading the current record and message page replaces unsaved fields. It does
            not resend the change or establish the original request outcome.
          </p>
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => void loadCurrent()}
          >
            Load current conversation
          </button>
        </section>
      )}
      {busy && (
        <p className="wi-state" role="status">
          {current ? "Refreshing conversation…" : "Checking conversation…"}
        </p>
      )}
      {(error || unavailable) && (
        <section className="wi-state">
          <Feedback
            message={
              error ?? "This conversation is unavailable under your current access."
            }
          />
          {current && (
            <p>
              Previously loaded conversation facts are shown. Changes remain disabled
              until a fresh read succeeds.
            </p>
          )}
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => (unavailable ? void loadCurrent() : resource.refresh())}
          >
            Retry conversation
          </button>
        </section>
      )}
      {current && (
        <div key={generation}>
          <nav className="wst-sections" aria-label="Conversation sections">
            {[
              ["details", "Details"],
              ["messages", "Messages"],
              ["reply", "Reply"],
              ["management", "Management"],
            ].map(([anchor, label]) => (
              <a key={anchor} href={`#conversation-${anchor}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="care-context">
            <strong>{current.contact?.name || "Customer contact not recorded"}</strong>
            <CopyableValue value={current.contact?.email} label="Copy customer email" />
            <span>
              Assigned to{" "}
              {current.assignedStaff
                ? current.assignedStaff.firstName + " " + current.assignedStaff.lastName
                : "Unassigned"}
            </span>
            <a className="care-next" href="#conversation-reply">
              {current.status === "CLOSED"
                ? "Review conversation"
                : "Write a reply / internal note"}
            </a>
          </div>
          <section className="wi-card">
            <h2>Original request</h2>
            <p className="preserve-lines">
              {current.text.length > 240
                ? current.text.slice(0, 240) + "…"
                : current.text}
            </p>
            {current.text.length > 240 && (
              <details>
                <summary>Read the full original request</summary>
                <p className="preserve-lines">{current.text}</p>
              </details>
            )}
          </section>
          <div className="wst-workspace">
            <div>
              <ThreadHistory
                record={current}
                base={base}
                disabled={disabled}
                readDisabled={busy || !!error}
                onReview={review}
                revision={revision}
                onDenied={deny}
                seed={historySeed}
              />
            </div>
            <aside id="conversation-management" aria-label="Conversation management">
              <SupportStaffActions
                record={current}
                base={base}
                disabled={disabled}
                onSaved={() => {}}
                onUncertain={() => {}}
                onReview={review}
              />
              <ComplaintAcknowledgement
                record={current}
                base={base}
                disabled={disabled}
                onSaved={() => {}}
                onUncertain={() => {}}
                onReview={review}
              />
            </aside>
          </div>
          <details className="care-secondary">
            <summary>Case details, workflow and technical references</summary>
            <WorkflowProgress
              workflow={kind === "enquiries" ? "enquiry" : "complaint"}
              status={current.status}
            />
            <ThreadFacts record={current} />
          </details>
          <SupportEmailDelivery base={base} revision={revision} />
          {lastReceipt && (
            <section
              className={`wi-card wst-confirmed${lastReceipt.visibility === "INTERNAL" ? " wst-internal" : ""}`}
              aria-labelledby="wst-confirmed"
            >
              <h2 id="wst-confirmed">Last confirmed update</h2>
              <SupportTimelineEntry entry={lastReceipt} staff anchored={false} />
            </section>
          )}
        </div>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel={
            proposal.supportChange?.kind === "acknowledgement"
              ? "Record acknowledgement"
              : proposal.supportChange?.kind === "reply"
                ? proposal.supportChange.body.visibility === "INTERNAL"
                  ? "Save internal note"
                  : "Send reply"
                : `Confirm ${proposal.supportChange?.kind ?? "support"} change`
          }
          onClose={() => {
            setProposal(null);
            resource.refresh();
          }}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
function ThreadFacts({ record: r }: { record: SupportRecord }) {
  const dates = [
    { label: "Created", value: r.createdAt },
    { label: "Updated", value: r.updatedAt },
    { label: "Resolved", value: r.resolvedAt },
    { label: "Closed", value: r.closedAt },
    ...(r.kind === "complaints"
      ? [
          { label: "Acknowledged", value: r.acknowledgedAt },
          { label: "Acknowledgement due", value: r.acknowledgementDueAt },
          { label: "Escalated", value: r.escalatedAt },
        ]
      : []),
  ];
  return (
    <div id="conversation-details">
      <div className="wst-overview">
        <section className="wi-card">
          <h2>Record and handling</h2>
          <dl className="wst-facts">
            {[
              { label: "Reference", value: r.id },
              { label: "Version", value: String(r.version) },
              {
                label: "Branch",
                value: r.branch
                  ? `${r.branch.name} (${r.branch.code})`
                  : "Unassigned branch",
              },
              { label: "Branch reference", value: r.branchId ?? "Not recorded" },
              {
                label: "Assigned staff",
                value: r.assignedStaff
                  ? `${r.assignedStaff.firstName} ${r.assignedStaff.lastName}`
                  : "Unassigned",
              },
              { label: "Staff reference", value: r.assignedStaffId ?? "Not recorded" },
              ...dates
                .filter((d) => d.label === "Created" || d.label === "Updated" || d.value)
                .map((d) => ({ label: d.label, value: formatStockInstant(d.value) })),
            ].map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="wi-card">
          <h2>Contact</h2>
          <dl className="wst-facts">
            {[
              { label: "Name", value: r.contact?.name },
              { label: "Email", value: r.contact?.email },
              { label: "Phone", value: r.contact?.phone },
              { label: "Customer profile reference", value: r.contact?.customerId },
            ].map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value || "Not recorded"}</dd>
              </div>
            ))}
          </dl>
          {!r.contact?.customerId && (
            <p className="notice">
              This record has no linked customer account. Customer-visible replies are
              emailed to the supplied address. Check Customer email delivery below.
              Replies from the customer arrive in the Support mailbox; they are not
              imported here.
            </p>
          )}
        </section>
      </div>
      <section className="wi-card">
        <h2>Original {r.kind === "enquiries" ? "message" : "complaint"}</h2>
        <p className="preserve-lines">{r.text}</p>
        {r.kind === "complaints" && r.resolution && (
          <>
            <h3>Resolution</h3>
            <p className="preserve-lines">{r.resolution}</p>
          </>
        )}
      </section>
    </div>
  );
}
function useThreadHistory(
  path: string | null,
  cursor: string | null,
  revision: number,
  seed?: HistorySeed,
) {
  const parse = useCallback(
    (value: unknown) => parseThreadMessages(value, cursor),
    [cursor],
  );
  return useResource(path, parse, seed?.path === path ? seed.data : undefined, {
    refreshKey: revision,
    revalidateOnMount: !seed,
  });
}
function ThreadHistory({
  record,
  base,
  disabled,
  readDisabled,
  onReview,
  revision,
  onDenied,
  seed,
}: {
  record: SupportRecord;
  base: string;
  disabled: boolean;
  readDisabled: boolean;
  onReview: (p: MutationProposal) => void;
  revision: number;
  onDenied: () => void;
  seed?: HistorySeed;
}) {
  const search = useSearchParams(),
    router = useRouter(),
    query = threadMessagesQuery(new URLSearchParams(search.toString()), base),
    path = readDisabled ? null : query.path;
  const messages = useThreadHistory(path, query.params.get("cursor"), revision, seed),
    error = messages.error || messages.refreshError,
    busy = messages.loading || messages.refreshing,
    blocked = readDisabled || busy || !!error || !messages.data;
  useEffect(() => {
    if (messages.denied) onDenied();
  }, [messages.denied, onDenied]);
  function navigate(params: URLSearchParams) {
    router.push(window.location.pathname + (params.size ? `?${params}` : ""), {
      scroll: false,
    });
  }
  return (
    <>
      {!blocked && !query.invalid && (
        <NotificationRecordContext
          resourceType={record.kind === "enquiries" ? "ENQUIRY" : "COMPLAINT"}
          resourceId={record.id}
          supportMessageIds={messages.data?.items.map((message) => message.id)}
        />
      )}
      <div id="conversation-reply">
        <SupportReplyForm
          record={record}
          staff
          base={base}
          disabled={disabled || blocked || query.invalid}
          onSaved={() => {}}
          onUncertain={() => {}}
          onReview={onReview}
        />
      </div>
      <section className="wi-card" id="conversation-messages">
        <div className="wst-message-header">
          <h2>Messages</h2>
          <button
            className="button secondary"
            disabled={busy || readDisabled || query.invalid}
            onClick={messages.refresh}
          >
            Refresh messages
          </button>
        </div>
        <p className="wst-meta">
          Replies and status updates appear in chronological order. Use Next for later
          pages. Refresh to check for updates; this is not a live-agent chat.
        </p>
        {query.invalid ? (
          <div className="wi-state">
            <h3>Message filters unavailable</h3>
            <p>This link contains invalid message paging filters.</p>
            <button
              className="button secondary"
              disabled={readDisabled}
              onClick={() => navigate(new URLSearchParams())}
            >
              Reset message filters
            </button>
          </div>
        ) : (
          <>
            {busy && <p role="status">Checking messages…</p>}
            {readDisabled && <p>Refresh the conversation before loading messages.</p>}
            {error && (
              <div className="wi-state">
                <Feedback message={error} />
                {messages.data && (
                  <p>
                    Previously loaded messages are shown. Changes remain disabled until a
                    fresh page succeeds.
                  </p>
                )}
                <button
                  className="button secondary"
                  disabled={busy || readDisabled}
                  onClick={messages.refresh}
                >
                  Retry messages
                </button>
              </div>
            )}
            {!busy &&
              !error &&
              !readDisabled &&
              messages.data &&
              !messages.data.items.length && <p>No conversation updates on this page.</p>}
            <div className="wst-messages">
              {messages.data?.items.map((m) => (
                <SupportTimelineEntry
                  key={m.id}
                  entry={m}
                  staff
                  highlighted={m.id === query.params.get("messageId")}
                />
              ))}
            </div>
            <nav className="wi-pagination" aria-label="Conversation messages pages">
              <button
                className="button secondary"
                disabled={blocked || !query.params.has("_trail")}
                onClick={() => navigate(threadPageParams(query.params, undefined, true))}
              >
                Previous
              </button>
              <button
                className="button secondary"
                disabled={blocked || !messages.data?.hasMore}
                onClick={() =>
                  navigate(
                    threadPageParams(query.params, messages.data?.cursor ?? undefined),
                  )
                }
              >
                Next
              </button>
            </nav>
          </>
        )}
      </section>
    </>
  );
}
