"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import {
  draftIdentity,
  cancelDraftSubmission,
  draftKey,
  forgetDraft,
} from "@/lib/forms/drafts";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  jobAttempts,
  jobKey,
  jobName,
  jobPageParams,
  jobQuery,
  jobSelection,
  jobSnapshot,
  jobStatusLabel,
  parseCurrentJob,
  parseJobPage,
  validateJobRetry,
  type CurrentJob,
} from "@/lib/admin/work-processing-jobs";
import {
  clearJobPending,
  markJobPending,
  readJobPending,
  redactJobRetries,
  type JobPending,
} from "@/lib/admin/work-job-pending";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { OperationActionForm } from "./operation-action-form";
import { MutationReview, type MutationProposal } from "./mutation-review";
const root = "/admin/processing-jobs",
  endpoint = "/admin/operations/jobs";
export function OperationalJobs() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Processing jobs</h1>
        <Feedback message="Administrator access is required to view these records." />
      </>
    );
  return (
    <JobAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function JobAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    [denied, setDenied] = useState(false);
  const deny = useCallback(() => {
    redactJobRetries();
    setDenied(true);
  }, []);
  const invalid =
    !!access.data &&
    (access.data.id !== owner ||
      access.data.role !== role ||
      access.data.status !== "ACTIVE");
  useEffect(() => {
    if (invalid || access.denied) redactJobRetries();
  }, [invalid, access.denied]);
  const error =
    access.error ||
    access.refreshError ||
    (invalid ? "Current processing-job access could not be confirmed." : undefined);
  if (!access.data || access.loading || error || denied)
    return (
      <div className="work-jobs">
        <h1>Processing jobs</h1>
        <Feedback
          message={
            error ||
            (denied
              ? "Processing-job access is unavailable. Protected records have been cleared."
              : undefined)
          }
        />
        {access.loading && <p role="status">Checking processing-job access...</p>}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={() => {
            setDenied(false);
            access.refresh();
          }}
        >
          Refresh processing-job access
        </button>
      </div>
    );
  return (
    <JobWorkspace
      owner={owner}
      role={role}
      onDenied={deny}
      accessBusy={access.refreshing}
    />
  );
}
class JobPreflightError extends ApiError {
  constructor() {
    super(409, { error: { code: "CONFLICT" } });
    this.message =
      "No retry request was sent. Close this review and inspect current job details.";
  }
}
function JobWorkspace({
  owner,
  role,
  onDenied,
  accessBusy,
}: {
  owner: string;
  role: string;
  onDenied: () => void;
  accessBusy: boolean;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    query = jobQuery(new URLSearchParams(search.toString())),
    paramsText = query.params.toString();
  const key = query.invalid ? null : query.params.get("selected"),
    target = jobSelection(key);
  const [navigating, startNavigation] = useTransition(),
    [working, setWorking] = useState(false),
    [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [pending, setPending] = useState<JobPending | undefined>(() =>
    readJobPending(owner, role),
  );
  const [inspected, setInspected] = useState<CurrentJob>(),
    [recovery, setRecovery] = useState<CurrentJob>(),
    [acknowledged, setAcknowledged] = useState(false),
    [message, setMessage] = useState<string>();
  const [recoverySource, setRecoverySource] = useState("outbox"),
    [reference, setReference] = useState("");
  const parsePage = useCallback(
    (value: unknown) =>
      parseJobPage(value, new URLSearchParams(query.path?.split("?")[1])),
    [query.path],
  );
  const list = useResource(query.path, parsePage);
  const parseSelected = useCallback(
    (value: unknown) => parseCurrentJob(value, key ?? ""),
    [key],
  );
  const selected = useResource(
    target ? `${endpoint}/${target.source}/${target.id}` : null,
    parseSelected,
  );
  const active = useRef(true),
    flight = useRef(false),
    request = useRef<AbortController | null>(null),
    focus = useRef<string | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (list.denied || selected.denied) onDenied();
  }, [list.denied, selected.denied, onDenied]);
  useEffect(() => {
    if (proposal || !focus.current) return;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(focus.current ?? "");
      if (el) {
        focus.current = null;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: "nearest" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [key, proposal, selected.data, pending, recovery]);
  const blocked = list.denied || selected.denied;
  const row =
    !blocked && key
      ? inspected &&
        jobKey(inspected) === key &&
        (!selected.data ||
          Date.parse(inspected.updatedAt) >= Date.parse(selected.data.updatedAt))
        ? inspected
        : selected.data
      : undefined;
  const busy = working || navigating || accessBusy || !!proposal;
  const listError = list.error || list.refreshError,
    selectedError = selected.error || selected.refreshError;
  const disabled =
    busy ||
    !!pending ||
    blocked ||
    query.invalid ||
    selected.loading ||
    selected.refreshing ||
    !!selectedError;
  function navigate(params: URLSearchParams) {
    if (flight.current || proposal) return;
    startNavigation(() =>
      router.push(`${root}${params.size ? `?${params}` : ""}`, { scroll: false }),
    );
  }
  function select(nextKey?: string) {
    const next = new URLSearchParams(paramsText);
    if (nextKey) next.set("selected", nextKey);
    else next.delete("selected");
    focus.current = nextKey
      ? "job-detail-title"
      : key
        ? `job-open-${key}`
        : "job-queue-title";
    navigate(next);
  }
  function changeFilter(name: string, value: string) {
    const next = new URLSearchParams(paramsText);
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("cursor");
    next.delete("_trail");
    navigate(next);
  }
  function identity(signal?: AbortSignal) {
    if (!active.current || signal?.aborted || draftIdentity() !== `${owner}:${role}`)
      throw new JobPreflightError();
  }
  async function fresh(
    selection: { source: "outbox" | "webhook"; id: string },
    signal: AbortSignal,
  ) {
    const profile = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    identity(signal);
    if (profile.id !== owner || profile.role !== role || profile.status !== "ACTIVE") {
      onDenied();
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    }
    const record = parseCurrentJob(
      (await apiRequest(`${endpoint}/${selection.source}/${selection.id}`, { signal }))
        .data,
      `${selection.source}:${selection.id}`,
    );
    identity(signal);
    return record;
  }
  function handleDenied(error: unknown) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      onDenied();
      return true;
    }
    return false;
  }
  function review(next: MutationProposal, before: CurrentJob) {
    if (disabled || !row || jobSnapshot(row) !== jobSnapshot(before)) return;
    setMessage(undefined);
    setRecovery(undefined);
    setAcknowledged(false);
    setProposal({
      ...next,
      retrySafely: false,
      retryAfterRejection: false,
      onUncertain: () => {
        setPending(readJobPending(owner, role));
        focus.current = "job-recovery-title";
      },
      submit: async () => {
        if (flight.current) throw new JobPreflightError();
        flight.current = true;
        setWorking(true);
        const controller = new AbortController();
        request.current = controller;
        let sent = false,
          marker: Exclude<JobPending, "unknown"> | undefined;
        try {
          if (readJobPending(owner, role)) throw new JobPreflightError();
          const target = jobSelection(jobKey(before))!,
            current = await fresh(target, controller.signal);
          if (jobSnapshot(current) !== jobSnapshot(before)) {
            setInspected(current);
            list.refresh();
            throw new JobPreflightError();
          }
          identity(controller.signal);
          marker = markJobPending(owner, role, target);
          setPending(marker);
          sent = true;
          cancelDraftSubmission();
          validateJobRetry(await next.submit(), before);
          identity(controller.signal);
          clearJobPending(owner, role, marker.token);
          setPending(undefined);
          forgetDraft(
            draftKey(
              `${owner}:${role}`,
              root,
              JSON.stringify(["operation-action-form:1", jobKey(before)]),
            ),
          );
          setMessage(
            "Retry queued. Refresh the job to check processing; this does not confirm delivery or payment settlement.",
          );
          selected.refresh();
          list.refresh();
        } catch (error) {
          if (!active.current || handleDenied(error)) throw error;
          const definite =
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 429].includes(error.status);
          if (!sent || definite) {
            if (marker) {
              clearJobPending(owner, role, marker.token);
              setPending(undefined);
            }
            setMessage(
              sent
                ? "The server rejected the retry. Refresh current job details before reviewing another attempt."
                : "No retry request was sent. Inspect current job details before reviewing another attempt.",
            );
            if (!sent) throw new JobPreflightError();
            selected.refresh();
            throw error;
          }
          setPending(readJobPending(owner, role));
          throw Error("The retry outcome could not be confirmed");
        } finally {
          flight.current = false;
          if (active.current) setWorking(false);
        }
      },
    });
  }
  async function inspectRecovery() {
    if (flight.current || proposal || accessBusy) return;
    const recoveryKey =
      pending && pending !== "unknown"
        ? `${pending.source}:${pending.id}`
        : `${recoverySource}:${reference.trim()}`;
    const target = jobSelection(recoveryKey);
    if (!target) {
      setMessage("Enter a valid job reference and source to inspect.");
      document.getElementById("job-recovery-reference")?.focus();
      return;
    }
    flight.current = true;
    setWorking(true);
    setRecovery(undefined);
    setAcknowledged(false);
    setMessage(undefined);
    const controller = new AbortController();
    request.current = controller;
    try {
      const current = await fresh(target, controller.signal);
      setRecovery(current);
      if (jobKey(current) === key) setInspected(current);
      focus.current = "job-recovery-current";
    } catch (error) {
      if (!handleDenied(error) && active.current)
        setMessage(
          "Current job details could not be confirmed. The retry remains locked; try inspection again.",
        );
    } finally {
      flight.current = false;
      if (active.current) setWorking(false);
    }
  }
  function acknowledgeRecovery() {
    if (busy || !pending || !recovery || !acknowledged) return;
    try {
      identity();
      if (JSON.stringify(readJobPending(owner, role)) !== JSON.stringify(pending))
        throw Error("Recovery changed");
      clearJobPending(owner, role, pending === "unknown" ? undefined : pending.token);
      setPending(undefined);
      setRecovery(undefined);
      setAcknowledged(false);
      setMessage(
        "Reconciliation acknowledged. No retry was resent. Review current job details before another action.",
      );
      selected.refresh();
      list.refresh();
    } catch {
      setMessage("Recovery could not be cleared. Retry remains locked.");
    }
  }
  if (blocked) return null;
  const trail = query.params.get("_trail")?.split(",") ?? [],
    pageLabel =
      query.params.has("cursor") && !trail.length
        ? "Current page"
        : `Page ${trail.length + 1}`;
  return (
    <div className={`work-jobs${key ? " wj-selected" : ""}`}>
      <nav className="wj-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Processing jobs</span>
          </li>
        </ol>
      </nav>
      <header className="wj-heading">
        <div>
          <h1>Processing jobs</h1>
          <p>Review failed and active background work.</p>
        </div>
        <button
          className="button secondary"
          disabled={busy || list.loading || selected.loading}
          onClick={() => {
            list.refresh();
            selected.refresh();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh processing jobs
        </button>
      </header>
      <Feedback message={message} tone="info" />
      {query.invalid ? (
        <div className="notice">
          <p>These job filters or page references are invalid.</p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => navigate(new URLSearchParams())}
          >
            Reset job view
          </button>
        </div>
      ) : (
        <>
          {pending && (
            <section className="wj-recovery" aria-labelledby="job-recovery-title">
              <h2 id="job-recovery-title" tabIndex={-1}>
                Reconcile the earlier retry
              </h2>
              <p>
                The outcome could not be confirmed. Retries remain locked across reload.
                Inspect the current job and check authorized operational records before
                acknowledging reconciliation. Current state alone does not prove the
                earlier request succeeded.
              </p>
              {pending === "unknown" ? (
                <div className="wj-recovery-inputs">
                  <div className="field">
                    <label htmlFor="job-recovery-source">Job source to inspect</label>
                    <select
                      id="job-recovery-source"
                      value={recoverySource}
                      disabled={busy}
                      onChange={(e) => {
                        setRecoverySource(e.target.value);
                        setRecovery(undefined);
                        setAcknowledged(false);
                      }}
                    >
                      <option value="outbox">Outbox</option>
                      <option value="webhook">Payment webhook</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="job-recovery-reference">
                      Job reference to inspect
                    </label>
                    <input
                      id="job-recovery-reference"
                      value={reference}
                      disabled={busy}
                      onChange={(e) => {
                        setReference(e.target.value);
                        setRecovery(undefined);
                        setAcknowledged(false);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="wj-reference">
                  {pending.source === "outbox" ? "Outbox" : "Payment webhook"}:{" "}
                  {pending.id}
                </p>
              )}
              <button
                className="button secondary"
                disabled={busy}
                onClick={inspectRecovery}
              >
                Inspect current job
              </button>
              {recovery && (
                <div>
                  <h3 id="job-recovery-current" tabIndex={-1}>
                    Current inspection
                  </h3>
                  <p>
                    {jobName(recovery)}: {jobStatusLabel(recovery.status)}.{" "}
                    {jobAttempts(recovery)} recorded attempts.
                  </p>
                  <p>{formatStockInstant(recovery.updatedAt)}</p>
                  <label className="wj-ack">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      disabled={busy}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                    I independently reconciled the earlier retry using authorized
                    operational records.
                  </label>
                  <button
                    className="button secondary"
                    disabled={busy || !acknowledged}
                    onClick={acknowledgeRecovery}
                  >
                    Acknowledge reconciliation
                  </button>
                </div>
              )}
            </section>
          )}
          <div className="wj-filters">
            <div className="field">
              <label htmlFor="job-source">Job source</label>
              <select
                id="job-source"
                value={query.source}
                disabled={busy}
                onChange={(e) => changeFilter("source", e.target.value)}
              >
                <option value="OUTBOX">Outbox</option>
                <option value="PAYMENT_WEBHOOK">Payment webhook</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="job-status">Job status</label>
              <select
                id="job-status"
                value={query.params.get("status") ?? ""}
                disabled={busy}
                onChange={(e) => changeFilter("status", e.target.value)}
              >
                <option value="">All</option>
                {["FAILED", "DEAD_LETTER", "PROCESSING"].map((status) => (
                  <option key={status} value={status}>
                    {jobStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                const next = new URLSearchParams();
                if (key) next.set("selected", key);
                navigate(next);
              }}
            >
              Clear filters
            </button>
          </div>
          {key && (
            <button
              className="button secondary wj-back"
              disabled={busy}
              onClick={() => select()}
            >
              Back to job list
            </button>
          )}
          <div className="wj-workspace">
            <section className="wj-queue" aria-labelledby="job-queue-title">
              <h2 id="job-queue-title" className="sr-only" tabIndex={-1}>
                Processing job queue
              </h2>
              <Feedback message={listError} />
              {list.refreshError && list.data && (
                <p className="notice">
                  Previously loaded jobs are shown. Refresh successfully before paging.
                </p>
              )}
              {list.loading && <p role="status">Checking processing jobs...</p>}
              {!list.loading && !list.error && list.data && (
                <>
                  <p className="wj-count" role="status">
                    {list.data.items.length} on this page · Recently updated
                  </p>
                  {!list.data.items.length && (
                    <div className="wj-empty">
                      <h3>No matching jobs</h3>
                      <p>Try another status or source, or refresh for updates.</p>
                    </div>
                  )}
                  {list.data.items.map((job) => (
                    <article
                      className={`wj-row${jobKey(job) === key ? " selected" : ""}`}
                      key={jobKey(job)}
                    >
                      <h3>{jobName(job)}</h3>
                      {jobName(job) !== job.eventType && (
                        <p className="wj-event-type">{job.eventType}</p>
                      )}
                      <p className={`wj-status ${job.status.toLowerCase()}`}>
                        {jobStatusLabel(job.status)}
                      </p>
                      <p className="wj-row-facts">
                        {jobAttempts(job)}{" "}
                        {jobAttempts(job) === 1 ? "attempt" : "attempts"}
                        <span>{formatStockInstant(job.updatedAt)}</span>
                      </p>
                      <button
                        id={`job-open-${jobKey(job)}`}
                        className="text-link"
                        disabled={busy}
                        onClick={() => select(jobKey(job))}
                      >
                        Inspect job
                        <span className="sr-only">
                          {" "}
                          {job.eventType}, reference {job.id}
                        </span>
                      </button>
                    </article>
                  ))}
                </>
              )}
              <nav className="wj-pages" aria-label="Processing jobs pages">
                <button
                  className="button secondary"
                  disabled={busy || list.loading || !!listError || !trail.length}
                  onClick={() => navigate(jobPageParams(query.params, undefined, true))}
                >
                  Previous
                </button>
                <span>{pageLabel}</span>
                <button
                  className="button secondary"
                  disabled={busy || list.loading || !!listError || !list.data?.nextCursor}
                  onClick={() =>
                    navigate(jobPageParams(query.params, list.data?.nextCursor))
                  }
                >
                  Next
                </button>
                {query.params.has("cursor") && (
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() => {
                      const next = new URLSearchParams(paramsText);
                      next.delete("cursor");
                      next.delete("_trail");
                      navigate(next);
                    }}
                  >
                    First page
                  </button>
                )}
              </nav>
            </section>
            {key && (
              <section className="wj-inspection" aria-labelledby="job-detail-title">
                <div className="wj-inspection-heading">
                  <h2 id="job-detail-title" tabIndex={-1}>
                    {row ? jobName(row) : "Job inspection"}
                  </h2>
                  <button
                    className="button secondary wj-close"
                    disabled={busy}
                    onClick={() => select()}
                  >
                    Close inspection
                  </button>
                </div>
                <Feedback message={selectedError} />
                {selectedError && row && (
                  <p className="notice">
                    Previously loaded details are shown. Refresh successfully before
                    retrying.
                  </p>
                )}
                {selected.loading && <p role="status">Checking current job...</p>}
                {row && (
                  <>
                    <p className="wj-event-type">{row.eventType}</p>
                    <p className={`wj-status ${row.status.toLowerCase()}`}>
                      {jobStatusLabel(row.status)}
                    </p>
                    <JobFacts row={row} />
                    <section className="wj-retry">
                      <h3>Review a retry</h3>
                      {!["FAILED", "DEAD_LETTER"].includes(row.status) ? (
                        <p className="notice">
                          {row.status === "PROCESSING"
                            ? "Processing is already in progress. Refresh to check its outcome; a manual retry is unavailable."
                            : "This job is not failed or dead letter. A manual retry is unavailable."}
                        </p>
                      ) : jobAttempts(row) > 1000 ? (
                        <p className="notice">
                          This attempt count is outside the supported manual retry range.
                          Operational investigation is required.
                        </p>
                      ) : (
                        <>
                          <p>
                            Investigate the failure and previous processing before
                            retrying. Queueing does not confirm completion.
                          </p>
                          <JobRetry
                            key={jobKey(row)}
                            row={row}
                            disabled={disabled}
                            uncertain={!!pending}
                            onReview={(next) => review(next, row)}
                          />
                        </>
                      )}
                    </section>
                  </>
                )}
              </section>
            )}
          </div>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
function JobFacts({ row }: { row: CurrentJob }) {
  const stamp = (value: string | null) =>
    value ? formatStockInstant(value) : "Not recorded";
  const facts = [
    ["Source", row.source === "OUTBOX" ? "Outbox" : "Payment webhook"],
    ["Processing attempts", String(jobAttempts(row))],
    ["Updated", stamp(row.updatedAt)],
    ["Processing lock", stamp(row.lockedAt)],
    ...(row.source === "OUTBOX"
      ? [
          ["Available from", stamp(row.availableAt)],
          ["Created", stamp(row.createdAt)],
          ["Published", stamp(row.publishedAt)],
        ]
      : [
          ["Received", stamp(row.receivedAt)],
          ["Next scheduled attempt", stamp(row.nextAttemptAt)],
          ["Processed", stamp(row.processedAt)],
          ["Failed", stamp(row.failedAt)],
        ]),
  ];
  return (
    <>
      <h3>Current job details</h3>
      <dl className="wj-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details className="wj-references">
        <summary>References</summary>
        <dl>
          <dt>Job reference</dt>
          <dd>{row.id}</dd>
          {row.source === "OUTBOX" && (
            <>
              <dt>Event reference</dt>
              <dd>{row.eventId}</dd>
              <dt>Related record</dt>
              <dd>
                {row.aggregateType}: {row.aggregateId}
              </dd>
            </>
          )}
        </dl>
        <p>
          Use the job reference in authorized operational logs to investigate failure
          details.
        </p>
      </details>
    </>
  );
}
function JobRetry({
  row,
  disabled,
  uncertain,
  onReview,
}: {
  row: CurrentJob;
  disabled: boolean;
  uncertain: boolean;
  onReview: (p: MutationProposal) => void;
}) {
  const attempts = jobAttempts(row),
    source = row.source === "OUTBOX" ? "outbox" : "webhook";
  return (
    <OperationActionForm
      id={jobKey(row)}
      revision={jobSnapshot(row)}
      label="Job retry"
      options={["RETRY"]}
      maxLength={500}
      disabled={disabled}
      uncertain={uncertain}
      onReview={onReview}
      proposal={(values) => {
        const body: RequestBody<"/admin/operations/jobs/{source}/{jobId}/retry", "post"> =
          {
            expectedAttempts: attempts,
            expectedUpdatedAt: row.updatedAt,
            reason: values.reason,
          };
        return {
          title: "Queue another processing attempt?",
          description:
            source === "outbox"
              ? "This can send a notification or run another business event. Investigate the failure and any prior delivery before retrying. Queueing does not confirm that the event completed."
              : "This queues the stored payment webhook for processing again. It may update financial or fulfilment records. Reconcile previous processing before retrying; this does not prove payment or refund completion.",
          facts: [
            { label: "Job", value: row.id },
            {
              label: "Source",
              value: source === "outbox" ? "Outbox" : "Payment webhook",
            },
            { label: "Event", value: row.eventType },
            { label: "Current status", value: jobStatusLabel(row.status) },
            { label: "Recorded attempts", value: String(attempts) },
            { label: "Inspected revision", value: formatStockInstant(row.updatedAt) },
            { label: "Reason", value: values.reason },
          ],
          submit: async () =>
            (
              await apiRequest(`${endpoint}/${source}/${row.id}/retry`, {
                method: "POST",
                csrf: true,
                body,
              })
            ).data,
        };
      }}
    />
  );
}
