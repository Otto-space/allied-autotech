"use client";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  ChevronRight,
  MapPin,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  jobsHref,
  workforceJobsQuery,
  workStatusLabels,
} from "@/lib/admin/workforce-jobs";
import {
  bookingStateLabels,
  jobActionAllowed,
  jobRevision,
  JobFieldError,
  parseWorkforceJobCandidates,
  parseWorkforceJobDetail,
  reviewReason,
  technicalChange,
  technicianName,
  validateJobReceipt,
  workTransitions,
  type WorkforceJobCandidate,
  type WorkforceJobChange,
  type WorkforceJobDetail as Job,
} from "@/lib/admin/workforce-job-detail";
import {
  clearWorkforceJobPending,
  markWorkforceJobPending,
  readWorkforceJobPending,
  type WorkforceJobPending,
} from "@/lib/admin/workforce-job-pending";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import "./workforce-job-detail.css";

type Draft = {
  base: Job;
  diagnosis: string;
  internalNotes: string;
  status: string;
  findings: string;
  reason: string;
  selected?: WorkforceJobCandidate;
};
const newDraft = (job: Job): Draft => ({
  base: job,
  diagnosis: job.workOrder?.diagnosis ?? "",
  internalNotes: job.workOrder?.internalNotes ?? "",
  status: "",
  findings: "",
  reason: "",
});
const stateName = (state: string) =>
  Object.hasOwn(workStatusLabels, state)
    ? workStatusLabels[state as keyof typeof workStatusLabels]
    : "Status unavailable";
function rejection(message: string) {
  const error = new ApiError(409, { error: { code: "CONFLICT" } });
  error.message = message;
  return error;
}

