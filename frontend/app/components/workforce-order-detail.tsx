"use client";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import {
  ordersHref,
  orderRevision,
  orderStatusLabels,
  fulfillmentLabels,
  parseWorkforceOrder,
  validateOrderReceipt,
  type OrderChange,
  type WorkforceOrder,
} from "@/lib/admin/workforce-orders";
import {
  clearWorkforceOrderPending,
  markWorkforceOrderPending,
  readWorkforceOrderPending,
  type WorkforceOrderPending,
} from "@/lib/admin/workforce-order-pending";
import { formatBusinessDate } from "@/lib/format/date";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";

type Draft = {
  base: WorkforceOrder;
  body: string;
};
const newDraft = (base: WorkforceOrder): Draft => ({ base, body: "" });
function rejection(message: string) {
  const error = new ApiError(409, { error: { code: "CONFLICT" } });
  error.message = message;
  return error;
}
export function WorkforceOrderDetail({
  id,
  access,
  close,
  refresh,
  refreshKey,
  enabled,
  denied,
}: {
  id: string;
  access: WorkforceAccess;
  close: () => void;
  refresh: () => void;
  refreshKey: number;
  enabled: boolean;
  denied: boolean;
}) {
  const record = useResource(
    denied ? null : `/staff/workforce/orders/${id}`,
    parseWorkforceOrder,
    undefined,
    { refreshKey },
  );
  const [draft, setDraft] = useState<Draft>();
  const [pending, setPending] = useState<WorkforceOrderPending>();
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
    (orderRevision(row) !== orderRevision(draft.base) ||
      !sameWorkforceScope(access, draft.base.access));
  const blocked = !row || !storageReady || !!pending || !!proposal || stale || recovering;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setPending(readWorkforceOrderPending(access.userId));
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
      setPending(readWorkforceOrderPending(access.userId));
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
      apiRequest(`/staff/workforce/orders/${id}`),
    ]);
    const own = parseWorkforceAccess(ownResult.data),
      latest = parseWorkforceOrder(detailResult.data);
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
    if (!row || !draft || blocked || !row.availableNextStates.length) return;
    const base = row,
      body = draft.body.trim();
    if (body.length < 10 || body.length > 1000) {
      setInvalidField("body");
      setError("Enter a preparation note between 10 and 1,000 characters.");
      document.getElementById("wfc-body")?.focus();
      return;
    }
    const change: OrderChange = {
      action: "prepare",
      body: {
        expectedVersion: base.version,
        status: base.availableNextStates[0],
        reason: body,
      },
    };
    setError(undefined);
    setInvalidField(undefined);
    setMessage(undefined);
    setProposal({
      title: "Save this preparation update?",
      description:
        "Review the exact state and note. Current responsibilities and the latest order will be checked before saving.",
      facts: [
        { label: "Order", value: base.orderNumber },
        { label: "Current state", value: orderStatusLabels[base.status] },
        { label: "Next state", value: orderStatusLabels[change.body.status] },
        { label: "Preparation note", value: body },
      ],
      retryAfterRejection: false,
      submit: async () => {
        let sent = false,
          token: string | undefined;
        try {
          const latest = await current();
          if (
            orderRevision(latest) !== orderRevision(base) ||
            !latest.availableNextStates.includes(change.body.status)
          )
            throw rejection(
              "The order changed. Close this review, refresh and review your retained draft.",
            );
          const marker = await markWorkforceOrderPending(
            access.userId,
            { id, action: "prepare", version: base.version },
            change.body,
          );
          token = marker.token;
          setPending(marker);
          sent = true;
          const result = await apiRequest(`/staff/workforce/orders/${id}`, {
            method: "PATCH",
            csrf: true,
            body: change.body,
          });
          const receipt = validateOrderReceipt(result.data, base, change);
          confirmedVersion.current = receipt.version;
          clearWorkforceOrderPending(access.userId, token);
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
            throw Error("The preparation outcome could not be confirmed.");
          if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
            try {
              clearWorkforceOrderPending(access.userId, token);
            } finally {
              setPending(readWorkforceOrderPending(access.userId));
            }
          }
          throw caught;
        }
      },
      onUncertain: () =>
        setPending(readWorkforceOrderPending(access.userId) ?? "unknown"),
    });
  }
  async function reconcile(clear: boolean) {
    setRecovering(true);
    setError(undefined);
    try {
      const marker = readWorkforceOrderPending(access.userId);
      if (!marker || JSON.stringify(marker) !== JSON.stringify(pending))
        throw Error("The pending change changed. Reload before continuing.");
      if (marker !== "unknown" && marker.id !== id)
        throw Error("Open the order with the pending change first.");
      const latest = await current(),
        fingerprint = JSON.stringify(marker) + orderRevision(latest);
      if (clear) {
        if (!independent || inspection !== fingerprint)
          throw Error(
            "Inspect the latest order and independently reconcile the earlier change first.",
          );
        clearWorkforceOrderPending(
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
  const errorId = error ? "wfc-action-error" : undefined;
  return (
    <section className="wfc-detail" aria-label="Selected order" aria-busy={busy}>
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
          <h2 id="wfc-recovery-title">Review an earlier order change</h2>
          <p>
            The result could not be confirmed. Refreshing does not clear this lock.
            Current order data alone cannot prove whether the original request succeeded;
            no change will be resent automatically.
          </p>
          {pending !== "unknown" && pending.id !== id ? (
            <Link
              className="button secondary"
              href={ordersHref(new URLSearchParams({ selected: pending.id }))}
            >
              Open pending order
            </Link>
          ) : (
            <>
              <button
                className="button secondary"
                disabled={recovering || !!proposal || !row}
                onClick={() => void reconcile(false)}
              >
                Inspect current order
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
              ? "Order access unavailable"
              : "Order could not be verified"}
          </h2>
          <p>Refresh orders to check the current order and your access.</p>
          <button className="button secondary" onClick={refresh}>
            Check order again
          </button>
          <button className="button secondary" onClick={close}>
            Close selection
          </button>
        </div>
      )}
      {(busy || !enabled) && !denied && (
        <p className="wfc-state" role="status">
          Checking the selected order…
        </p>
      )}
      {row && (
        <>
          <header className="wfc-detail-heading">
            <div>
              <h2 ref={title} tabIndex={-1}>
                {row.orderNumber}
              </h2>
              <p>
                <span
                  className={`wfc-status is-${row.status.toLowerCase()}`}
                  data-status={row.status}
                >
                  {orderStatusLabels[row.status]}
                </span>
              </p>
            </div>
            <button className="button secondary" onClick={close}>
              Close selection
            </button>
          </header>
          <WorkflowProgress workflow="order" status={row.status} />
          <dl className="wfc-facts">
            <div>
              <dt>Branch</dt>
              <dd>{row.branch?.name ?? "Branch not recorded"}</dd>
            </div>
            <div>
              <dt>Fulfillment</dt>
              <dd>{fulfillmentLabels[row.fulfillmentMethod]}</dd>
            </div>
            <div>
              <dt>Payment recorded</dt>
              <dd>
                {row.paidAt ? (
                  <time dateTime={row.paidAt}>{formatBusinessDate(row.paidAt)}</time>
                ) : (
                  "Not recorded"
                )}
              </dd>
            </div>
          </dl>
          {stale && (
            <section className="wfc-recovery">
              <h3>The order has changed</h3>
              <p>
                Your unsent draft is retained. Review the current order before using it
                with the latest version.
              </p>
              <button
                className="button secondary"
                disabled={!!pending || !!proposal}
                onClick={() => {
                  setDraft((old) => (old ? { ...old, base: row } : newDraft(row)));
                  setError(undefined);
                }}
              >
                Use retained draft with latest order
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
            <div className="wfo-record">
              <section className="wfc-panel" aria-labelledby="wfo-items-title">
                <h3 id="wfo-items-title">Order items</h3>
                <table className="wfo-items">
                  <caption className="sr-only">
                    Ordered product names and quantities
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.items.map((item, index) => (
                      <tr key={index}>
                        <th scope="row">{item.productName}</th>
                        <td>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!row.items.length && <p>No order items were recorded.</p>}
              </section>
              <section className="wfc-panel" aria-labelledby="wfo-progress-title">
                <h3 id="wfo-progress-title">Recorded progress</h3>
                <dl className="wfc-tracking">
                  {(
                    [
                      ["Created", row.createdAt],
                      ["Confirmed", row.confirmedAt],
                      ["Processing", row.processingAt],
                      ["Ready", row.readyAt],
                      ["Completed", row.completedAt],
                      ["Cancelled", row.cancelledAt],
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
              </section>
            </div>
            <section className="wfc-panel" aria-labelledby="wfo-prepare-title">
              <h3 id="wfo-prepare-title">Prepare collection</h3>
              {row.availableNextStates.length ? (
                <>
                  <p>
                    Next state{" "}
                    <strong>{orderStatusLabels[row.availableNextStates[0]]}</strong>
                  </p>
                  <p>
                    Only paid collection orders can advance. Customer release requires
                    separate authority.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      review();
                    }}
                  >
                    <div className="field">
                      <label htmlFor="wfc-body">Preparation note</label>
                      <textarea
                        id="wfc-body"
                        value={draft?.body ?? ""}
                        maxLength={1000}
                        rows={4}
                        readOnly={blocked}
                        onChange={(e) => edit("body", e.target.value)}
                        aria-invalid={invalidField === "body"}
                        aria-describedby={`wfc-body-hint${invalidField === "body" && errorId ? ` ${errorId}` : ""}`}
                      />
                      <small id="wfc-body-hint">
                        10–1,000 characters. {draft?.body.length ?? 0} entered.
                      </small>
                    </div>
                    <button className="button" disabled={blocked || !draft}>
                      Review preparation update
                    </button>
                  </form>
                </>
              ) : (
                <p>
                  {!access.permissions.includes("ORDERS_PREPARE")
                    ? "Your current responsibilities allow you to view this order. Preparation updates require an Operations assignment for this branch."
                    : row.fulfillmentMethod !== "COLLECTION"
                      ? "Delivery orders cannot be prepared through this collection workspace."
                      : !row.paidAt
                        ? "Preparation is unavailable until payment is recorded."
                        : "No preparation update is available for this order in its current state and branch scope."}
                </p>
              )}
            </section>
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
          onSuccess={() => setMessage("The preparation update was recorded.")}
        />
      )}
    </section>
  );
}
