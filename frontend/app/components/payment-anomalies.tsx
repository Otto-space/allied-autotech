"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, SearchCheck, X } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { anomalyStatuses, anomalyTypes } from "@/lib/api/operations-schemas";
import {
  draftIdentity,
  cancelDraftSubmission,
  draftKey,
  forgetDraft,
} from "@/lib/forms/drafts";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  exceptionBodySchema,
  exceptionLabels,
  exceptionPageParams,
  exceptionQuery,
  exceptionSnapshot,
  parseCurrentException,
  parseExceptionPage,
  validateExceptionReceipt,
  type WorkException,
} from "@/lib/admin/work-payment-exceptions";
import {
  clearExceptionPending,
  exceptionFingerprint,
  markExceptionPending,
  readExceptionPending,
  redactExceptionChanges,
  type ExceptionPending,
} from "@/lib/admin/work-exception-pending";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { OperationActionForm } from "./operation-action-form";

const root = "/admin/payment-exceptions",
  endpoint = "/admin/operations/payment-anomalies";
export function PaymentAnomalies() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <Feedback message="Administrator access is required for payment exceptions." />
    );
  return (
    <ExceptionAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function ExceptionAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    profile = access.data;
  const invalid =
    !!profile &&
    (profile.id !== owner || profile.role !== role || profile.status !== "ACTIVE");
  const error =
    access.error ||
    access.refreshError ||
    (invalid ? "Current exception access could not be confirmed." : undefined);
  useEffect(() => {
    if (access.denied || invalid) redactExceptionChanges();
  }, [access.denied, invalid]);
  if (!profile || error || access.loading)
    return (
      <div className="work-exceptions">
        <h1>Payment exceptions</h1>
        {error ? (
          <Feedback message={error} />
        ) : (
          <p role="status">Checking exception access…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh exception access
        </button>
      </div>
    );
  return <ExceptionWorkspace owner={owner} role={role} refreshAccess={access.refresh} />;
}
function useExceptionRecords(path: string | null) {
  const parse = useCallback(
    (value: unknown) =>
      parseExceptionPage(value, new URLSearchParams(path?.split("?")[1])),
    [path],
  );
  return useResource(path, parse);
}
class ExceptionPreflightError extends ApiError {
  constructor() {
    super(409, { error: { code: "CONFLICT" } });
    this.message =
      "No exception change request was sent. Close the review and inspect current facts.";
  }
}
function ExceptionWorkspace({
  owner,
  role,
  refreshAccess,
}: {
  owner: string;
  role: string;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    query = exceptionQuery(new URLSearchParams(search.toString())),
    params = query.params;
  const routeId = params.get("selected"),
    [lastId, setLastId] = useState<string | null>(routeId);
  useEffect(() => {
    if (routeId) queueMicrotask(() => setLastId(routeId));
  }, [routeId]);
  const selectedId = routeId ?? lastId;
  const [unavailable, setUnavailable] = useState(false),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [working, setWorking] = useState(false);
  const [pending, setPending] = useState<ExceptionPending | undefined>(() =>
    readExceptionPending(owner, role),
  );
  const [inspected, setInspected] = useState<WorkException>(),
    [recovery, setRecovery] = useState<WorkException>(),
    [saved, setSaved] = useState<WorkException>();
  const [message, setMessage] = useState<string>(),
    [reference, setReference] = useState(routeId ?? ""),
    [acknowledged, setAcknowledged] = useState(false);
  const list = useExceptionRecords(!unavailable ? query.path : null);
  const parseSelected = useCallback(
    (value: unknown) => parseCurrentException(value, selectedId ?? ""),
    [selectedId],
  );
  const selected = useResource(
    !unavailable && !query.invalid && selectedId ? `${endpoint}/${selectedId}` : null,
    parseSelected,
  );
  const active = useRef(true),
    flight = useRef(false),
    request = useRef<AbortController | null>(null),
    focus = useRef<string | null>(null),
    opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const deny = useCallback(() => {
    redactExceptionChanges();
    setUnavailable(true);
    setProposal(null);
    setInspected(undefined);
    setRecovery(undefined);
    setSaved(undefined);
    setMessage(undefined);
  }, [setProposal]);
  useEffect(() => {
    if (list.denied || selected.denied) {
      const timer = setTimeout(deny, 0);
      return () => clearTimeout(timer);
    }
  }, [list.denied, selected.denied, deny]);
  useEffect(() => {
    if (proposal || unavailable || !focus.current) return;
    const timer = requestAnimationFrame(() => {
      const el = document.getElementById(focus.current ?? "");
      focus.current = null;
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(timer);
  }, [proposal, unavailable, saved, recovery, pending, routeId]);
  const blocked = unavailable || list.denied || selected.denied,
    listError = list.error || list.refreshError,
    selectedError = selected.error || selected.refreshError;
  const row = blocked
    ? undefined
    : inspected?.id === selectedId &&
        (!selected.data ||
          Date.parse(inspected.updatedAt) >= Date.parse(selected.data.updatedAt))
      ? inspected
      : selected.data;
  const navigating = working || !!proposal,
    disabled =
      navigating ||
      !!pending ||
      !!blocked ||
      query.invalid ||
      list.loading ||
      !!listError ||
      selected.loading ||
      selected.refreshing ||
      !!selectedError;
  function navigate(next: URLSearchParams) {
    if (flight.current || proposal) return;
    router.push(`${root}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  function select(id: string) {
    if (navigating) return;
    const next = new URLSearchParams(params);
    next.set("selected", id);
    setLastId(id);
    focus.current = "exception-detail-title";
    navigate(next);
  }
  function closeSelection() {
    const next = new URLSearchParams(params);
    next.delete("selected");
    focus.current = routeId ? `exception-open-${routeId}` : "exception-queue-title";
    navigate(next);
  }
  function identity(signal?: AbortSignal) {
    if (!active.current || signal?.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Exception account changed");
  }
  function denied(error: unknown) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      deny();
      return true;
    }
    return false;
  }
  async function fresh(id: string, signal: AbortSignal) {
    const profile = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    identity(signal);
    if (profile.id !== owner || profile.role !== role || profile.status !== "ACTIVE")
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    const current = parseCurrentException(
      (await apiRequest(`${endpoint}/${id}`, { signal })).data,
      id,
    );
    identity(signal);
    return current;
  }
  function review(next: MutationProposal) {
    if (disabled || !row || !routeId || !next.exceptionChange) return;
    const before = row,
      body = exceptionBodySchema.parse(next.exceptionChange.body);
    if (exceptionSnapshot(next.exceptionChange.before) !== exceptionSnapshot(before))
      return;
    opener.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMessage(undefined);
    setSaved(undefined);
    setRecovery(undefined);
    setAcknowledged(false);
    setProposal({
      ...next,
      retryAfterRejection: false,
      retrySafely: false,
      onUncertain: () => {
        setPending(readExceptionPending(owner, role));
        focus.current = "exception-recovery-title";
      },
      submit: async () => {
        if (flight.current) throw new ExceptionPreflightError();
        flight.current = true;
        setWorking(true);
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        let sent = false,
          marker: Exclude<ExceptionPending, "unknown"> | undefined;
        try {
          const previous = readExceptionPending(owner, role);
          if (previous) {
            setPending(previous);
            throw Error("An earlier change needs reconciliation");
          }
          const current = await fresh(before.id, controller.signal);
          if (exceptionSnapshot(current) !== exceptionSnapshot(before)) {
            setInspected(current);
            setRecovery(current);
            list.refresh();
            focus.current = "exception-current-title";
            throw Error("The exception changed");
          }
          const fingerprint = await exceptionFingerprint(body);
          identity(controller.signal);
          marker = markExceptionPending(owner, role, {
            id: before.id,
            expectedStatus: body.expectedStatus,
            expectedUpdatedAt: before.updatedAt,
            fingerprint,
          });
          setPending(marker);
          sent = true;
          cancelDraftSubmission();
          const receipt = validateExceptionReceipt(
            await next.submit(),
            before,
            body,
            owner,
          );
          identity(controller.signal);
          clearExceptionPending(owner, role, marker.token);
          setPending(undefined);
          const form = JSON.stringify(["operation-action-form:1", before.id]);
          forgetDraft(draftKey(`${owner}:${role}`, root, `${before.id}:${form}`));
          forgetDraft(draftKey(`${owner}:${role}`, root, form));
          setInspected(receipt);
          setSaved(receipt);
          setRecovery(undefined);
          focus.current = "exception-saved-title";
          list.refresh();
        } catch (error) {
          if (!active.current || denied(error)) throw error;
          const definite =
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 429].includes(error.status);
          if (!sent || definite) {
            if (marker) {
              clearExceptionPending(owner, role, marker.token);
              setPending(undefined);
            }
            setMessage(
              sent
                ? "The server rejected this change. Read the current exception before reviewing another action."
                : "No exception change request was sent. Close the review and inspect current facts.",
            );
            if (!sent) throw new ExceptionPreflightError();
            throw error;
          }
          setPending(readExceptionPending(owner, role));
          focus.current = "exception-recovery-title";
          throw Error("Exception outcome could not be confirmed");
        } finally {
          flight.current = false;
          if (active.current) setWorking(false);
        }
      },
    });
  }
  async function loadCurrent() {
    if (flight.current || proposal || blocked) return;
    const id =
      pending && pending !== "unknown"
        ? pending.id
        : pending === "unknown"
          ? reference || routeId || selectedId
          : routeId || selectedId;
    if (!id || !z.uuid().safeParse(id).success) {
      setMessage("Enter a valid exception reference to inspect.");
      document.getElementById("exception-recovery-reference")?.focus();
      return;
    }
    flight.current = true;
    setWorking(true);
    setMessage(undefined);
    setRecovery(undefined);
    setAcknowledged(false);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const current = await fresh(id.toLowerCase(), controller.signal);
      setRecovery(current);
      if (current.id === selectedId) setInspected(current);
      const listed = list.data?.items.find((v) => v.id === current.id);
      if (listed && exceptionSnapshot(listed) !== exceptionSnapshot(current))
        list.refresh();
      setAcknowledged(false);
      focus.current = "exception-current-title";
    } catch (error) {
      if (active.current && !denied(error))
        setMessage(
          "The current exception could not be checked. Any local recovery lock remains in place.",
        );
    } finally {
      flight.current = false;
      if (active.current) setWorking(false);
    }
  }
  function clearReconciled() {
    if (
      !recovery ||
      !acknowledged ||
      working ||
      blocked ||
      (pending && pending !== "unknown" && pending.id !== recovery.id)
    )
      return;
    try {
      clearExceptionPending(
        owner,
        role,
        pending && pending !== "unknown" ? pending.token : undefined,
      );
      setPending(undefined);
      setRecovery(undefined);
      setAcknowledged(false);
      setMessage(
        "Local recovery lock cleared after your reconciliation. Any earlier server request is unaffected. Review a new action deliberately.",
      );
      focus.current = "exception-detail-title";
    } catch {
      setMessage(
        "The local recovery lock could not be cleared. Keep the exception reference and check again.",
      );
    }
  }
  return (
    <div className="work-exceptions">
      <nav className="we-breadcrumb" aria-label="Exception breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">Payment exceptions</span>
      </nav>
      <header className="we-heading">
        <div>
          <p className="we-eyebrow">Finance / exceptions</p>
          <h1>Payment exceptions</h1>
          <p>Investigate mismatches and unexpected payment events.</p>
        </div>
        <Link className="text-link" href="/admin">
          Back to overview
        </Link>
      </header>
      {blocked ? (
        <section className="we-state">
          <h2>Exception access is unavailable</h2>
          <p>Protected records and proposed changes have been cleared.</p>
          <button className="button secondary" onClick={refreshAccess}>
            Refresh exception access
          </button>
        </section>
      ) : (
        <>
          {query.invalid ? (
            <section className="we-state">
              <Feedback message="This exception view contains unsupported or invalid filters." />
              <button
                className="button secondary"
                onClick={() => navigate(new URLSearchParams())}
              >
                Reset exception view
              </button>
            </section>
          ) : (
            <>
              <section className="we-filters" aria-label="Exception filters">
                {(
                  [
                    {
                      name: "status",
                      label: "Exception status",
                      options: anomalyStatuses,
                    },
                    { name: "type", label: "Exception type", options: anomalyTypes },
                  ] as const
                ).map((f) => (
                  <div className="field" key={f.name}>
                    <label htmlFor={`exception-${f.name}`}>{f.label}</label>
                    <select
                      id={`exception-${f.name}`}
                      value={params.get(f.name) ?? ""}
                      disabled={navigating}
                      onChange={(e) => {
                        const next = new URLSearchParams(params);
                        if (e.target.value) next.set(f.name, e.target.value);
                        else next.delete(f.name);
                        next.delete("cursor");
                        next.delete("_trail");
                        navigate(next);
                      }}
                    >
                      <option value="">
                        {f.name === "status" ? "All statuses" : "All types"}
                      </option>
                      {f.options.map((v) => (
                        <option value={v} key={v}>
                          {exceptionLabels[v]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="we-filter-actions">
                  <button
                    className="button secondary"
                    disabled={navigating || list.loading}
                    onClick={() => {
                      list.refresh();
                      if (routeId) selected.refresh();
                    }}
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                    Refresh
                  </button>
                  <button
                    className="text-link"
                    disabled={navigating}
                    onClick={() => {
                      const next = new URLSearchParams();
                      if (routeId) next.set("selected", routeId);
                      navigate(next);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              </section>
              <Feedback message={message} />
              {saved && (
                <section className="we-state we-saved" role="status">
                  <h2 id="exception-saved-title" tabIndex={-1}>
                    Exception update recorded
                  </h2>
                  <p>
                    {exceptionLabels[saved.type]} is now{" "}
                    {exceptionLabels[saved.status].toLowerCase()}. The investigation note
                    was saved.
                  </p>
                  <p>Payment, refund and dispute states are unchanged by this action.</p>
                </section>
              )}
              {pending && (
                <section className="we-state we-pending">
                  <h2 id="exception-recovery-title" tabIndex={-1}>
                    Check the earlier exception change
                  </h2>
                  <p>
                    Its outcome needs reconciliation before another update. No request
                    will be resent automatically.
                  </p>
                  {pending !== "unknown" ? (
                    <p className="we-reference">Exception {pending.id}</p>
                  ) : (
                    <div className="field">
                      <label htmlFor="exception-recovery-reference">
                        Exception reference
                      </label>
                      <input
                        id="exception-recovery-reference"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  )}
                  <button
                    className="button secondary"
                    disabled={navigating}
                    onClick={() => void loadCurrent()}
                  >
                    Read current exception
                  </button>
                </section>
              )}
              {recovery && (
                <section className="we-state">
                  <h2 id="exception-current-title" tabIndex={-1}>
                    Current exception checked
                  </h2>
                  <p>
                    {exceptionLabels[recovery.type]} · {exceptionLabels[recovery.status]}
                  </p>
                  <p className="we-reference">{recovery.id}</p>
                  <p className="we-note">
                    {recovery.resolutionNote ?? "No investigation note recorded."}
                  </p>
                  <p>
                    Updated {formatStockInstant(recovery.updatedAt)}. A current read does
                    not prove that an interrupted request has finished.
                  </p>
                  {pending && (
                    <>
                      <label className="we-ack">
                        <input
                          type="checkbox"
                          checked={acknowledged}
                          disabled={working}
                          onChange={(e) => setAcknowledged(e.target.checked)}
                        />
                        I have independently reconciled the earlier request and will
                        review any new action deliberately.
                      </label>
                      <button
                        className="button secondary"
                        disabled={!acknowledged || navigating}
                        onClick={clearReconciled}
                      >
                        Clear local recovery lock
                      </button>
                    </>
                  )}
                </section>
              )}
              <div className={`we-layout${routeId ? " has-selection" : ""}`}>
                <section className="we-queue" aria-labelledby="exception-queue-title">
                  <div className="we-queue-heading">
                    <h2 id="exception-queue-title" tabIndex={-1}>
                      Exception queue
                    </h2>
                    <span>
                      {list.data
                        ? `${list.data.items.length} on this page`
                        : "Newest first"}
                    </span>
                  </div>
                  {list.loading ? (
                    <p className="we-empty" role="status">
                      Loading payment exceptions…
                    </p>
                  ) : listError ? (
                    <div className="we-empty">
                      <Feedback message={listError} />
                      <button className="button secondary" onClick={list.refresh}>
                        Retry exception queue
                      </button>
                    </div>
                  ) : !list.data?.items.length ? (
                    <div className="we-empty">
                      <SearchCheck aria-hidden="true" />
                      <h3>No matching exceptions</h3>
                      <p>Try another status or type, or refresh for recent events.</p>
                    </div>
                  ) : (
                    <ol className="we-records">
                      {list.data.items.map((item) => (
                        <li
                          className={routeId === item.id ? "is-selected" : ""}
                          key={item.id}
                        >
                          <div className="we-row-heading">
                            <h3>{exceptionLabels[item.type]}</h3>
                            <ExceptionBadge status={item.status} />
                          </div>
                          <p>{item.summary}</p>
                          <footer>
                            <time dateTime={item.detectedAt}>
                              {formatStockInstant(item.detectedAt)}
                            </time>
                            <button
                              className="text-link"
                              id={`exception-open-${item.id}`}
                              disabled={navigating}
                              aria-current={routeId === item.id ? "true" : undefined}
                              onClick={() => select(item.id)}
                            >
                              Open investigation
                              <ChevronRight size={14} aria-hidden="true" />
                            </button>
                          </footer>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="we-pagination">
                    <span>Live records · newest first</span>
                    <div>
                      <button
                        className="button secondary"
                        disabled={
                          navigating ||
                          list.loading ||
                          !!listError ||
                          !params.has("cursor")
                        }
                        onClick={() =>
                          navigate(exceptionPageParams(params, undefined, true))
                        }
                      >
                        Previous
                      </button>
                      <button
                        className="button secondary"
                        disabled={
                          navigating ||
                          list.loading ||
                          !!listError ||
                          !list.data?.nextCursor
                        }
                        onClick={() =>
                          navigate(exceptionPageParams(params, list.data?.nextCursor))
                        }
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </section>
                <section
                  className="we-detail"
                  hidden={!routeId}
                  aria-labelledby="exception-detail-title"
                >
                  <header className="we-detail-heading">
                    <div>
                      <p className="we-eyebrow">Investigation workspace</p>
                      <h2 id="exception-detail-title" tabIndex={-1}>
                        {row ? exceptionLabels[row.type] : "Current exception"}
                      </h2>
                      {row && <ExceptionBadge status={row.status} />}
                    </div>
                    <button
                      className="we-close"
                      aria-label="Close investigation"
                      disabled={navigating}
                      onClick={closeSelection}
                    >
                      <X size={18} />
                    </button>
                  </header>
                  <div className="we-detail-body">
                    {selected.loading ? (
                      <p role="status">Loading current exception…</p>
                    ) : selectedError ? (
                      <>
                        <Feedback message={selectedError} />
                        <button className="button secondary" onClick={selected.refresh}>
                          Retry current exception
                        </button>
                      </>
                    ) : row ? (
                      <>
                        <p className="we-summary">{row.summary}</p>
                        <dl className="we-dates">
                          <div>
                            <dt>Detected</dt>
                            <dd>{formatStockInstant(row.detectedAt)}</dd>
                          </div>
                          <div>
                            <dt>Last updated</dt>
                            <dd>{formatStockInstant(row.updatedAt)}</dd>
                          </div>
                        </dl>
                        <section className="we-current-note">
                          <h3>Latest investigation note</h3>
                          <p className="we-note">
                            {row.resolutionNote ?? "No investigation note recorded yet."}
                          </p>
                        </section>
                        {row.status === "OPEN" || row.status === "INVESTIGATING" ? (
                          <section className="we-action" data-draft-scope={row.id}>
                            <h3>
                              {row.status === "OPEN"
                                ? "Start an investigation"
                                : "Record the investigation outcome"}
                            </h3>
                            <p>
                              {row.status === "OPEN"
                                ? "Review the source records and add a note to move this exception to investigating."
                                : "Choose resolved or ignored and explain the outcome. Closed exceptions cannot be reopened here."}
                            </p>
                            <OperationActionForm
                              key={row.id}
                              id={row.id}
                              revision={exceptionSnapshot(row)}
                              label="Investigation"
                              reasonLabel="Investigation note"
                              reviewLabel="Review investigation"
                              optionLabel={(v) =>
                                exceptionLabels[v as keyof typeof exceptionLabels] ?? v
                              }
                              options={
                                row.status === "OPEN"
                                  ? ["INVESTIGATING"]
                                  : ["RESOLVED", "IGNORED"]
                              }
                              maxLength={2000}
                              disabled={disabled}
                              uncertain={!!pending}
                              onReview={review}
                              proposal={(values) => {
                                const body = exceptionBodySchema.parse({
                                  expectedStatus: row.status,
                                  status: values.status,
                                  resolutionNote: values.reason,
                                });
                                return {
                                  exceptionChange: { before: row, body },
                                  title:
                                    body.status === "INVESTIGATING"
                                      ? "Start this investigation?"
                                      : "Close this payment exception?",
                                  description:
                                    "This records an investigation state and note. It does not verify a payment, return funds or settle a dispute. Closed exceptions cannot be reopened here.",
                                  facts: [
                                    { label: "Exception", value: row.id },
                                    { label: "Type", value: exceptionLabels[row.type] },
                                    { label: "Original summary", value: row.summary },
                                    {
                                      label: "Current status",
                                      value: exceptionLabels[row.status],
                                    },
                                    {
                                      label: "New status",
                                      value: exceptionLabels[body.status],
                                    },
                                    {
                                      label: "Investigation note",
                                      value: body.resolutionNote,
                                    },
                                  ],
                                  submit: () =>
                                    apiRequest(`${endpoint}/${row.id}/status`, {
                                      method: "POST",
                                      csrf: true,
                                      body,
                                      signal: request.current?.signal,
                                    }).then((result) => result.data),
                                };
                              }}
                            />
                          </section>
                        ) : (
                          <section className="we-closure">
                            <h3>Investigation closed</h3>
                            <p>
                              {row.status === "RESOLVED"
                                ? "Recorded as resolved."
                                : "Recorded as ignored."}{" "}
                              No further action is available here.
                            </p>
                            <p>{row.resolvedAt && formatStockInstant(row.resolvedAt)}</p>
                          </section>
                        )}
                        <p className="we-scope">
                          Closing an exception records an operational decision. It does
                          not change payment or refund status.
                        </p>
                        <details className="we-references">
                          <summary>Source references</summary>
                          <dl>
                            {(
                              [
                                ["Exception", row.id],
                                ["Payment", row.paymentId],
                                ["Attempt", row.paymentAttemptId],
                                ["Refund", row.refundId],
                                ["Dispute", row.disputeId],
                                ["Closed by", row.resolvedByUserId],
                              ] as const
                            )
                              .filter(([, v]) => v)
                              .map(([label, value]) => (
                                <div key={label}>
                                  <dt>{label}</dt>
                                  <dd>{value}</dd>
                                </div>
                              ))}
                          </dl>
                        </details>
                        <div className="we-source-links">
                          <Link
                            className="text-link"
                            href={
                              row.paymentId
                                ? `/admin/payments?selected=${encodeURIComponent(row.paymentId)}`
                                : "/admin/payments"
                            }
                          >
                            Payment records
                          </Link>
                          {row.refundId && (
                            <Link
                              className="text-link"
                              href={`/admin/refunds?refundId=${encodeURIComponent(row.refundId)}`}
                            >
                              Related refund
                            </Link>
                          )}
                          {row.disputeId && (
                            <Link className="text-link" href="/admin/payment-disputes">
                              Dispute queue
                            </Link>
                          )}
                          <button
                            className="text-link"
                            disabled={navigating}
                            onClick={() => void loadCurrent()}
                          >
                            Read current exception
                          </button>
                        </div>
                      </>
                    ) : (
                      <p>Select an exception to inspect its current investigation.</p>
                    )}
                  </div>
                </section>
                {!routeId && (
                  <aside className="we-placeholder">
                    <SearchCheck size={34} aria-hidden="true" />
                    <h2>Follow the exception through</h2>
                    <p>
                      Open a record to inspect its source references, investigation note
                      and next available action.
                    </p>
                    <ol>
                      <li>Open</li>
                      <li>Investigating</li>
                      <li>Resolved or ignored</li>
                    </ol>
                    <p>Each update requires a note and confirmation.</p>
                  </aside>
                )}
              </div>
            </>
          )}
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          exposeBusyState
          onClose={() => {
            setProposal(null);
            queueMicrotask(() => opener.current?.isConnected && opener.current.focus());
          }}
          onSuccess={() => {}}
          confirmLabel="Confirm investigation update"
        />
      )}
    </div>
  );
}
function ExceptionBadge({ status }: { status: WorkException["status"] }) {
  return (
    <span data-status={status} className={`we-badge we-badge-${status.toLowerCase()}`}>
      {exceptionLabels[status]}
    </span>
  );
}