export function WorkforceJobDetail({
  id,
  access,
  refreshAccess,
}: {
  id: string;
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const search = useSearchParams(),
    query = workforceJobsQuery(new URLSearchParams(search.toString()));
  const back = jobsHref(query.invalid ? new URLSearchParams() : query.params);
  const record = useResource(`/staff/workforce/jobs/${id}`, parseWorkforceJobDetail);
  const [draft, setDraft] = useState<Draft>();
  const [pending, setPending] = useState<WorkforceJobPending>();
  const [storageReady, setStorageReady] = useState(false);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [error, setError] = useState<string>(),
    [message, setMessage] = useState<string>();
  const [invalidField, setInvalidField] = useState<JobFieldError["field"]>();
  const [inspection, setInspection] = useState<string>(),
    [independent, setIndependent] = useState(false),
    [recovering, setRecovering] = useState(false);
  const confirmation = useRef<HTMLDivElement>(null);
  const recovery = useRef<HTMLElement>(null);
  const busy = record.loading || record.refreshing;
  const mismatch =
    !!record.data &&
    (record.data.id !== id || !sameWorkforceScope(access, record.data.access));
  const failure = record.error || record.refreshError;
  const job = !busy && !failure && !mismatch ? record.data : undefined;
  const stale =
    !!job &&
    !!draft &&
    (jobRevision(job) !== jobRevision(draft.base) ||
      !sameWorkforceScope(access, draft.base.access));
  const blocked = !storageReady || !!pending || !!proposal || stale || recovering;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setPending(readWorkforceJobPending(access.userId));
        setStorageReady(true);
      }
    });
    function discard() {
      setDraft(undefined);
      setProposal(null);
      setInspection(undefined);
      setIndependent(false);
      setPending(readWorkforceJobPending(access.userId));
    }
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [access.userId]);
  useEffect(() => {
    let active = true;
    if (job && !draft)
      queueMicrotask(() => {
        if (active) setDraft(newDraft(job));
      });
    if (record.denied || mismatch)
      queueMicrotask(() => {
        if (active) {
          setDraft(undefined);
          setProposal(null);
        }
      });
    return () => {
      active = false;
    };
  }, [job, draft, mismatch, record.denied]);
  useEffect(() => {
    if (message) confirmation.current?.focus();
  }, [message]);
  useEffect(() => {
    if (pending && !proposal) recovery.current?.focus();
  }, [pending, proposal]);
  function edit<K extends keyof Omit<Draft, "base">>(key: K, value: Draft[K]) {
    setDraft((previous) => (previous ? { ...previous, [key]: value } : previous));
    setError(undefined);
  }
  function refresh() {
    setError(undefined);
    setInspection(undefined);
    setIndependent(false);
    refreshAccess();
    record.refresh();
  }
  async function current() {
    const [ownResult, jobResult] = await Promise.all([
      apiRequest("/staff/workforce/access"),
      apiRequest(`/staff/workforce/jobs/${id}`),
    ]);
    const own = parseWorkforceAccess(ownResult.data),
      latest = parseWorkforceJobDetail(jobResult.data);
    if (
      !draftIdentity()?.startsWith(`${access.userId}:`) ||
      !sameWorkforceScope(access, own) ||
      !sameWorkforceScope(own, latest.access) ||
      latest.id !== id
    )
      throw rejection("Your responsibilities changed. Refresh access before continuing.");
    return latest;
  }
  function review(change: WorkforceJobChange) {
    if (!job || blocked || !draft || !jobActionAllowed(job, change.kind)) return;
    setError(undefined);
    setMessage(undefined);
    const base = job;
    const facts = [
      { label: "Job", value: base.workOrder?.workOrderNumber ?? base.service.name },
    ];
    if (change.kind === "work") {
      if (change.body.diagnosis !== undefined)
        facts.push({ label: "Diagnosis", value: change.body.diagnosis });
      if (change.body.internalNotes !== undefined)
        facts.push({
          label: "Work notes / parts needed",
          value: change.body.internalNotes,
        });
      facts.push({
        label: "Progress",
        value: change.body.status
          ? `${stateName(base.workOrder!.status)} → ${stateName(change.body.status)}`
          : "Keep current state",
      });
    } else {
      if (change.kind === "assignment")
        facts.push(
          { label: "Technician", value: technicianName(change.technician) },
          { label: "Staff reference", value: change.technician.id },
        );
      else
        facts.push({
          label: "Outcome",
          value: "Complete the work order and booking after independent quality review",
        });
      facts.push({
        label: change.kind === "quality" ? "Review findings" : "Assignment reason",
        value: change.body.reason,
      });
    }
    setProposal({
      title:
        change.kind === "work"
          ? "Save this technical update?"
          : change.kind === "quality"
            ? "Approve independent quality review?"
            : "Assign this workshop job?",
      description:
        "Review the exact change below. Your current responsibilities and the latest job will be checked before saving.",
      facts,
      retryAfterRejection: false,
      submit: async () => {
        let sent = false,
          token: string | undefined;
        try {
          const latest = await current();
          if (
            jobRevision(latest) !== jobRevision(base) ||
            !jobActionAllowed(latest, change.kind)
          )
            throw rejection(
              "The job changed. Close this review, refresh and inspect your retained draft.",
            );
          if (change.kind === "assignment") {
            const name = technicianName(change.technician)
              .replace(/\s+/g, " ")
              .slice(0, 120);
            const seen = new Set<string>();
            let cursor: string | undefined;
            let found = false;
            do {
              const params = new URLSearchParams({ limit: "25", q: name });
              if (cursor) params.set("cursor", cursor);
              const response = await apiRequest(
                `/staff/workforce/jobs/${id}/assignees?${params}`,
              );
              const options = parseWorkforceJobCandidates(response.data);
              if (
                options.jobId !== id ||
                options.jobVersion !== latest.version ||
                options.branchId !== latest.branchId ||
                !sameWorkforceScope(latest.access, options.access)
              )
                throw rejection(
                  "Technician options changed. Refresh the job and review again.",
                );
              const target = options.items.find(
                (item) => item.id === change.technician.id,
              );
              if (target) {
                if (technicianName(target) !== technicianName(change.technician))
                  throw rejection(
                    "The selected technician changed. Refresh and select them again.",
                  );
                found = true;
                break;
              }
              cursor = options.nextCursor;
              if (cursor && seen.has(cursor))
                throw rejection("Technician paging could not be verified.");
              if (cursor) seen.add(cursor);
            } while (cursor);
            if (!found)
              throw rejection(
                "The selected technician is no longer eligible. Refresh and select another technician.",
              );
          }
          // The mutation still rechecks eligibility atomically with the assignment.
          const marker = await markWorkforceJobPending(
            access.userId,
            { id, action: change.kind, version: change.body.expectedVersion },
            change.body,
          );
          token = marker.token;
          setPending(marker);
          sent = true;
          const response = await apiRequest(
            `/staff/workforce/jobs/${id}/${change.kind}`,
            {
              method: change.kind === "quality" ? "POST" : "PATCH",
              csrf: true,
              body: change.body,
            },
          );
          const after = validateJobReceipt(base, response.data, change);
          clearWorkforceJobPending(access.userId, token);
          setPending(undefined);
          setDraft(newDraft(after));
        } catch (caught) {
          if (!sent)
            throw rejection(
              caught instanceof Error
                ? caught.message
                : "The change was not sent. Refresh before reviewing again.",
            );
          if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
            try {
              clearWorkforceJobPending(access.userId, token);
            } finally {
              setPending(readWorkforceJobPending(access.userId));
            }
          }
          throw caught;
        }
      },
      onUncertain: () => setPending(readWorkforceJobPending(access.userId) ?? "unknown"),
    });
  }
  function prepare(action: () => WorkforceJobChange) {
    setInvalidField(undefined);
    try {
      review(action());
    } catch (caught) {
      if (caught instanceof JobFieldError) {
        setInvalidField(caught.field);
        const ids = {
          diagnosis: "wjd-diagnosis",
          internalNotes: "wjd-notes",
          status: "wjd-progress",
          findings: "wjd-findings",
          reason: "wjd-reason",
        };
        document.getElementById(ids[caught.field])?.focus();
      }
      setError(caught instanceof Error ? caught.message : "Check the proposed change.");
    }
  }
  async function reconcile(clear: boolean) {
    setRecovering(true);
    setError(undefined);
    try {
      const marker = readWorkforceJobPending(access.userId);
      if (!marker || JSON.stringify(marker) !== JSON.stringify(pending))
        throw Error(
          "The pending change has changed. Reload this page before continuing.",
        );
      if (marker !== "unknown" && marker.id !== id)
        throw Error("Open the job with the pending change first.");
      const latest = await current();
      const fingerprint = JSON.stringify(marker) + jobRevision(latest);
      if (clear) {
        if (!independent || inspection !== fingerprint)
          throw Error(
            "Inspect the latest job and independently reconcile the earlier change first.",
          );
        clearWorkforceJobPending(
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
      setError(
        caught instanceof Error ? caught.message : "Reconciliation is unavailable.",
      );
    } finally {
      setRecovering(false);
    }
  }
  const work = job?.workOrder;
  return (
    <div className="workforce-job-detail">
      <nav aria-label="Breadcrumb" className="wjd-breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight size={14} />
          </li>
          <li className="wjd-middle">
            <Link href={back}>Workshop jobs</Link>
          </li>
          <li aria-hidden="true" className="wjd-middle">
            <ChevronRight size={14} />
          </li>
          <li aria-current="page" title={work?.workOrderNumber}>
            {work?.workOrderNumber ?? "Job details"}
          </li>
        </ol>
      </nav>
      <header className="wjd-heading">
        <div>
          <h1>{work?.workOrderNumber ?? "Job details"}</h1>
          {job && <p>{job.service.name}</p>}
        </div>
        <div className="wjd-refresh">
          <button
            className="button secondary"
            disabled={busy || !!proposal || recovering}
            onClick={refresh}
          >
            <RefreshCw size={17} aria-hidden="true" />
            {busy ? "Refreshing job…" : "Refresh job"}
          </button>
          {job && (
            <p>
              Updated{" "}
              <time dateTime={job.generatedAt}>
                {formatBusinessDate(job.generatedAt)}
              </time>
            </p>
          )}
        </div>
      </header>
      <Feedback
        message={
          failure ||
          (mismatch
            ? "Your job access changed. Refresh to check your current responsibilities."
            : undefined)
        }
      />
      <div id="wjd-error">
        <Feedback message={error} />
      </div>
      {message && (
        <div className="notice success" role="status" tabIndex={-1} ref={confirmation}>
          {message}
        </div>
      )}
      {pending && (
        <section
          className="wjd-recovery"
          aria-labelledby="wjd-recovery-title"
          ref={recovery}
          tabIndex={-1}
        >
          <h2 id="wjd-recovery-title">Review an earlier job change</h2>
          <p>
            The result could not be confirmed. Refreshing does not clear this lock.
            Current job data alone cannot prove whether the original request succeeded; no
            change will be resent automatically.
          </p>
          {pending !== "unknown" && pending.id !== id ? (
            <Link
              className="button secondary"
              href={`/admin/workforce/jobs/${pending.id}`}
            >
              Open pending job
            </Link>
          ) : (
            <>
              <button
                className="button secondary"
                disabled={recovering || !!proposal || !job}
                onClick={() => void reconcile(false)}
              >
                Inspect current job
              </button>
              {inspection && (
                <>
                  <label className="wjd-check">
                    <input
                      type="checkbox"
                      checked={independent}
                      onChange={(e) => setIndependent(e.target.checked)}
                    />
                    I have independently reconciled the earlier change with the workshop
                    lead or audit record.
                  </label>
                  <button
                    className="button secondary"
                    disabled={!independent || recovering || !!proposal || !job}
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
      {busy && <p role="status">Checking job access…</p>}
      {job && (
        <>
          <WorkflowProgress workflow="booking" status={job.status} />
          {work && <WorkflowProgress workflow="workOrder" status={work.status} />}
          <div className="wjd-states">
            <span>
              Work: <strong>{stateName(work?.status ?? "NOT_CREATED")}</strong>
            </span>
            <span>
              Booking:{" "}
              <strong>
                {Object.hasOwn(bookingStateLabels, job.status)
                  ? bookingStateLabels[job.status]
                  : "Status unavailable"}
              </strong>
            </span>
          </div>
          {stale && (
            <section className="wjd-recovery">
              <h2>The job has changed</h2>
              <p>
                Your unsent draft is retained below. Review the latest recorded
                information before replacing your draft.
              </p>
              <button
                className="button secondary"
                disabled={!!proposal || !!pending}
                onClick={() => {
                  setDraft(newDraft(job));
                  setError(undefined);
                }}
              >
                Load latest values into draft
              </button>
            </section>
          )}
          <div className="wjd-columns">
            <section
              className="wjd-panel wjd-overview"
              aria-labelledby="wjd-overview-title"
            >
              <h2 id="wjd-overview-title">Job overview</h2>
              <dl className="wjd-facts">
                <div>
                  <Car size={20} aria-hidden="true" />
                  <dt>Vehicle</dt>
                  <dd>
                    {job.vehicle ? (
                      <>
                        {job.vehicle.make} {job.vehicle.model} {job.vehicle.year}
                        <small>
                          {job.vehicle.registrationNumber ?? "Registration not recorded"}
                        </small>
                      </>
                    ) : (
                      "Vehicle not recorded"
                    )}
                  </dd>
                </div>
                <div>
                  <CalendarDays size={20} aria-hidden="true" />
                  <dt>Scheduled</dt>
                  <dd>
                    <time dateTime={job.scheduledAt}>
                      {formatBusinessDate(job.scheduledAt)}
                    </time>
                  </dd>
                </div>
                <div>
                  <MapPin size={20} aria-hidden="true" />
                  <dt>Branch</dt>
                  <dd>{job.branch?.name ?? "Branch not recorded"}</dd>
                </div>
                <div>
                  <UserRound size={20} aria-hidden="true" />
                  <dt>Assigned technician</dt>
                  <dd>
                    {job.assignedStaff ? technicianName(job.assignedStaff) : "Unassigned"}
                  </dd>
                </div>
              </dl>
              <dl className="wjd-notes">
                <div>
                  <dt>Reported symptoms</dt>
                  <dd>{job.customerNotes || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Recorded diagnosis</dt>
                  <dd>{work?.diagnosis || "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Recorded work notes</dt>
                  <dd>{work?.internalNotes || "Not recorded"}</dd>
                </div>
              </dl>
              {work?.qualityApprovedAt && (
                <p>
                  Quality approved{" "}
                  <time dateTime={work.qualityApprovedAt}>
                    {formatBusinessDate(work.qualityApprovedAt)}
                  </time>
                  .
                </p>
              )}
            </section>
            <div className="wjd-action-column">
              {draft && jobActionAllowed(job, "work") ? (
                <form
                  className="wjd-panel"
                  aria-label="Technical work"
                  onSubmit={(e) => {
                    e.preventDefault();
                    prepare(() => technicalChange(draft.base, draft));
                  }}
                >
                  <h2>Technical work</h2>
                  <p>Record your findings and update progress.</p>
                  <fieldset disabled={blocked}>
                    <div className="field">
                      <label htmlFor="wjd-diagnosis">Diagnosis</label>
                      <textarea
                        id="wjd-diagnosis"
                        maxLength={5000}
                        value={draft.diagnosis}
                        onChange={(e) => edit("diagnosis", e.target.value)}
                        aria-invalid={!!error && invalidField === "diagnosis"}
                        aria-describedby={`wjd-note-hint${error && invalidField === "diagnosis" ? " wjd-error" : ""}`}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="wjd-notes">Work notes / parts needed</label>
                      <textarea
                        id="wjd-notes"
                        maxLength={5000}
                        value={draft.internalNotes}
                        onChange={(e) => edit("internalNotes", e.target.value)}
                        aria-invalid={!!error && invalidField === "internalNotes"}
                        aria-describedby={`wjd-note-hint${error && invalidField === "internalNotes" ? " wjd-error" : ""}`}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="wjd-progress">Progress</label>
                      <select
                        id="wjd-progress"
                        aria-invalid={!!error && invalidField === "status"}
                        aria-describedby={
                          error && invalidField === "status" ? "wjd-error" : undefined
                        }
                        value={draft.status}
                        onChange={(e) => edit("status", e.target.value)}
                      >
                        <option value="">Keep current state</option>
                        {(workTransitions[draft.base.workOrder?.status ?? ""] ?? []).map(
                          (status) => (
                            <option key={status} value={status}>
                              {status === "IN_PROGRESS"
                                ? "Start / resume work"
                                : status === "QUALITY_CHECK"
                                  ? "Ready for independent quality review"
                                  : "Awaiting parts"}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <p id="wjd-note-hint">
                      Existing notes cannot be cleared. Enter replacement text to change
                      them.
                    </p>
                    <button className="button">
                      Review technical update
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </fieldset>
                </form>
              ) : work?.status === "QUALITY_CHECK" ? (
                <section className="wjd-panel">
                  <h2>Independent quality review</h2>
                  <p>Confirm the completed checks before approving this job.</p>
                  {draft && jobActionAllowed(job, "quality") ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        prepare(() => ({
                          kind: "quality",
                          body: {
                            expectedVersion: draft.base.workOrder!.version,
                            reason: reviewReason(draft.findings, "findings"),
                          },
                        }));
                      }}
                    >
                      <p>
                        Only an authorized reviewer who did not perform this work and is
                        not assigned to it can approve.
                      </p>
                      <fieldset disabled={blocked}>
                        <div className="field">
                          <label htmlFor="wjd-findings">Review findings</label>
                          <textarea
                            id="wjd-findings"
                            minLength={10}
                            maxLength={1000}
                            required
                            value={draft.findings}
                            onChange={(e) => edit("findings", e.target.value)}
                            placeholder="Describe the checks you completed."
                            aria-invalid={!!error && invalidField === "findings"}
                            aria-describedby={`wjd-findings-hint${error && invalidField === "findings" ? " wjd-error" : ""}`}
                          />
                          <small id="wjd-findings-hint">10–1,000 characters</small>
                        </div>
                        <button className="button">Review quality approval</button>
                      </fieldset>
                    </form>
                  ) : (
                    <p>
                      An independent authorized reviewer is required. You cannot approve
                      work you performed or are assigned to. The booking must be in
                      progress and its workers recorded.
                    </p>
                  )}
                </section>
              ) : (
                <section className="wjd-panel">
                  <h2>Technical work</h2>
                  <p>
                    {!work
                      ? "A work order has not been prepared for this booking."
                      : "Technical updates are unavailable in the current job state or responsibility scope."}
                  </p>
                  <p>
                    Ask the workshop lead to review the job if further work is needed.
                  </p>
                </section>
              )}
            </div>
          </div>
          {draft && jobActionAllowed(job, "assignment") && (
            <section className="wjd-panel wjd-assignment">
              <h2>Assign technician</h2>
              <p>
                Select an active technician authorized in this branch. Reassignment
                removes the former technician’s access.
              </p>
              <JobCandidates
                job={job}
                disabled={blocked}
                selected={draft.selected}
                onSelect={(candidate) => edit("selected", candidate)}
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  prepare(() => {
                    if (!draft.selected)
                      throw Error("Select a technician before reviewing.");
                    if (draft.selected.id === job.assignedStaffId)
                      throw Error("This technician is already assigned.");
                    return {
                      kind: "assignment",
                      technician: draft.selected,
                      body: {
                        expectedVersion: draft.base.version,
                        staffId: draft.selected.id,
                        reason: reviewReason(draft.reason),
                      },
                    };
                  });
                }}
              >
                <fieldset disabled={blocked}>
                  <div className="field">
                    <label htmlFor="wjd-reason">Assignment reason</label>
                    <textarea
                      id="wjd-reason"
                      required
                      minLength={10}
                      maxLength={1000}
                      value={draft.reason}
                      onChange={(e) => edit("reason", e.target.value)}
                      placeholder="Explain why this job should be assigned to this technician."
                      aria-invalid={!!error && invalidField === "reason"}
                      aria-describedby={`wjd-reason-hint${error && invalidField === "reason" ? " wjd-error" : ""}`}
                    />
                    <small id="wjd-reason-hint">10–1,000 characters</small>
                  </div>
                  <button className="button" disabled={!draft.selected}>
                    Review job assignment
                  </button>
                </fieldset>
              </form>
            </section>
          )}
        </>
      )}
      <Link href={back} className="wjd-back">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to jobs
      </Link>
      {proposal && (
        <MutationReview
          proposal={proposal}
          exposeBusyState
          onClose={() => {
            setProposal(null);
            record.refresh();
          }}
          onSuccess={() => setMessage("Job change recorded.")}
        />
      )}
    </div>
  );
}

function JobCandidates({
  job,
  selected,
  disabled,
  onSelect,
}: {
  job: Job;
  selected?: WorkforceJobCandidate;
  disabled: boolean;
  onSelect: (value: WorkforceJobCandidate) => void;
}) {
  const [input, setInput] = useState(""),
    [q, setQ] = useState(""),
    [cursors, setCursors] = useState<string[]>([]),
    [error, setError] = useState<string>();
  const params = new URLSearchParams({ limit: "25" });
  if (q) params.set("q", q);
  if (cursors.length) params.set("cursor", cursors.at(-1)!);
  const result = useResource(
    `/staff/workforce/jobs/${job.id}/assignees?${params}`,
    parseWorkforceJobCandidates,
    undefined,
    { refreshKey: job.version },
  );
  const mismatch =
    !!result.data &&
    (result.data.jobId !== job.id ||
      result.data.jobVersion !== job.version ||
      result.data.branchId !== job.branchId ||
      !sameWorkforceScope(job.access, result.data.access));
  const busy = result.loading || result.refreshing,
    failure = result.error || result.refreshError;
  const data = !busy && !failure && !mismatch ? result.data : undefined;
  return (
    <div className="wjd-candidates">
      <form
        className="wjd-search"
        aria-label="Search technicians"
        onSubmit={(e) => {
          e.preventDefault();
          const term = input.trim();
          if (
            [...term].some(
              (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
            )
          ) {
            setError("Search cannot contain control characters.");
            return;
          }
          setError(undefined);
          setCursors([]);
          setQ(term);
          if (q === term && !cursors.length) result.refresh();
        }}
      >
        <div className="field">
          <label htmlFor="wjd-search">Search technicians</label>
          <div>
            <Search size={18} aria-hidden="true" />
            <input
              id="wjd-search"
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={120}
              aria-invalid={!!error}
              aria-describedby={error ? "wjd-search-error" : undefined}
              placeholder="Search by name"
              disabled={disabled}
            />
          </div>
        </div>
        <button className="button secondary" disabled={disabled || busy}>
          Search
        </button>
      </form>
      <div id="wjd-search-error">
        <Feedback
          message={
            error ||
            failure ||
            (mismatch
              ? "Technician options changed. Refresh the job before assigning."
              : undefined)
          }
        />
      </div>
      {failure && (
        <button
          type="button"
          className="button secondary"
          disabled={disabled || busy}
          onClick={result.refresh}
        >
          Retry technician search
        </button>
      )}
      {busy && <p role="status">Checking available technicians…</p>}
      {data && (
        <>
          <fieldset className="wjd-options" disabled={disabled}>
            <legend className="sr-only">Available technicians</legend>
            {data.items.length ? (
              data.items.map((candidate) => (
                <label key={candidate.id}>
                  <input
                    type="radio"
                    name="wjd-technician"
                    value={candidate.id}
                    checked={selected?.id === candidate.id}
                    onChange={() => onSelect(candidate)}
                  />
                  <span>
                    {technicianName(candidate)}
                    <small className="wjd-staff-reference">
                      Staff reference: {candidate.id}
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p>
                {q
                  ? "No technicians match this search."
                  : "No eligible technicians are available in this branch."}
              </p>
            )}
          </fieldset>
          <nav className="wjd-paging" aria-label="Technician pages">
            <button
              type="button"
              className="button secondary"
              disabled={disabled || !cursors.length}
              onClick={() => setCursors([])}
            >
              First page
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={disabled || !cursors.length}
              onClick={() => setCursors((previous) => previous.slice(0, -1))}
            >
              Previous page
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={disabled || !data.nextCursor}
              onClick={() => {
                if (data.nextCursor)
                  setCursors((previous) => [...previous, data.nextCursor!]);
              }}
            >
              Next technicians
            </button>
          </nav>
        </>
      )}
      {selected && (
        <p className="wjd-selected">
          Selected technician: <strong>{technicianName(selected)}</strong>.
          <span className="wjd-staff-reference">Staff reference: {selected.id}</span>
          Eligibility is checked again when assigning.
        </p>
      )}
    </div>
  );
}
