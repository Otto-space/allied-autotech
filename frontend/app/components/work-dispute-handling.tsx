"use client";
import { NotificationRecordContext } from "./notification-record-context";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, X } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { DisputeWork } from "@/lib/api/dispute-workflow";
import {
  handlingQuery,
  handlingPageParams,
  parseCurrentDispute,
  parseHandlingPage,
  disputeSnapshot,
  validateHandlingReceipt,
} from "@/lib/admin/work-dispute-handling";
import {
  readDisputePending,
  markDisputePending,
  clearDisputePending,
  redactDisputeChanges,
  disputeFingerprint,
  type DisputePending,
} from "@/lib/admin/work-dispute-pending";
import {
  draftIdentity,
  cancelDraftSubmission,
  draftKey,
  forgetDraft,
} from "@/lib/forms/drafts";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { DisputeAssignment } from "./dispute-assignment";
import { DisputeProgress } from "./dispute-progress";
import { DisputeEvidence } from "./dispute-evidence";
import { DisputeProviderFacts } from "./dispute-provider-facts";
const root = "/admin/payment-disputes/work",
  endpoint = "/staff/disputes";
const label = (v: string) =>
  v
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (s) => s.toUpperCase());
export function WorkDisputeHandling() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return <Feedback message="Staff access is required for dispute handling." />;
  return (
    <HandlingAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function HandlingAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    profile = access.data;
  const invalid =
    !!profile &&
    (profile.id !== owner ||
      profile.role !== role ||
      profile.status !== "ACTIVE" ||
      !profile.capabilities.includes("DISPUTE_MANAGE"));
  const error =
    access.error ||
    access.refreshError ||
    (invalid
      ? "An active dispute-management grant is required to use this queue."
      : undefined);
  useEffect(() => {
    if (access.denied || invalid) redactDisputeChanges();
  }, [access.denied, invalid]);
  if (!profile || error || access.loading)
    return (
      <div className="work-dispute-handling">
        <h1>Dispute work queue</h1>
        {error ? (
          <Feedback message={error} />
        ) : (
          <p role="status">Checking dispute permissions…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh dispute permissions
        </button>
      </div>
    );
  return <HandlingWorkspace owner={owner} role={role} refreshAccess={access.refresh} />;
}
function useHandlingRecords(path: string | null, owner: string, role: string) {
  const parse = useCallback(
    (value: unknown) =>
      parseHandlingPage(value, new URLSearchParams(path?.split("?")[1]), owner, role),
    [path, owner, role],
  );
  return useResource(path, parse);
}
class PreflightError extends ApiError {
  constructor() {
    super(409, { error: { code: "CONFLICT" } });
    this.message =
      "No dispute change request was sent. Close the review and inspect current facts.";
  }
}
function HandlingWorkspace({
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
    query = handlingQuery(new URLSearchParams(search.toString())),
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
  const [pending, setPending] = useState<DisputePending | undefined>(() =>
    readDisputePending(owner, role),
  );
  const [inspected, setInspected] = useState<DisputeWork>(),
    [recovery, setRecovery] = useState<DisputeWork>(),
    [saved, setSaved] = useState<DisputeWork>();
  const [message, setMessage] = useState<string>(),
    [reference, setReference] = useState(routeId ?? ""),
    [acknowledged, setAcknowledged] = useState(false);
  const list = useHandlingRecords(!unavailable ? query.path : null, owner, role);
  const parseSelected = useCallback(
    (value: unknown) => parseCurrentDispute(value, selectedId ?? "", owner, role),
    [selectedId, owner, role],
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
    redactDisputeChanges();
    setUnavailable(true);
    setProposal(null);
    setInspected(undefined);
    setRecovery(undefined);
    setSaved(undefined);
    setMessage(undefined);
  }, []);
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
      if (!el) return;
      focus.current = null;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(timer);
  }, [proposal, unavailable, saved, recovery, pending, routeId, selected.data]);
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
  const admin = role === "ADMIN" || role === "SUPER_ADMIN";
  function navigate(next: URLSearchParams) {
    if (flight.current || proposal) return;
    router.push(`${root}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  function select(id: string) {
    if (navigating) return;
    const next = new URLSearchParams(params);
    next.set("selected", id);
    setLastId(id);
    focus.current = "handling-detail-title";
    navigate(next);
  }
  function closeSelection() {
    const next = new URLSearchParams(params);
    next.delete("selected");
    focus.current = routeId ? `handling-open-${routeId}` : "handling-queue-title";
    navigate(next);
  }
  function identity(signal?: AbortSignal) {
    if (!active.current || signal?.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Dispute account changed");
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
    if (
      profile.id !== owner ||
      profile.role !== role ||
      profile.status !== "ACTIVE" ||
      !profile.capabilities.includes("DISPUTE_MANAGE")
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    const current = parseCurrentDispute(
      (await apiRequest(`${endpoint}/${id}`, { signal })).data,
      id,
      owner,
      role,
    );
    identity(signal);
    return current;
  }
  function review(next: MutationProposal) {
    if (disabled || !row || !routeId || !next.disputeChange) return;
    const before = row,
      change = next.disputeChange.change;
    if (disputeSnapshot(next.disputeChange.before) !== disputeSnapshot(before)) return;
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
        setPending(readDisputePending(owner, role));
        focus.current = "handling-recovery-title";
      },
      submit: async () => {
        if (flight.current) throw new PreflightError();
        flight.current = true;
        setWorking(true);
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        let sent = false,
          marker: Exclude<DisputePending, "unknown"> | undefined;
        try {
          const previous = readDisputePending(owner, role);
          if (previous) {
            setPending(previous);
            throw Error("An earlier change needs reconciliation");
          }
          const current = await fresh(before.id, controller.signal);
          if (disputeSnapshot(current) !== disputeSnapshot(before)) {
            setInspected(current);
            setRecovery(current);
            list.refresh();
            focus.current = "handling-current-title";
            throw Error("The dispute changed");
          }
          const fingerprint = await disputeFingerprint(change);
          identity(controller.signal);
          marker = markDisputePending(owner, role, {
            id: before.id,
            action: change.action,
            expectedUpdatedAt: before.updatedAt,
            fingerprint,
          });
          setPending(marker);
          sent = true;
          cancelDraftSubmission();
          const receipt = validateHandlingReceipt(
            await next.submit(),
            before,
            change,
            owner,
            role,
          );
          identity(controller.signal);
          clearDisputePending(owner, role, marker.token);
          setPending(undefined);
          const kind =
            change.action === "assign"
              ? "dispute-assignment:1"
              : change.action === "acknowledge"
                ? "dispute-progress:1"
                : change.action === "submission"
                  ? "dispute-progress:2"
                  : "dispute-evidence:1";
          const form = JSON.stringify([kind, before.id]);
          forgetDraft(draftKey(`${owner}:${role}`, root, form));
          forgetDraft(draftKey(`${owner}:${role}`, root, `${before.id}:${form}`));
          setInspected(receipt);
          setSaved(receipt);
          setRecovery(undefined);
          focus.current = "handling-saved-title";
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
              clearDisputePending(owner, role, marker.token);
              setPending(undefined);
            }
            setMessage(
              sent
                ? "The server rejected this change. Read the current dispute before reviewing another action."
                : "No dispute change request was sent. Close the review and inspect current facts.",
            );
            if (!sent) throw new PreflightError();
            throw error;
          }
          setPending(readDisputePending(owner, role));
          focus.current = "handling-recovery-title";
          throw Error("Dispute outcome could not be confirmed");
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
      setMessage("Enter a valid dispute reference to inspect.");
      document.getElementById("handling-reference")?.focus();
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
      if (listed && disputeSnapshot(listed) !== disputeSnapshot(current)) list.refresh();
      focus.current = "handling-current-title";
    } catch (error) {
      if (active.current && !denied(error))
        setMessage(
          "The current dispute could not be checked. Any local recovery lock remains in place.",
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
      clearDisputePending(
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
      focus.current = "handling-detail-title";
    } catch {
      setMessage(
        "The local recovery lock could not be cleared. Keep the dispute reference and check again.",
      );
    }
  }
  return (
    <div className="work-dispute-handling">
      <nav className="wh-breadcrumb" aria-label="Dispute work breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          {admin && (
            <li>
              <ChevronRight size={14} aria-hidden="true" />
              <Link href="/admin/payment-disputes">Payment disputes</Link>
            </li>
          )}
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Work queue</span>
          </li>
        </ol>
      </nav>
      <header className="wh-heading">
        <div>
          <h1>Dispute work queue</h1>
          <p>Assign operators, preserve evidence and record provider receipts.</p>
        </div>
        {admin && !blocked && (
          <Link className="text-link" href="/admin/payment-disputes">
            View dispute overview
          </Link>
        )}
      </header>
      {blocked ? (
        <section className="wh-state">
          <h2>Dispute access is unavailable</h2>
          <p>Protected records and proposed changes have been cleared.</p>
          <button className="button secondary" onClick={refreshAccess}>
            Refresh dispute permissions
          </button>
        </section>
      ) : query.invalid ? (
        <section className="wh-state">
          <Feedback message="This dispute view contains unsupported or invalid filters." />
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Reset dispute view
          </button>
        </section>
      ) : (
        <>
          <div className="wh-toolbar">
            <div className="field">
              <label htmlFor="handling-history">Dispute history</label>
              <select
                id="handling-history"
                value={params.get("openOnly") === "false" ? "all" : "open"}
                disabled={navigating}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  next.set("openOnly", String(e.target.value === "open"));
                  next.delete("cursor");
                  next.delete("_trail");
                  navigate(next);
                }}
              >
                <option value="open">Open disputes</option>
                <option value="all">All disputes, including resolved</option>
              </select>
            </div>
            <button
              className="button secondary"
              disabled={navigating || list.loading || list.refreshing}
              onClick={() => {
                list.refresh();
                if (routeId) selected.refresh();
              }}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Refresh records
            </button>
            <button className="text-link" disabled={navigating} onClick={refreshAccess}>
              Check permissions
            </button>
          </div>
          <Feedback message={message} />
          {saved && (
            <section className="wh-state wh-saved" role="status">
              <h2 id="handling-saved-title" tabIndex={-1}>
                Dispute action recorded
              </h2>
              <p>
                {saved.providerDisputeId}. Review the updated handling facts below. The
                provider determines the financial outcome.
              </p>
            </section>
          )}
          {pending && (
            <section className="wh-state wh-pending">
              <h2 id="handling-recovery-title" tabIndex={-1}>
                Check the earlier dispute change
              </h2>
              <p>
                Its outcome needs reconciliation before another update. No request will be
                resent automatically.
              </p>
              {pending !== "unknown" ? (
                <p className="wh-reference">Dispute {pending.id}</p>
              ) : (
                <div className="field">
                  <label htmlFor="handling-reference">Dispute reference</label>
                  <input
                    id="handling-reference"
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
                Read current dispute
              </button>
            </section>
          )}
          {recovery && (
            <section className="wh-state">
              <h2 id="handling-current-title" tabIndex={-1}>
                Current dispute checked
              </h2>
              <p className="wh-reference">
                {recovery.providerDisputeId} · {label(recovery.status)}
              </p>
              <p>
                Updated {formatStockInstant(recovery.updatedAt)}. A current read does not
                prove that an interrupted request has finished or that its audit note was
                saved.
              </p>
              <HandlingFacts row={recovery} />
              {pending && (
                <>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      disabled={working}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                    I have independently reconciled the earlier request and will review
                    any new action deliberately.
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
          <section className="wh-queue" aria-labelledby="handling-queue-title">
            <div className="wh-section-heading">
              <h2 id="handling-queue-title" tabIndex={-1}>
                Dispute queue
              </h2>
              <span>
                {list.data
                  ? `${list.data.items.length} on this page`
                  : "Current assignments"}
              </span>
            </div>
            {list.loading ? (
              <p className="wh-empty" role="status">
                Loading disputes…
              </p>
            ) : listError ? (
              <div className="wh-empty">
                <Feedback message={listError} />
                <button className="button secondary" onClick={list.refresh}>
                  Retry dispute queue
                </button>
              </div>
            ) : !list.data?.items.length ? (
              <div className="wh-empty">
                <h3>No disputes match this view</h3>
                <p>
                  {admin
                    ? "Try including resolved disputes or refresh for updates."
                    : "Only disputes assigned to you as primary or backup are shown."}
                </p>
              </div>
            ) : (
              <div className="wh-records">
                {list.data.items.map((v) => (
                  <article
                    className={`wh-record${routeId === v.id ? " is-selected" : ""}`}
                    key={v.id}
                  >
                    <div>
                      <span className="wh-label">
                        {v.provider === "PAYSTACK"
                          ? "Paystack"
                          : v.provider === "MONNIFY"
                            ? "Monnify"
                            : "Manual"}
                      </span>
                      <h3>{v.providerDisputeId}</h3>
                      <span className="wh-badge" data-status={v.status}>
                        {label(v.status)}
                      </span>
                    </div>
                    <div>
                      <span className="wh-label">Disputed amount</span>
                      <strong className="wh-money">{formatKobo(v.amountKobo)}</strong>
                    </div>
                    <div>
                      <span className="wh-label">Response deadline</span>
                      <span>
                        {v.responseDueAt
                          ? formatBusinessDate(v.responseDueAt)
                          : "Not recorded"}
                      </span>
                    </div>
                    <div>
                      <span className="wh-label">Primary operator</span>
                      <span>{v.primaryOperator?.label ?? "Unassigned"}</span>
                    </div>
                    <button
                      id={`handling-open-${v.id}`}
                      className="button secondary"
                      disabled={navigating}
                      aria-expanded={routeId === v.id}
                      onClick={() => select(v.id)}
                    >
                      Review<span className="sr-only"> {v.providerDisputeId}</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
            <div className="wh-pagination">
              <button
                className="button secondary"
                disabled={navigating || list.loading || !params.has("cursor")}
                onClick={() => navigate(handlingPageParams(params, undefined, true))}
              >
                Previous
              </button>
              <button
                className="button secondary"
                disabled={
                  navigating || list.loading || !!listError || !list.data?.nextCursor
                }
                onClick={() =>
                  navigate(handlingPageParams(params, list.data?.nextCursor ?? undefined))
                }
              >
                Next
              </button>
            </div>
          </section>
          {row && !selected.loading && !selected.refreshing && !selectedError && (
            <NotificationRecordContext resourceType="DISPUTE" resourceId={row.id} />
          )}
          {selectedId && (
            <section
              className="wh-detail"
              hidden={!routeId}
              aria-labelledby="handling-detail-title"
            >
              <div className="wh-section-heading">
                <h2 id="handling-detail-title" tabIndex={-1}>
                  Handle dispute
                </h2>
                <button
                  className="button secondary"
                  disabled={navigating}
                  onClick={closeSelection}
                >
                  <X size={15} aria-hidden="true" />
                  Close
                </button>
              </div>
              {selected.loading ? (
                <p role="status">Checking current dispute…</p>
              ) : selectedError ? (
                <>
                  <Feedback message={selectedError} />
                  <button className="button secondary" onClick={selected.refresh}>
                    Retry current dispute
                  </button>
                </>
              ) : (
                row && (
                  <div key={row.id}>
                    <div className="wh-identity">
                      <p className="wh-label">
                        {row.provider} · {label(row.category)}
                      </p>
                      <h3>{row.providerDisputeId}</h3>
                      <span className="wh-badge" data-status={row.status}>
                        {label(row.status)}
                      </span>
                    </div>
                    <HandlingFacts row={row} compact />
                    <button
                      className="text-link"
                      disabled={navigating}
                      onClick={() => void loadCurrent()}
                    >
                      Read current dispute
                    </button>
                    <details className="wh-lifecycle">
                      <summary>Provider facts and record references</summary>
                      <HandlingFacts row={row} lifecycleOnly />
                      <dl className="totals">
                        <DisputeProviderFacts dispute={row} />
                        <dt>Dispute reference</dt>
                        <dd>{row.id}</dd>
                        <dt>Payment attempt</dt>
                        <dd>{row.paymentAttemptId}</dd>
                        <dt>Last updated</dt>
                        <dd>{formatStockInstant(row.updatedAt)}</dd>
                      </dl>
                    </details>
                    {row.resolvedAt ? (
                      <p className="wh-history">
                        Resolved history is preserved. No further changes are available
                        here.
                      </p>
                    ) : (
                      <>
                        {admin && (
                          <DisputeAssignment
                            record={row}
                            disabled={disabled}
                            onReview={review}
                            onDenied={deny}
                          />
                        )}
                        <DisputeProgress
                          record={row}
                          actorId={owner}
                          disabled={disabled}
                          onReview={review}
                        />
                      </>
                    )}
                    <DisputeEvidence
                      record={row}
                      disabled={disabled}
                      onReview={review}
                      onDenied={deny}
                    />
                  </div>
                )
              )}
            </section>
          )}
          {proposal && (
            <MutationReview
              proposal={proposal}
              onSuccess={() => undefined}
              onClose={() => {
                setProposal(null);
                if (!focus.current) requestAnimationFrame(() => opener.current?.focus());
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
function HandlingFacts({
  row,
  compact = false,
  lifecycleOnly = false,
}: {
  row: DisputeWork;
  compact?: boolean;
  lifecycleOnly?: boolean;
}) {
  return (
    <dl className="wh-facts">
      {[
        ["Disputed amount", formatKobo(row.amountKobo)],
        [
          "Confirmed chargeback",
          row.chargebackAmountKobo === null
            ? "Not confirmed"
            : formatKobo(row.chargebackAmountKobo),
        ],
        ["Primary operator", row.primaryOperator?.label ?? "Unassigned"],
        ["Backup operator", row.backupOperator?.label ?? "Unassigned"],
        ["Opened", formatStockInstant(row.openedAt)],
        [
          "Response deadline",
          row.responseDueAt ? formatStockInstant(row.responseDueAt) : "Not recorded",
        ],
        [
          "Acknowledgement deadline",
          row.acknowledgementDueAt
            ? formatStockInstant(row.acknowledgementDueAt)
            : "Not recorded",
        ],
        [
          "Acknowledged",
          row.acknowledgedAt
            ? formatStockInstant(row.acknowledgedAt)
            : "Not yet recorded",
        ],
        ["Evidence", row.hasEvidence ? "Original bundle preserved" : "Not yet recorded"],
        [
          "Provider submission",
          row.respondedAt ? formatStockInstant(row.respondedAt) : "Not yet recorded",
        ],
        ["Provider receipt", row.providerSubmissionReference ?? "Not yet recorded"],
        [
          "Resolution recorded",
          row.resolvedAt ? formatStockInstant(row.resolvedAt) : "Not yet recorded",
        ],
      ]
        .filter((_, i) => (lifecycleOnly ? i >= 4 : !compact || i < 4))
        .map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}
