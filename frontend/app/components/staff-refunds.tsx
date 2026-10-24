"use client";
import { NotificationRecordContext } from "./notification-record-context";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, ReceiptText, X } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { refundMessages, refundStatuses } from "@/lib/api/staff-payment-schemas";
import { refundActionSchema } from "@/lib/api/refund-processing";
import {
  draftIdentity,
  cancelDraftSubmission,
  draftKey,
  forgetDraft,
} from "@/lib/forms/drafts";
import { formatKobo } from "@/lib/format/money";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  refundQuery,
  refundPageParams,
  parseRefundPage,
  parseCurrentRefund,
  refundSnapshot,
  availableRefundAction,
  validateRefundDecision,
  refundStatusLabels,
  refundHandlingMessage,
  type CurrentRefund,
  type RefundAction,
} from "@/lib/admin/work-refunds";
import {
  readRefundPending,
  markRefundPending,
  clearRefundPending,
  redactRefundChanges,
  refundFingerprint,
  purgeRefundBankDrafts,
  type RefundPending,
  type RefundReview,
} from "@/lib/admin/work-refund-pending";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { RefundDecisionForm } from "./refund-decision-form";
import { RefundTransferForm } from "./refund-transfer-form";
import { RefundEvidenceCheck } from "./refund-evidence-check";
import { RefundBadge, RefundFacts } from "./refund-record-facts";

