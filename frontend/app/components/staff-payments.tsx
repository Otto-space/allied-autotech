"use client";
import { NotificationRecordContext } from "./notification-record-context";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { formatKobo } from "@/lib/format/money";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import { refundMessages } from "@/lib/api/staff-payment-schemas";
import {
  parseWorkPayment,
  parseWorkPayments,
  paymentQuery,
  paymentPageParams,
  paymentSnapshot,
  paymentStatusLabels,
  paymentPurposeLabels,
  validateManualPayment,
  validatePaymentRefund,
  parsePaymentRefund,
  type WorkPayment,
  type PaymentRefund,
} from "@/lib/admin/work-payments";
import {
  markPaymentPending,
  readPaymentPending,
  clearPaymentPending,
  forgetPaymentDraft,
  paymentFingerprint,
  type PaymentPending,
} from "@/lib/admin/work-payment-pending";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { PrivateDocumentAccess } from "./private-document-access";
import { ManualDecisionForm, PaymentRefundForm } from "./staff-payment-actions";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function StaffPayments() {
  const s = useAccountSession();
  if (!s) return null;
  return ["ADMIN", "SUPER_ADMIN"].includes(s.user.role) ? (
    <PaymentAccess
      key={`${s.user.id}:${s.user.role}`}
      owner={s.user.id}
      role={s.user.role}
    />
  ) : (
    <div className="work-inspections work-payments">
      <h1>Payment records</h1>
      <Feedback message="Administrator access is required for finance." />
    </div>
  );
}
function PaymentAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    p = access.data,
    error =
      access.error ||
      access.refreshError ||
      (p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
        ? "Current administrator access could not be confirmed."
        : undefined);
  if (!p || error)
    return (
      <div className="work-inspections work-payments">
        <h1>Payment records</h1>
        {error ? (
          <Feedback message={error} />
        ) : (
          <p role="status">Checking payment access…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh payment access
        </button>
      </div>
    );
  return (
    <PaymentWorkspace
      owner={owner}
      role={role}
      refreshAccess={access.refresh}
      accessBusy={access.loading || access.refreshing}
    />
  );
}
function usePayments(path: string | null) {
  const parse = useCallback(
    (value: unknown) =>
      parseWorkPayments(value, new URLSearchParams(path?.split("?")[1])),
    [path],
  );
  return useResource(path, parse);
}
function PaymentWorkspace({
  owner,
  role,
  refreshAccess,
  accessBusy,
}: {
  owner: string;
  role: string;
  refreshAccess: () => void;
  accessBusy: boolean;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    query = paymentQuery(new URLSearchParams(search.toString())),
    records = usePayments(query.path),
    active = useRef(true),
    request = useRef<AbortController | null>(null),
    focusResult = useRef<string | null>(null);
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [pending, setPending] = useState<PaymentPending | undefined>(() =>
      readPaymentPending(owner, role),
    ),
    [retained, setRetained] = useState<MutationProposal | null>(null),
    [inspected, setInspected] = useState<WorkPayment>(),
    [saved, setSaved] = useState<{ payment: WorkPayment; attemptId: string }>(),
    [receipt, setReceipt] = useState<PaymentRefund>(),
    [message, setMessage] = useState<string>(),
    [tone, setTone] = useState<"error" | "success" | "info">("info"),
    [checking, setChecking] = useState(false),
    [unavailable, setUnavailable] = useState(false),
    [generation, setGeneration] = useState(0),
    [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const deny = useCallback(() => {
    focusResult.current = null;
    setUnavailable(true);
    setInspected(undefined);
    setSaved(undefined);
    setReceipt(undefined);
    setProposal(null);
    setRetained(null);
    refreshAccess();
  }, [
    refreshAccess,
    setUnavailable,
    setInspected,
    setSaved,
    setReceipt,
    setProposal,
    setRetained,
  ]);
  useEffect(() => {
    if (!records.denied) return;
    let live = true;
    queueMicrotask(() => {
      if (live) deny();
    });
    return () => {
      live = false;
    };
  }, [records.denied, deny]);
  const busy = records.loading || records.refreshing || checking || accessBusy,
    error = records.error || records.refreshError,
    protectedUnavailable = unavailable || records.denied,
    rows = protectedUnavailable
      ? undefined
      : records.data?.items
          .map((r) =>
            inspected?.id === r.id &&
            Date.parse(inspected.updatedAt) >= Date.parse(r.updatedAt)
              ? inspected
              : r,
          )
          .filter(
            (r) => !query.params.has("status") || r.status === query.params.get("status"),
          ),
    selected = query.params.get("selected"),
    selectedAttempt = query.params.get("attempt"),
    disabled = busy || !!error || !!pending || protectedUnavailable || query.invalid;
  const selectedRecord = useResource(
    !protectedUnavailable && !query.invalid && selected
      ? `/staff/payments/${selected}`
      : null,
    parseWorkPayment,
  );
  const selectionMismatch = !!selectedRecord.data && selectedRecord.data.id !== selected;
  const selectedPayment = selectionMismatch
    ? undefined
    : selectedRecord.data &&
        inspected?.id === selectedRecord.data.id &&
        Date.parse(inspected.updatedAt) >= Date.parse(selectedRecord.data.updatedAt)
      ? inspected
      : selectedRecord.data;
  const selectedInList = !!rows?.some((row) => row.id === selected);
  const selectedElementId = selected
    ? `${selectedInList ? "payment-record" : "payment-selected"}-${selected}`
    : undefined;
  const selectedReady =
    !!selectedPayment &&
    !selectedRecord.loading &&
    !selectedRecord.refreshing &&
    !selectedRecord.error &&
    !selectedRecord.refreshError &&
    !selectionMismatch;
  const focusedSelection = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) {
      focusedSelection.current = null;
      return;
    }
    if (!selectedReady || !selectedElementId || focusedSelection.current === selected)
      return;
    const element = document.getElementById(selectedElementId);
    if (!element) return;
    focusedSelection.current = selected;
    element.scrollIntoView({ block: "nearest", behavior: "instant" });
    element.focus({ preventScroll: true });
  }, [selected, selectedReady, selectedElementId]);
  function refreshPayments() {
    records.refresh();
    selectedRecord.refresh();
  }

  useEffect(() => {
    if (proposal || protectedUnavailable || !focusResult.current) return;
    let live = true;
    queueMicrotask(() => {
      if (!live || !focusResult.current) return;
      const id = focusResult.current;
      focusResult.current = null;
      const heading = document.getElementById(id);
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => {
      live = false;
    };
  }, [proposal, protectedUnavailable, saved, receipt, pending, inspected]);
  function navigate(params: URLSearchParams) {
    router.push(`/admin/payments${params.size ? `?${params}` : ""}`, { scroll: false });
  }
  function choose(paymentId: string, attemptId: string) {
    const p = new URLSearchParams(query.params);
    if (p.get("selected") === paymentId && p.get("attempt") === attemptId) {
      p.delete("selected");
      p.delete("attempt");
    } else {
      p.set("selected", paymentId);
      p.set("attempt", attemptId);
    }
    navigate(p);
  }
  function identity(signal: AbortSignal) {
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Payment account changed");
  }
  async function freshAccess(signal: AbortSignal) {
    const p = parseOwnStaffProfile((await apiRequest("/staff/profile", { signal })).data);
    identity(signal);
    if (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
  }
  async function fresh(id: string, signal: AbortSignal) {
    await freshAccess(signal);
    const p = parseWorkPayment(
      (await apiRequest(`/staff/payments/${id}`, { signal })).data,
    );
    identity(signal);
    if (p.id !== id) throw Error("Payment scope changed");
    return p;
  }
  function notSent() {
    const e = new ApiError(400, { error: { code: "REQUEST_FAILED" } });
    e.message =
      "No payment change was sent. Current access, reviewed payment facts or recovery storage could not be confirmed. Your fields are kept; reload affected fields before reviewing again.";
    return e;
  }
  function review(offer: MutationProposal, resume = false) {
    const change = offer.paymentChange;
    if (
      change?.operation === "refund" &&
      pending &&
      pending !== "unknown" &&
      pending.operation === "refund" &&
      pending.paymentId === change.payment.id &&
      pending.attemptId === change.attemptId
    )
      resume = true;
    if (
      !change ||
      proposal ||
      busy ||
      error ||
      protectedUnavailable ||
      query.invalid ||
      (!resume && pending) ||
      (resume && (!pending || pending === "unknown" || pending.operation !== "refund"))
    )
      return;
    if (
      !resume &&
      (selected !== change.payment.id || selectedAttempt !== change.attemptId)
    )
      return;
    const before = change.payment,
      snapshot = paymentSnapshot(before),
      url = window.location.href;
    let sent = false,
      marker: Exclude<PaymentPending, "unknown"> | undefined;
    const wrapped: MutationProposal = {
      ...offer,
      retrySafely: false,
      retryAfterRejection: false,
      onUncertain: () => {
        if (sent && active.current) {
          focusResult.current = "payment-recovery";
          setPending(readPaymentPending(owner, role) ?? "unknown");
          if (change.operation === "refund") setRetained(offer);
        }
      },
      submit: async () => {
        if (request.current || !active.current) throw notSent();
        const c = new AbortController();
        request.current = c;
        try {
          const latest = await fresh(before.id, c.signal),
            a = latest.attempts.find((a) => a.id === change.attemptId);
          if (paymentSnapshot(latest) !== snapshot) {
            setInspected(latest);
            refreshPayments();
            throw notSent();
          }
          if (
            !a ||
            window.location.href !== url ||
            (change.operation === "manual"
              ? a.manualReview?.status !== "PENDING" || !a.manualReview.canReview
              : a.status !== "SUCCESSFUL" || a.verificationStatus !== "VERIFIED")
          )
            throw notSent();
          const fingerprint = await paymentFingerprint(change.body);
          identity(c.signal);
          if (resume) {
            const stored = readPaymentPending(owner, role);
            if (
              !stored ||
              stored === "unknown" ||
              stored.operation !== "refund" ||
              stored.paymentId !== before.id ||
              stored.attemptId !== change.attemptId ||
              stored.fingerprint !== fingerprint ||
              stored.requestKey !==
                (change.operation === "refund" ? change.requestKey : undefined)
            )
              throw notSent();
            marker = stored;
          } else
            marker = markPaymentPending(owner, role, {
              paymentId: before.id,
              attemptId: change.attemptId,
              operation: change.operation,
              fingerprint,
              ...(change.operation === "refund" ? { requestKey: change.requestKey } : {}),
            });
          setPending(marker);
          sent = true;
          const result = await apiRequest(
            change.operation === "manual"
              ? `/staff/payments/manual-attempts/${change.attemptId}/review`
              : "/staff/payments/refunds",
            {
              method: "POST",
              csrf: true,
              signal: c.signal,
              body: change.body,
              ...(change.operation === "refund"
                ? { idempotencyKey: change.requestKey }
                : {}),
            },
          );
          identity(c.signal);
          if (change.operation === "manual") {
            const updated = validateManualPayment(result.data, change);
            setInspected(updated);
            focusResult.current = "saved-payment-manual";
            setSaved({ payment: updated, attemptId: change.attemptId });
            setMessage(
              "Manual payment decision saved. Review its exact recorded status and note below.",
            );
          } else {
            const confirmed = validatePaymentRefund(result.data, change, owner);
            focusResult.current = "saved-payment-refund";
            setReceipt(confirmed);
            setMessage(
              "Refund request recorded. Review its current status below; requesting a refund does not confirm that money was returned.",
            );
          }
          forgetPaymentDraft(owner, role, change.operation, change.attemptId);
          clearPaymentPending(owner, role, marker.token);
          setPending(undefined);
          setRetained(null);
          setTone("success");
          refreshPayments();
        } catch (e) {
          const submitted = sent;
          if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
          if (sent && e instanceof ApiError && [408, 429].includes(e.status))
            throw Error("Payment outcome needs reconciliation");
          if (
            sent &&
            e instanceof ApiError &&
            e.status >= 400 &&
            e.status < 500 &&
            !resume
          ) {
            clearPaymentPending(owner, role, marker!.token);
            setPending(undefined);
            sent = false;
          }
          if (!sent) {
            if (active.current) setPending(readPaymentPending(owner, role));
            if (submitted) throw e;
            throw notSent();
          }
          throw e;
        } finally {
          request.current = null;
        }
      },
    };
    setMessage(undefined);
    setProposal(wrapped);
  }
  async function loadCurrent() {
    if (request.current || proposal) return;
    const id = pending && pending !== "unknown" ? pending.paymentId : selected;
    if (!id) {
      setTone("error");
      setMessage(
        "Select the relevant payment attempt before loading its current record.",
      );
      return;
    }
    const c = new AbortController();
    request.current = c;
    setChecking(true);
    setMessage(undefined);
    setTone("info");
    try {
      const row = await fresh(id, c.signal);
      if (
        pending &&
        pending !== "unknown" &&
        !row.attempts.some((a) => a.id === pending.attemptId)
      )
        throw Error("The pending payment attempt could not be confirmed");
      focusResult.current = `payment-${row.id}`;
      setInspected(row);
      if (pending && pending !== "unknown" && pending.operation === "manual") {
        forgetPaymentDraft(owner, role, "manual", pending.attemptId);
        clearPaymentPending(owner, role, pending.token);
        setPending(undefined);
        setGeneration((n) => n + 1);
      }
      setMessage(
        "Current payment loaded. No change was resent; this read does not prove the original request outcome. Affected manual-decision fields were replaced only after reconciliation.",
      );
      refreshPayments();
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
      if (active.current) {
        setTone("error");
        setMessage(
          "The current payment could not be confirmed. Check access and the selected reference, then try again. No change was resent.",
        );
      }
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  async function recoverRefund() {
    if (
      request.current ||
      proposal ||
      !pending ||
      pending === "unknown" ||
      pending.operation !== "refund"
    )
      return;
    const original = pending,
      c = new AbortController();
    request.current = c;
    setChecking(true);
    setMessage(undefined);
    setTone("info");
    try {
      const row = await fresh(original.paymentId, c.signal),
        response = await apiRequest(
          `/staff/payments/refunds/original-request?paymentAttemptId=${original.attemptId}`,
          { signal: c.signal, idempotencyKey: original.requestKey },
        ),
        data = z.object({ found: z.boolean(), refund: z.unknown() }).parse(response.data);
      identity(c.signal);
      if (!row.attempts.some((a) => a.id === original.attemptId))
        throw Error("Original payment scope changed");
      setInspected(row);
      if (!data.found) {
        if (data.refund !== null) throw Error("Unconfirmed original refund");
        setMessage(
          "No original refund is visible yet. This does not prove the request failed. The lock remains; check again or review the retained exact original request if available. No request was resent.",
        );
        return;
      }
      const r = parsePaymentRefund(data.refund),
        fingerprint = await paymentFingerprint({
          paymentAttemptId: r.paymentAttemptId,
          amountKobo: r.amountKobo,
          reason: r.reason,
        });
      identity(c.signal);
      if (
        r.paymentAttemptId !== original.attemptId ||
        r.requestedByUserId !== owner ||
        fingerprint !== original.fingerprint
      )
        throw Error("Original refund scope changed");
      forgetPaymentDraft(owner, role, "refund", original.attemptId);
      clearPaymentPending(owner, role, original.token);
      setPending(undefined);
      setRetained(null);
      focusResult.current = "saved-payment-refund";
      setReceipt(r);
      setGeneration((n) => n + 1);
      setTone("success");
      setMessage(
        "Original refund request located with its exact actor, attempt, amount and reason. No request was resent. Its current status is shown below.",
      );
      refreshPayments();
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
      if (active.current) {
        setTone("error");
        setMessage(
          "The original refund request could not be confirmed. Its lock remains. Check access and try again; no request was resent.",
        );
      }
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  async function restoreQueue() {
    if (request.current || proposal) return;
    const c = new AbortController();
    request.current = c;
    setChecking(true);
    try {
      await freshAccess(c.signal);
      setUnavailable(false);
      refreshPayments();
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
      setTone("error");
      setMessage("Payment access could not be confirmed. No change was sent.");
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  async function acknowledgeReconciliation() {
    if (
      !acknowledged ||
      pending !== "unknown" ||
      request.current ||
      proposal ||
      !selected ||
      !selectedAttempt
    )
      return;
    const c = new AbortController();
    request.current = c;
    setChecking(true);
    try {
      const row = await fresh(selected, c.signal);
      if (!row.attempts.some((a) => a.id === selectedAttempt))
        throw Error("Select the relevant attempt");
      forgetPaymentDraft(owner, role, "manual", selectedAttempt);
      forgetPaymentDraft(owner, role, "refund", selectedAttempt);
      clearPaymentPending(owner, role);
      setPending(undefined);
      setRetained(null);
      focusResult.current = `payment-${row.id}`;
      setInspected(row);
      setGeneration((n) => n + 1);
      setAcknowledged(false);
      setTone("info");
      setMessage(
        "Your manual reconciliation was acknowledged. Current payment facts were loaded; the original request outcome was not automatically proven. No change was resent.",
      );
      refreshPayments();
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
      setTone("error");
      setMessage(
        "Manual reconciliation could not be completed. Select the relevant payment attempt and verify access.",
      );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  const navigationDisabled = busy || !!proposal || !!error || protectedUnavailable;
  return (
    <div
      className="work-inspections work-payments"
      data-payment-owner={`${owner}:${role}`}
    >
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Payment records</span>
          </li>
        </ol>
      </nav>
      <header className="wi-header">
        <div>
          <h1>Payment records</h1>
          <p>Review payment attempts, manual evidence and refund requests.</p>
        </div>
        <div className="wp-actions">
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={refreshAccess}
          >
            Refresh payment access
          </button>
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() =>
              protectedUnavailable ? void restoreQueue() : refreshPayments()
            }
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh payment records
          </button>
          <Link className="button secondary" href="/admin/refunds">
            Review refund requests
          </Link>
        </div>
      </header>
      <Feedback message={message} tone={tone} />
      {pending && !protectedUnavailable && (
        <section className="wi-state wp-recovery" aria-labelledby="payment-recovery">
          <h2 id="payment-recovery" tabIndex={-1}>
            A payment change needs reconciliation
          </h2>
          {pending !== "unknown" ? (
            <>
              <p>
                Payment reference: {pending.paymentId} · Attempt reference:{" "}
                {pending.attemptId}
              </p>
              {pending.operation === "refund" ? (
                <>
                  <p>
                    Check the original refund request without resubmitting. An absent
                    result does not prove failure. Its exact original reference is
                    retained through reload.
                  </p>
                  <div className="wp-actions">
                    <button
                      className="button secondary"
                      disabled={busy || !!proposal}
                      onClick={() => void recoverRefund()}
                    >
                      Check original refund request
                    </button>
                    {retained && (
                      <button
                        className="button secondary"
                        disabled={busy || !!proposal || !!error}
                        onClick={() => review(retained, true)}
                      >
                        Review retained refund request
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Load current payment facts before another manual decision. This
                    replaces this attempt&apos;s unsaved decision fields without resending
                    or proving the original outcome.
                  </p>
                  <button
                    className="button secondary"
                    disabled={busy || !!proposal}
                    onClick={() => void loadCurrent()}
                  >
                    Load current payment
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p>
                The stored operation reference is unavailable. Reconcile every pending
                payment decision and refund request in the payment records and refund
                queue before unlocking. Current payment facts alone cannot prove a refund
                outcome.
              </p>
              <Link className="text-link" href="/admin/refunds">
                Open refund requests for reconciliation
              </Link>
              <label className="wp-ack">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  disabled={busy || !!proposal}
                />
                I have independently reconciled every pending payment change and selected
                the relevant payment attempt.
              </label>
              <button
                className="button secondary"
                disabled={!acknowledged || !selectedAttempt || busy || !!proposal}
                onClick={() => void acknowledgeReconciliation()}
              >
                Confirm manual reconciliation
              </button>
            </>
          )}
        </section>
      )}
      <PaymentFilters
        key={`${query.params.get("status")}:${query.params.get("provider")}:${query.params.get("customerId")}`}
        params={query.params}
        disabled={busy || !!proposal}
        navigate={navigate}
      />
      {saved && !protectedUnavailable && (
        <section className="wi-card wp-confirmed">
          <h2 id="saved-payment-manual" tabIndex={-1}>
            Last confirmed manual decision
          </h2>
          <p>
            {saved.payment.paymentNumber} · {paymentStatusLabels[saved.payment.status]}
          </p>
          {saved.payment.attempts
            .filter((a) => a.id === saved.attemptId && a.manualReview?.reviewedAt)
            .map((a) => (
              <div key={a.id}>
                <p>
                  Attempt reference: {a.id} · {a.manualReview!.status}
                </p>
                <p className="preserve-lines">
                  Reviewer note: {a.manualReview!.reviewerNote ?? "Not recorded"}
                </p>
                <p>{formatStockInstant(a.manualReview!.reviewedAt)}</p>
              </div>
            ))}
          <button className="button secondary" onClick={() => setSaved(undefined)}>
            Dismiss saved decision
          </button>
        </section>
      )}
      {receipt && !protectedUnavailable && (
        <section className="wi-card wp-confirmed" aria-labelledby="saved-payment-refund">
          <h2 id="saved-payment-refund" tabIndex={-1}>
            Refund request {receipt.refundNumber}
          </h2>
          <dl className="wp-facts">
            <Fact label="Refund reference" value={receipt.id} />
            <Fact label="Attempt reference" value={receipt.paymentAttemptId} />
            <Fact label="Requested amount" value={formatKobo(receipt.amountKobo)} />
            <Fact label="Current status" value={receipt.status.replaceAll("_", " ")} />
            <Fact label="Reason" value={receipt.reason} />
            <Fact label="Requested" value={formatStockInstant(receipt.requestedAt)} />
          </dl>
          <p>{refundMessages[receipt.status]}</p>
          <Link className="text-link" href="/admin/refunds">
            Review refund requests
          </Link>
          <button
            className="button secondary"
            disabled={busy || !!proposal || !!pending}
            onClick={() => {
              setReceipt(undefined);
              setGeneration((n) => n + 1);
            }}
          >
            Prepare a separate refund request
          </button>
        </section>
      )}
      {query.invalid ? (
        <section className="wi-state">
          <h2>Payment filters unavailable</h2>
          <p>This link contains unsupported or invalid payment filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Reset payment filters
          </button>
        </section>
      ) : protectedUnavailable ? (
        <section className="wi-state">
          <h2>Payment records unavailable</h2>
          <Feedback message="Payment access could not be confirmed. Protected records and forms have been cleared." />
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void restoreQueue()}
          >
            Check payment access and reload
          </button>
        </section>
      ) : (
        <>
          {error && (
            <section className="wi-state">
              <Feedback message={error} />
              {rows?.length ? (
                <p>
                  Previously loaded payment facts are retained. Changes and paging remain
                  disabled until the current page loads.
                </p>
              ) : null}
              <button
                className="button secondary"
                disabled={busy || !!proposal}
                onClick={refreshPayments}
              >
                Retry payment records
              </button>
            </section>
          )}
          {busy && <p role="status">Checking current payment records…</p>}
          <div className="wp-page">
            <h2>Submitted payment records</h2>
            <p>
              {rows
                ? `${rows.length} payments on this page · Newest first`
                : "Current page not loaded"}
            </p>
          </div>
          {!busy && !error && !rows?.length && (
            <section className="wi-state">
              <h2>No payments match this page and filters</h2>
              <p>Change supported filters or return to the first page.</p>
              <button
                className="button secondary"
                onClick={() => navigate(new URLSearchParams())}
              >
                Clear payment filters
              </button>
            </section>
          )}
          {selected && (
            <section className="wp-current" aria-label="Selected payment record">
              <h2>Selected payment</h2>
              <p>This record is loaded independently of the list filters.</p>
              <button
                className="button secondary"
                disabled={navigationDisabled}
                onClick={() => {
                  const next = new URLSearchParams(query.params);
                  next.delete("selected");
                  next.delete("attempt");
                  navigate(next);
                }}
              >
                Close selected payment
              </button>
              <Feedback
                message={
                  selectedRecord.error ||
                  selectedRecord.refreshError ||
                  (selectionMismatch
                    ? "The returned payment does not match the selected record. Refresh to try again."
                    : undefined)
                }
              />
              {(selectedRecord.loading || selectedRecord.refreshing) && (
                <p role="status">Checking selected payment...</p>
              )}
              {!selectedRecord.loading &&
                !selectedRecord.refreshing &&
                !selectedRecord.error &&
                !selectedRecord.refreshError &&
                !selectionMismatch &&
                selectedPayment && (
                  <>
                    <NotificationRecordContext
                      resourceType="PAYMENT"
                      resourceId={selectedPayment.id}
                      targetElementId={selectedElementId}
                    />
                    {!selectedInList && (
                      <PaymentCard
                        recordElementId={selectedElementId}
                        highlighted
                        payment={selectedPayment}
                        selected={selectedAttempt}
                        disabled={disabled}
                        navigationDisabled={navigationDisabled}
                        generation={generation}
                        receiptAttempt={receipt?.paymentAttemptId}
                        recovery={
                          pending &&
                          pending !== "unknown" &&
                          pending.operation === "refund" &&
                          pending.paymentId === selectedPayment.id
                            ? pending
                            : undefined
                        }
                        recoveryDisabled={
                          busy || !!error || protectedUnavailable || query.invalid
                        }
                        choose={(attemptId) => choose(selected, attemptId)}
                        review={review}
                        denyAccess={deny}
                      />
                    )}
                  </>
                )}
            </section>
          )}
          <div className="wp-records">
            {rows?.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={
                  payment.id === selected && selectedPayment ? selectedPayment : payment
                }
                selected={selected === payment.id ? selectedAttempt : null}
                highlighted={payment.id === selected && selectedReady}
                disabled={disabled || (payment.id === selected && !selectedReady)}
                navigationDisabled={navigationDisabled}
                generation={generation}
                receiptAttempt={receipt?.paymentAttemptId}
                recovery={
                  pending &&
                  pending !== "unknown" &&
                  pending.operation === "refund" &&
                  pending.paymentId === payment.id
                    ? pending
                    : undefined
                }
                recoveryDisabled={
                  busy || !!error || protectedUnavailable || query.invalid
                }
                choose={(id) => choose(payment.id, id)}
                review={review}
                denyAccess={deny}
              />
            ))}
          </div>
          <nav className="wp-pagination" aria-label="Staff payments pages">
            <button
              className="button secondary"
              disabled={navigationDisabled || !query.params.has("cursor")}
              onClick={() => navigate(paymentPageParams(query.params, undefined, true))}
            >
              Previous
            </button>
            <button
              className="button secondary"
              disabled={navigationDisabled || !query.params.has("cursor")}
              onClick={() => {
                const p = new URLSearchParams(query.params);
                p.delete("cursor");
                p.delete("_trail");
                navigate(p);
              }}
            >
              First page
            </button>
            <button
              className="button secondary"
              disabled={navigationDisabled || !records.data?.nextCursor}
              onClick={() =>
                navigate(paymentPageParams(query.params, records.data?.nextCursor))
              }
            >
              Next
            </button>
          </nav>
          {inspected &&
            inspected.id !== selected &&
            !rows?.some((r) => r.id === inspected.id) && (
              <section className="wp-current">
                <h2>Current payment outside this page</h2>
                <p>
                  This current read is independent of the selected collection filters.
                </p>
                <PaymentCard
                  payment={inspected}
                  disabled
                  navigationDisabled
                  selected={
                    pending && pending !== "unknown" && pending.operation === "refund"
                      ? pending.attemptId
                      : null
                  }
                  recovery={
                    pending &&
                    pending !== "unknown" &&
                    pending.operation === "refund" &&
                    pending.paymentId === inspected.id
                      ? pending
                      : undefined
                  }
                  recoveryDisabled={
                    busy || !!error || protectedUnavailable || query.invalid
                  }
                  generation={generation}
                  choose={() => {}}
                  review={review}
                  denyAccess={deny}
                />
              </section>
            )}
        </>
      )}
      {proposal && !protectedUnavailable && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function PaymentCard({
  highlighted = false,
  recordElementId,
  payment: p,
  selected,
  disabled,
  navigationDisabled,
  generation,
  receiptAttempt,
  recovery,
  recoveryDisabled = true,
  denyAccess,
  choose,
  review,
}: {
  highlighted?: boolean;
  recordElementId?: string;
  payment: WorkPayment;
  selected: string | null;
  disabled: boolean;
  navigationDisabled: boolean;
  generation: number;
  receiptAttempt?: string;
  recovery?: Exclude<PaymentPending, "unknown">;
  recoveryDisabled?: boolean;
  denyAccess?: () => void;
  choose: (id: string) => void;
  review: (offer: MutationProposal) => void;
}) {
  return (
    <section
      id={recordElementId ?? `payment-record-${p.id}`}
      tabIndex={-1}
      data-selected={highlighted || undefined}
      className="wi-card wp-payment"
      aria-labelledby={`payment-${p.id}`}
    >
      <header className="wp-record-header">
        <div>
          <h2 id={`payment-${p.id}`} tabIndex={-1}>
            {p.paymentNumber}
          </h2>
          <span className={`wp-status ${p.status.toLowerCase()}`} data-status={p.status}>
            {paymentStatusLabels[p.status]}
          </span>
        </div>
        <div className="wp-amount">
          <strong>{formatKobo(p.amountKobo)}</strong>
          <span>{paymentPurposeLabels[p.purpose]}</span>
        </div>
      </header>
      <dl className="wp-facts wp-payment-facts">
        <Fact label="Payment reference" value={p.id} />
        <Fact label="Created" value={formatStockInstant(p.createdAt)} />
        <Fact label="Updated" value={formatStockInstant(p.updatedAt)} />
        {p.expiresAt && <Fact label="Deadline" value={formatStockInstant(p.expiresAt)} />}
        {p.succeededAt && (
          <Fact label="Succeeded" value={formatStockInstant(p.succeededAt)} />
        )}
        {p.cancelledAt && (
          <Fact label="Cancelled" value={formatStockInstant(p.cancelledAt)} />
        )}
        {p.expiredAt && <Fact label="Expired" value={formatStockInstant(p.expiredAt)} />}
        {[
          { label: "Order reference", value: p.orderId, path: "orders" },
          { label: "Invoice reference", value: p.invoiceId, path: "invoices" },
          { label: "Booking reference", value: p.bookingId, path: "bookings" },
          {
            label: "Vehicle purchase reference",
            value: p.vehicleTransactionId,
            path: "vehicle-sales",
          },
        ].flatMap((f) =>
          f.value
            ? [
                <Fact
                  key={f.label}
                  label={f.label}
                  value={
                    <Link className="text-link" href={`/admin/${f.path}/${f.value}`}>
                      {f.value}
                    </Link>
                  }
                />,
              ]
            : [],
        )}
      </dl>
      {!p.attempts.length && <p>No payment attempts have been recorded.</p>}
      <div className="wp-attempts">
        {p.attempts.map((a) => {
          const editable =
              !!a.manualReview?.canReview && a.manualReview.status === "PENDING",
            refundable = a.status === "SUCCESSFUL" && a.verificationStatus === "VERIFIED",
            expanded = selected === a.id;
          return (
            <section
              className="wp-attempt"
              key={a.id}
              aria-labelledby={`attempt-${a.id}`}
            >
              <header className="wp-attempt-header">
                <div>
                  <h3 id={`attempt-${a.id}`}>
                    Attempt {a.attemptNumber} ·{" "}
                    {a.provider === "MANUAL"
                      ? "Manual"
                      : a.provider === "PAYSTACK"
                        ? "Paystack"
                        : "Monnify"}{" "}
                    ·{" "}
                    {a.method?.replaceAll("_", " ").toLowerCase() ??
                      "Method not recorded"}
                  </h3>
                  <p>
                    {formatKobo(a.amountKobo)}{" "}
                    <span className="wp-status" data-status={a.status}>
                      {a.status.replaceAll("_", " ")}
                    </span>{" "}
                    <span className="wp-status" data-status={a.verificationStatus}>
                      {a.verificationStatus.replaceAll("_", " ")}
                    </span>
                  </p>
                </div>
                {(editable || refundable) && (
                  <button
                    className="button secondary"
                    disabled={navigationDisabled}
                    onClick={() => choose(a.id)}
                    aria-expanded={expanded}
                    aria-controls={`payment-workspace-${a.id}`}
                  >
                    {expanded
                      ? "Hide payment actions"
                      : editable
                        ? "Review manual payment"
                        : "Request a refund for this attempt"}
                  </button>
                )}
              </header>
              <div className={`wp-attempt-body${expanded ? " expanded" : ""}`}>
                <div className="wp-evidence">
                  <dl className="wp-facts">
                    <Fact label="Attempt reference" value={a.id} />
                    <Fact label="Started" value={formatStockInstant(a.initiatedAt)} />
                    {a.paidAt && (
                      <Fact label="Paid" value={formatStockInstant(a.paidAt)} />
                    )}
                    {a.verifiedAt && (
                      <Fact label="Verified" value={formatStockInstant(a.verifiedAt)} />
                    )}
                  </dl>
                  {a.manualReview && (
                    <>
                      <h3>Manual payment evidence</h3>
                      <dl className="wp-facts">
                        <Fact label="Manual review" value={a.manualReview.status} />
                        <Fact
                          label="Payer"
                          value={a.manualReview.payerName ?? "Not recorded"}
                        />
                        <Fact
                          label="Bank reference"
                          value={a.manualReview.bankReference ?? "Not recorded"}
                        />
                        <Fact
                          label="Reported transfer"
                          value={formatStockInstant(a.manualReview.transferredAt)}
                        />
                        <Fact
                          label="Submitted"
                          value={formatStockInstant(a.manualReview.submittedAt)}
                        />
                        {a.manualReview.reviewedAt && (
                          <Fact
                            label="Reviewed"
                            value={formatStockInstant(a.manualReview.reviewedAt)}
                          />
                        )}
                        {a.manualReview.reviewerNote !== null && (
                          <Fact
                            label="Recorded reviewer note"
                            value={a.manualReview.reviewerNote}
                          />
                        )}
                      </dl>
                      {a.manualReview.evidenceSha256 ? (
                        <PrivateDocumentAccess
                          key={`${a.id}:${disabled}`}
                          path={`/staff/payments/manual-attempts/${a.id}/evidence-access`}
                          label="payment evidence"
                          onDenied={denyAccess}
                          disabled={disabled}
                        />
                      ) : (
                        <p className="wp-help">No evidence attachment is recorded.</p>
                      )}
                      {a.manualReview.status === "PENDING" &&
                        !a.manualReview.canReview && (
                          <p className="wp-help">
                            A different administrator must decide this submission.
                          </p>
                        )}
                    </>
                  )}
                </div>
                {expanded && (
                  <div
                    id={`payment-workspace-${a.id}`}
                    className="wp-editor"
                    key={`${a.id}:${generation}`}
                  >
                    {editable ? (
                      <ManualDecisionForm
                        payment={p}
                        attempt={a}
                        disabled={disabled}
                        onReview={review}
                      />
                    ) : refundable ? (
                      receiptAttempt === a.id ? (
                        <p role="status">
                          A refund request for this attempt is recorded above. Review it
                          before preparing a separate request.
                        </p>
                      ) : (
                        <PaymentRefundForm
                          payment={p}
                          attempt={a}
                          disabled={
                            recovery?.attemptId === a.id ? recoveryDisabled : disabled
                          }
                          recoveryKey={
                            recovery?.attemptId === a.id ? recovery.requestKey : undefined
                          }
                          onReview={review}
                        />
                      )
                    ) : (
                      <p>This attempt has no available payment action.</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
function PaymentFilters({
  params,
  disabled,
  navigate,
}: {
  params: URLSearchParams;
  disabled: boolean;
  navigate: (params: URLSearchParams) => void;
}) {
  const [status, setStatus] = useState(params.get("status") ?? ""),
    [provider, setProvider] = useState(params.get("provider") ?? ""),
    [customer, setCustomer] = useState(params.get("customerId") ?? ""),
    [error, setError] = useState<string>();
  return (
    <form
      className="wi-filters wp-filters"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        if (customer && !z.uuid().safeParse(customer.trim()).success) {
          setError("Enter a valid customer profile reference.");
          document.getElementById("payment-customer-filter")?.focus();
          return;
        }
        setError(undefined);
        const p = new URLSearchParams();
        if (status) p.set("status", status);
        if (provider) p.set("provider", provider);
        if (customer.trim()) p.set("customerId", customer.trim());
        navigate(p);
      }}
    >
      <fieldset disabled={disabled} aria-label="Filter payment records">
        <div className="field">
          <label htmlFor="payment-status-filter">Payment status</label>
          <select
            id="payment-status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(paymentStatusLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payment-provider-filter">Payment provider filter</label>
          <select
            id="payment-provider-filter"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="">All providers</option>
            {["PAYSTACK", "MONNIFY", "MANUAL"].map((v) => (
              <option key={v} value={v}>
                {v === "PAYSTACK" ? "Paystack" : v === "MONNIFY" ? "Monnify" : "Manual"}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="payment-customer-filter">
            Customer profile reference (optional)
          </label>
          <input
            id="payment-customer-filter"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            autoComplete="off"
            maxLength={36}
            aria-invalid={!!error}
            aria-describedby={error ? "payment-customer-error" : undefined}
          />
          {error && (
            <p id="payment-customer-error" className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="wp-actions">
          <button className="button">Apply payment filters</button>
          <button
            type="button"
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear payment filters
          </button>
        </div>
      </fieldset>
      <p className="field-hint">
        Provider matches payments with any attempt from that provider; all attempts remain
        visible. Reads are recorded in the audit log.
      </p>
    </form>
  );
}