export function StaffRefunds() {
  const session = useAccountSession();
  if (!session) return null;
  return (
    <RefundAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function RefundAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    p = access.data;
  const invalid = !!p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE");
  const error =
    access.error ||
    access.refreshError ||
    (invalid ? "Current refund access could not be confirmed." : undefined);
  const allowed =
    !!p &&
    (["ADMIN", "SUPER_ADMIN"].includes(role) ||
      p.capabilities.some((c) =>
        ["REFUND_APPROVE", "REFUND_TRANSFER", "REFUND_CHECK"].includes(c),
      ));
  useEffect(() => {
    if (access.denied || invalid || (p && !allowed)) redactRefundChanges();
  }, [access.denied, invalid, p, allowed]);
  useEffect(() => {
    if (p && allowed && !error && !access.loading) purgeRefundBankDrafts(owner, role);
  }, [p, allowed, error, access.loading, owner, role]);
  if (!p || error || access.loading || !allowed)
    return (
      <div className="work-inspections work-refunds">
        <h1>Refund requests</h1>
        {error || (!access.loading && p && !allowed) ? (
          <Feedback
            message={
              error ??
              "An active refund approval, transfer or checking permission is required."
            }
          />
        ) : (
          <p role="status">Checking refund permissions…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh refund permissions
        </button>
      </div>
    );
  return (
    <RefundWorkspace
      owner={owner}
      role={role}
      grants={p.capabilities}
      refreshAccess={access.refresh}
    />
  );
}
type SavedRefund = {
  id: string;
  number: string;
  action: RefundAction;
  status: string;
  amount: string;
};
class RefundPreflightError extends ApiError {
  constructor() {
    super(409, { error: { code: "CONFLICT" } });
    this.message =
      "No refund change request was sent. Close the review and inspect the current refund.";
  }
}
function useRefundRecords(path: string | null) {
  const parse = useCallback(
    (value: unknown) => parseRefundPage(value, new URLSearchParams(path?.split("?")[1])),
    [path],
  );
  return useResource(path, parse);
}
function RefundWorkspace({
  owner,
  role,
  grants,
  refreshAccess,
}: {
  owner: string;
  role: string;
  grants: string[];
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    administrator = ["ADMIN", "SUPER_ADMIN"].includes(role);
  const query = refundQuery(new URLSearchParams(search.toString()), administrator),
    params = query.params;
  const routeId = params.get("refundId"),
    [lastId, setLastId] = useState<string | null>(routeId);
  useEffect(() => {
    if (routeId) queueMicrotask(() => setLastId(routeId));
  }, [routeId]);
  const selectedId = routeId ?? lastId;
  const parseSelected = useCallback(
    (v: unknown) => parseCurrentRefund(v, selectedId ?? ""),
    [selectedId],
  );
  const [unavailable, setUnavailable] = useState(false),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [working, setWorking] = useState(false);
  const [pending, setPending] = useState<RefundPending | undefined>(() =>
    readRefundPending(owner, role),
  );
  const [recovery, setRecovery] = useState<CurrentRefund>(),
    [inspected, setInspected] = useState<CurrentRefund>(),
    [saved, setSaved] = useState<SavedRefund>();
  const [message, setMessage] = useState<string>(),
    [acknowledged, setAcknowledged] = useState(false),
    [reference, setReference] = useState(routeId ?? "");
  const list = useRefundRecords(!unavailable && !query.invalid ? query.path : null);
  const selected = useResource(
    !unavailable && !query.invalid && selectedId ? `/staff/refunds/${selectedId}` : null,
    parseSelected,
  );
  const active = useRef(true),
    flight = useRef(false),
    request = useRef<AbortController | null>(null),
    focus = useRef<string | null>(null);
  const reviewOpener = useRef<HTMLElement | null>(null);
  const reviewContext = useRef<{
      before: CurrentRefund;
      action: RefundAction;
      body: unknown;
    } | null>(null),
    receipt = useRef<SavedRefund | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const deny = useCallback(() => {
    redactRefundChanges();
    setUnavailable(true);
    setProposal(null);
    setInspected(undefined);
    setRecovery(undefined);
    setSaved(undefined);
    setMessage(undefined);
    reviewContext.current = null;
    receipt.current = null;
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
      const target = document.getElementById(focus.current ?? "");
      focus.current = null;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "instant" });
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
      blocked ||
      query.invalid ||
      list.loading ||
      !!listError ||
      selected.loading ||
      selected.refreshing ||
      !!selectedError;
  function navigate(next: URLSearchParams, replace = false) {
    if (flight.current || proposal) return;
    const href = `/admin/refunds${next.size ? `?${next}` : ""}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }
  function select(id: string) {
    if (navigating) return;
    const next = new URLSearchParams(params);
    next.set("refundId", id);
    setLastId(id);
    focus.current = "refund-handling-title";
    navigate(next);
  }
  function closeHandling() {
    const next = new URLSearchParams(params);
    next.delete("refundId");
    focus.current = routeId ? `refund-open-${routeId}` : "refund-records-title";
    navigate(next);
  }
  function denied(error: unknown) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      deny();
      return true;
    }
    return false;
  }
  function identity(signal?: AbortSignal) {
    if (!active.current || signal?.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Refund account changed");
  }
  async function fresh(id: string, signal: AbortSignal) {
    const profile = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    identity(signal);
    if (profile.id !== owner || profile.role !== role || profile.status !== "ACTIVE")
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    const current = parseCurrentRefund(
      (await apiRequest(`/staff/refunds/${id}`, { signal })).data,
      id,
    );
    identity(signal);
    return { current, profile };
  }
  function acceptReceipt(value: unknown) {
    identity(request.current?.signal);
    const context = reviewContext.current;
    if (!context) throw Error("Refund review changed");
    let status: string;
    if (context.action === "decision") {
      const body = z
        .object({
          decision: z.enum(["APPROVED", "CANCELLED"]),
          note: z.string().optional(),
        })
        .strict()
        .parse(context.body);
      status = validateRefundDecision(value, context.before, body, owner).status;
    } else {
      const result = refundActionSchema.parse(value);
      if (
        result.id !== context.before.id ||
        result.amountKobo !== context.before.amountKobo
      )
        throw Error("Refund receipt scope changed");
      status = result.status;
    }
    receipt.current = {
      id: context.before.id,
      number: context.before.refundNumber,
      amount: context.before.amountKobo,
      action: context.action,
      status,
    };
  }
  function review(next: RefundReview) {
    if (
      disabled ||
      !row ||
      !routeId ||
      !next.refundChange ||
      availableRefundAction(row, owner, grants) !== next.refundChange.action
    )
      return;
    const before = row,
      change = next.refundChange;
    reviewOpener.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMessage(undefined);
    reviewContext.current = { before, ...change };
    receipt.current = null;
    setProposal({
      ...next,
      retryAfterRejection: false,
      retrySafely: false,
      onUncertain: () => {
        setPending(readRefundPending(owner, role));
        focus.current = "refund-recovery-title";
      },
      submit: async () => {
        if (flight.current)
          throw new ApiError(409, {
            message: "A refund operation is already in progress.",
          });
        flight.current = true;
        setWorking(true);
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        let sent = false,
          marker: Exclude<RefundPending, "unknown"> | undefined;
        try {
          const previous = readRefundPending(owner, role);
          if (previous) {
            setPending(previous);
            throw Error("An earlier refund change needs reconciliation.");
          }
          const verified = await fresh(before.id, controller.signal);
          if (refundSnapshot(verified.current) !== refundSnapshot(before)) {
            setInspected(verified.current);
            setRecovery(verified.current);
            list.refresh();
            focus.current = "refund-current-title";
            throw Error(
              "The refund changed. Review current facts before proposing another action.",
            );
          }
          if (
            availableRefundAction(
              verified.current,
              owner,
              verified.profile.capabilities,
            ) !== change.action
          )
            throw new ApiError(403, { error: { code: "FORBIDDEN" } });
          const fingerprint = await refundFingerprint(change.body);
          identity(controller.signal);
          marker = markRefundPending(owner, role, {
            refundId: before.id,
            action: change.action,
            expectedUpdatedAt: before.updatedAt,
            fingerprint,
          });
          setPending(marker);
          receipt.current = null;
          sent = true;
          // This workflow validates the domain receipt before retiring its draft.
          cancelDraftSubmission();
          await next.submit();
          identity(controller.signal);
          const result = receipt.current as SavedRefund | null;
          if (!result) throw Error("The refund change receipt could not be confirmed.");
          clearRefundPending(owner, role, marker.token);
          if (change.action === "decision") {
            const form = JSON.stringify(["refund-decision-form:1", before.id]);
            forgetDraft(
              draftKey(`${owner}:${role}`, "/admin/refunds", `${before.id}:${form}`),
            );
            forgetDraft(draftKey(`${owner}:${role}`, "/admin/refunds", form));
          }
          setPending(undefined);
          setSaved(result);
          setRecovery(undefined);
          focus.current = "refund-saved-title";
          list.refresh();
          selected.refresh();
        } catch (error) {
          if (!active.current) throw error;
          if (denied(error)) throw error;
          const definite =
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 429].includes(error.status);
          if (!sent || definite) {
            if (marker) {
              clearRefundPending(owner, role, marker.token);
              setPending(undefined);
            }
            setMessage(
              !sent
                ? "No refund change request was sent. Close the review and check current facts."
                : "The server rejected this change. Check the current refund before reviewing another action.",
            );
            if (!sent) throw new RefundPreflightError();
            throw error;
          }
          setPending(readRefundPending(owner, role));
          focus.current = "refund-recovery-title";
          throw Error("The refund change outcome could not be confirmed.");
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
        ? pending.refundId
        : reference || routeId || selectedId;
    if (!id || !z.uuid().safeParse(id).success) {
      setMessage("Enter a valid refund reference to inspect.");
      document.getElementById("refund-recovery-reference")?.focus();
      return;
    }
    flight.current = true;
    setWorking(true);
    setMessage(undefined);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const verified = await fresh(id.toLowerCase(), controller.signal);
      setRecovery(verified.current);
      if (verified.current.id === selectedId) {
        setInspected(verified.current);
      }
      const listed = list.data?.items.find((item) => item.id === verified.current.id);
      if (
        listed &&
        (listed.updatedAt !== verified.current.updatedAt ||
          listed.status !== verified.current.status)
      )
        list.refresh();
      setAcknowledged(false);
      focus.current = "refund-current-title";
    } catch (error) {
      if (active.current && !denied(error))
        setMessage(
          "The current refund could not be checked. Any local recovery lock remains in place.",
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
      (pending && pending !== "unknown" && recovery.id !== pending.refundId)
    )
      return;
    try {
      clearRefundPending(
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
      focus.current = "refund-handling-title";
    } catch {
      setMessage(
        "The local recovery lock could not be cleared. Keep the refund reference and check again.",
      );
    }
  }
  const stage = row ? availableRefundAction(row, owner, grants) : undefined;
  return (
    <div className="work-inspections work-refunds">
      <nav className="wr-breadcrumb" aria-label="Refund breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Refund requests</span>
          </li>
        </ol>
      </nav>
      <header className="wr-heading">
        <div>
          <h1 id="refund-page-title" tabIndex={-1}>
            Refund requests
          </h1>
          <p>Review approvals, recorded transfers and independent checks.</p>
        </div>
        <div className="wr-header-actions">
          <button
            className="button secondary"
            disabled={navigating}
            onClick={refreshAccess}
          >
            Refresh refund permissions
          </button>
          {administrator && (
            <Link className="button secondary" href="/admin/payments">
              View payment records
            </Link>
          )}
        </div>
      </header>
      {blocked ? (
        <section className="wr-feedback">
          <h2>Refund access is unavailable</h2>
          <Feedback message="Protected refund records, evidence and proposals have been cleared. Refresh your permissions before continuing." />
        </section>
      ) : query.invalid ? (
        <section className="wr-feedback">
          <h2>Refund link needs checking</h2>
          <Feedback message="This link contains an unsupported filter, reference or page history." />
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams(), true)}
          >
            Open refund records
          </button>
        </section>
      ) : (
        <>
          <div className="wr-filter">
            <div className="field">
              <label htmlFor="refund-status">Refund status filter</label>
              <select
                id="refund-status"
                value={params.get("status") ?? ""}
                disabled={navigating}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  if (e.target.value) next.set("status", e.target.value);
                  else next.delete("status");
                  next.delete("cursor");
                  next.delete("_trail");
                  navigate(next);
                }}
              >
                <option value="">All statuses</option>
                {refundStatuses.map((v) => (
                  <option key={v} value={v}>
                    {refundStatusLabels[v]}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="button secondary"
              disabled={navigating || list.loading}
              onClick={list.refresh}
            >
              <RefreshCw size={15} aria-hidden="true" />
              Refresh refund records
            </button>
            <p>
              {list.loading
                ? "Checking refund records…"
                : list.data
                  ? `${list.data.items.length} refund${list.data.items.length === 1 ? "" : "s"} on this page`
                  : "Refund records"}
            </p>
          </div>
          <Feedback message={listError} />
          <Feedback message={message} tone="info" />
          {saved && (
            <section className="wr-result" aria-labelledby="refund-saved-title">
              <h2 id="refund-saved-title" tabIndex={-1}>
                {saved.action === "decision"
                  ? "Refund decision recorded"
                  : saved.action === "transfer"
                    ? "Transfer record confirmed"
                    : "Independent check recorded"}
              </h2>
              <p>
                {saved.number} · {formatKobo(saved.amount)} ·{" "}
                {refundStatusLabels[saved.status as keyof typeof refundStatusLabels] ??
                  saved.status}
              </p>
              <p>
                {saved.action === "decision"
                  ? "Approval or cancellation does not confirm that money was returned."
                  : saved.action === "transfer"
                    ? "The external transfer was recorded. Independent checking is still required."
                    : "The saved check result is shown above. Current refund facts may change later."}
              </p>
            </section>
          )}
          {pending && (
            <section className="wr-recovery" aria-labelledby="refund-recovery-title">
              <h2 id="refund-recovery-title" tabIndex={-1}>
                Refund change needs checking
              </h2>
              <p>
                The earlier outcome could not be confirmed. Refund changes stay locked
                across reload. A current read does not prove the original request&apos;s
                outcome and never resends it.
              </p>
              {pending === "unknown" ? (
                <>
                  <p>
                    The original reference was redacted or recovery storage is
                    unavailable. Use a known refund reference for an independent check.
                  </p>
                  <div className="field">
                    <label htmlFor="refund-recovery-reference">
                      Refund reference to inspect
                    </label>
                    <input
                      id="refund-recovery-reference"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      maxLength={36}
                      disabled={working || !!proposal}
                    />
                  </div>
                </>
              ) : (
                <p className="wr-reference">
                  {pending.action === "decision"
                    ? "Decision"
                    : pending.action === "transfer"
                      ? "Transfer record"
                      : "Independent check"}{" "}
                  · {pending.refundId}
                </p>
              )}
              <button
                className="button secondary"
                disabled={working || !!proposal}
                onClick={() => void loadCurrent()}
              >
                {working ? "Checking current refund…" : "Load current refund"}
              </button>
            </section>
          )}
          {recovery && (
            <section className="wr-result" aria-labelledby="refund-current-title">
              <h2 id="refund-current-title" tabIndex={-1}>
                Current refund facts
              </h2>
              <p>
                {recovery.refundNumber} · {refundStatusLabels[recovery.status]} ·{" "}
                {formatKobo(recovery.amountKobo)}
              </p>
              <p className="wr-reference">Refund reference: {recovery.id}</p>
              <p>
                This read shows current facts. It does not prove which request changed the
                refund.
              </p>
              {pending && (
                <>
                  <label className="wr-ack">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                    I have independently reconciled the earlier request and can clear its
                    local recovery lock.
                  </label>
                  <button
                    className="button secondary"
                    disabled={!acknowledged || working}
                    onClick={clearReconciled}
                  >
                    Clear reconciled lock
                  </button>
                </>
              )}
            </section>
          )}
          <div className={`wr-layout${routeId ? " wr-has-selection" : ""}`}>
            <section className="wr-queue" aria-labelledby="refund-records-title">
              <div className="wr-section-heading">
                <h2 id="refund-records-title" tabIndex={-1}>
                  Refund records
                </h2>
                <span>Requested amount · NGN</span>
              </div>
              {list.loading && !list.data && (
                <div className="wr-loading" role="status">
                  <ReceiptText size={24} aria-hidden="true" />
                  <p>Loading refund records…</p>
                  <div />
                  <div />
                  <div />
                </div>
              )}
              {listError && !list.data && (
                <div className="wr-empty">
                  <h3>Refund records could not be loaded</h3>
                  <p>Refresh the records to check again.</p>
                </div>
              )}
              {listError && list.data && (
                <p className="wr-notice">
                  Previously loaded refund facts are shown for reference. Refresh
                  successfully before making a change.
                </p>
              )}
              {!list.loading && !listError && list.data?.items.length === 0 && (
                <div className="wr-empty">
                  <ReceiptText size={24} aria-hidden="true" />
                  <h3>
                    {params.has("status")
                      ? "No refunds match this status"
                      : "No refund records on this page"}
                  </h3>
                  <p>Use the filters or previous page to continue reviewing records.</p>
                  {params.has("status") && (
                    <button
                      className="button secondary"
                      disabled={navigating}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        for (const key of ["status", "cursor", "_trail"])
                          next.delete(key);
                        navigate(next);
                      }}
                    >
                      Clear refund filter
                    </button>
                  )}
                </div>
              )}
              {list.data?.items.map((item) => (
                <article
                  className={`wr-record${routeId === item.id ? " wr-selected" : ""}`}
                  key={item.id}
                  aria-labelledby={`refund-heading-${item.id}`}
                >
                  <div className="wr-record-top">
                    <div>
                      <h3 id={`refund-heading-${item.id}`}>{item.refundNumber}</h3>
                      <RefundBadge status={item.status} />
                    </div>
                    <strong className="wr-amount">{formatKobo(item.amountKobo)}</strong>
                  </div>
                  <p className="wr-record-meta">
                    {item.paymentAttempt.provider === "MANUAL"
                      ? "Bank transfer"
                      : item.paymentAttempt.provider}{" "}
                    · {formatStockInstant(item.requestedAt)}
                  </p>
                  <p className="wr-reason">{item.reason}</p>
                  <div className="wr-record-actions">
                    <button
                      id={`refund-open-${item.id}`}
                      className="button secondary"
                      aria-expanded={routeId === item.id}
                      disabled={navigating}
                      onClick={() => select(item.id)}
                    >
                      {availableRefundAction(item, owner, grants)
                        ? "Review refund actions"
                        : "View refund record"}
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                  <RefundFacts
                    row={item}
                    expanded={params.get("expanded") === item.id}
                    onOpenChange={(open) => {
                      if ((params.get("expanded") === item.id) === open) return;
                      const next = new URLSearchParams(params);
                      if (open) next.set("expanded", item.id);
                      else if (next.get("expanded") === item.id) next.delete("expanded");
                      navigate(next);
                    }}
                  />
                </article>
              ))}
              <nav className="wr-pagination" aria-label="Refund requests pages">
                <button
                  className="button secondary"
                  disabled={
                    navigating || list.loading || !!listError || !params.has("cursor")
                  }
                  onClick={() => navigate(refundPageParams(params, undefined, true))}
                >
                  Previous
                </button>
                <span>{params.has("cursor") ? "Current page" : "First page"}</span>
                <button
                  className="button secondary"
                  disabled={
                    navigating || list.loading || !!listError || !list.data?.nextCursor
                  }
                  onClick={() =>
                    navigate(refundPageParams(params, list.data?.nextCursor))
                  }
                >
                  Next
                </button>
              </nav>
            </section>
            <aside
              className="wr-handling"
              hidden={!routeId}
              aria-labelledby="refund-handling-title"
            >
              <div className="wr-pane-heading">
                <button
                  className="wr-back text-link"
                  disabled={navigating}
                  onClick={closeHandling}
                >
                  Back to refund records
                </button>
                <h2 id="refund-handling-title" tabIndex={-1}>
                  {row?.refundNumber ?? "Refund handling"}
                </h2>
                <button
                  className="button secondary wr-close"
                  disabled={navigating}
                  onClick={closeHandling}
                  aria-label="Close refund handling"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <Feedback message={selectedError} />
              {selected.loading && <p role="status">Checking current refund…</p>}
              {selectedError && row && (
                <p className="wr-notice">
                  Previously loaded handling facts are shown. Refresh this refund before
                  continuing.
                </p>
              )}
              {row &&
                !selected.loading &&
                !selected.refreshing &&
                !selected.error &&
                !selected.refreshError && (
                  <NotificationRecordContext resourceType="REFUND" resourceId={row.id} />
                )}
              {row && (
                <>
                  <section className="wr-value" aria-label="Selected refund amount">
                    <span>Refund amount</span>
                    <strong>{formatKobo(row.amountKobo)}</strong>
                    <span>NGN · {refundStatusLabels[row.status]}</span>
                  </section>
                  <section className="wr-original">
                    <h3>Original request</h3>
                    <p>{row.reason}</p>
                    <p>
                      {row.authorizationKind === "HUMAN"
                        ? "Human-reviewed refund"
                        : "Automatic policy-authorized reversal"}{" "}
                      ·{" "}
                      {row.paymentAttempt.provider === "MANUAL"
                        ? "Bank transfer"
                        : row.paymentAttempt.provider}
                    </p>
                    <dl>
                      <div>
                        <dt>Requested</dt>
                        <dd>{formatStockInstant(row.requestedAt)}</dd>
                      </div>
                      <div>
                        <dt>Refund deadline</dt>
                        <dd>
                          {row.dueAt
                            ? formatStockInstant(row.dueAt)
                            : "No refund deadline is recorded."}
                        </dd>
                      </div>
                    </dl>
                    <p className="wr-state-note">{refundMessages[row.status]}</p>
                  </section>
                  <section className="wr-action-workspace" data-draft-scope={row.id}>
                    {(!stage || stage === "decision") && (
                      <h3>
                        {stage === "decision" ? "Refund decision" : "Refund handling"}
                      </h3>
                    )}
                    {stage === "decision" ? (
                      <RefundDecisionForm
                        refund={row}
                        actorId={owner}
                        disabled={disabled}
                        uncertain={!!pending}
                        onUncertain={() => setPending(readRefundPending(owner, role))}
                        onReview={review}
                        onReceipt={acceptReceipt}
                        requestSignal={() => request.current?.signal}
                      />
                    ) : stage === "transfer" ? (
                      <RefundTransferForm
                        refund={row}
                        actorId={owner}
                        disabled={disabled}
                        onUncertain={() => setPending(readRefundPending(owner, role))}
                        onReview={review}
                        onReceipt={acceptReceipt}
                        requestSignal={() => request.current?.signal}
                        onDenied={deny}
                      />
                    ) : stage === "check" ? (
                      <RefundEvidenceCheck
                        refund={row}
                        actorId={owner}
                        disabled={disabled}
                        onUncertain={() => setPending(readRefundPending(owner, role))}
                        onReview={review}
                        onReceipt={acceptReceipt}
                        requestSignal={() => request.current?.signal}
                        onDenied={deny}
                      />
                    ) : (
                      <p>{refundHandlingMessage(row)}</p>
                    )}
                    <p className="wr-independence">
                      {stage === "decision"
                        ? "A different authorized operator from the requester must approve or cancel this refund."
                        : stage === "transfer"
                          ? "The transfer operator must differ from the requester and approver."
                          : stage === "check"
                            ? "The checker must differ from the requester, approver and transfer operator."
                            : "Approval, an external transfer record and independently confirmed completion are separate outcomes."}
                    </p>
                  </section>
                  <RefundFacts row={row} />
                </>
              )}
              <button
                className="button secondary wr-refresh-current"
                disabled={navigating || selected.loading}
                onClick={selected.refresh}
              >
                Refresh current refund
              </button>
            </aside>
          </div>
        </>
      )}
      {proposal && !blocked && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            const restore = !focus.current;
            setProposal(null);
            if (restore) requestAnimationFrame(() => reviewOpener.current?.focus());
          }}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
