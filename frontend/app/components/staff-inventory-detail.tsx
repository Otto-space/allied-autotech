"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { InventoryReservation } from "@/lib/api/inventory-schemas";
import { workInventorySchema } from "@/lib/admin/work-inventory";
import {
  clearInventoryPending,
  inventoryPendingKey,
  inventorySnapshot,
  parseWorkInventoryHistory,
  parseWorkInventoryReservations,
  readInventoryPending,
  saveInventoryPending,
  validateInventoryResult,
  type InventoryProposal,
} from "@/lib/admin/work-inventory-detail";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { useAccountSession } from "./dashboard-shell";
import { MutationReview } from "./mutation-review";
import {
  InventoryMovementForm,
  InventoryReservationForm,
  ReorderLevelForm,
} from "./inventory-change-forms";
import { InventoryHistory, InventoryReservations } from "./inventory-records";
export function StaffInventoryDetail({ inventoryId }: { inventoryId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  if (!["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Inventory record</h1>
        <Feedback message="Staff access is required to manage inventory." />
      </>
    );
  return (
    <InventoryWorkspace
      key={`${session.user.id}:${session.user.role}:${inventoryId}`}
      inventoryId={inventoryId}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function InventoryWorkspace({
  inventoryId,
  owner,
  role,
}: {
  inventoryId: string;
  owner: string;
  role: string;
}) {
  const parseRecord = useCallback(
    (value: unknown) => {
      const row = workInventorySchema.parse(value);
      if (row.id !== inventoryId) throw Error("Unexpected inventory record");
      return row;
    },
    [inventoryId],
  );
  const inventory = useResource(`/staff/inventory/${inventoryId}`, parseRecord),
    access = useResource("/staff/profile", parseOwnStaffProfile);
  const permission =
    !!access.data &&
    access.data.id === owner &&
    access.data.role === role &&
    access.data.status === "ACTIVE" &&
    (role !== "STAFF" ||
      (!!access.data.staffProfile?.branchId &&
        access.data.staffProfile.branchId === inventory.data?.branch.id &&
        inventory.data.branch.isActive));
  const current = permission ? inventory.data : undefined;
  const key = inventoryPendingKey(owner, inventoryId),
    [pending, setPending] = useState(() => readInventoryPending(key)),
    [proposal, setProposal] = useState<InventoryProposal | null>(null),
    [retry, setRetry] = useState<InventoryProposal | null>(null),
    [reservation, setReservation] = useState<InventoryReservation | null>(null),
    [revision, setRevision] = useState(0),
    [formRevision, setFormRevision] = useState(0),
    [message, setMessage] = useState<string>(),
    [checking, setChecking] = useState(false);
  const active = useRef(true),
    request = useRef<AbortController | null>(null),
    attempted = useRef(false),
    opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const busy =
      inventory.loading || inventory.refreshing || access.loading || access.refreshing,
    error =
      inventory.error || inventory.refreshError || access.error || access.refreshError;
  const disabled = busy || !!error || !permission || !!proposal || pending || checking;
  function refresh() {
    inventory.refresh();
    access.refresh();
    setRevision((value) => value + 1);
  }
  async function fresh(signal: AbortSignal) {
    const [recordResponse, profileResponse] = await Promise.all([
      apiRequest(`/staff/inventory/${inventoryId}`, { signal }),
      apiRequest("/staff/profile", { signal }),
    ]);
    const row = parseRecord(recordResponse.data),
      profile = parseOwnStaffProfile(profileResponse.data);
    if (
      profile.id !== owner ||
      profile.role !== role ||
      profile.status !== "ACTIVE" ||
      (role === "STAFF" &&
        (!row.branch.isActive || profile.staffProfile?.branchId !== row.branch.id))
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    return row;
  }
  function review(value: InventoryProposal) {
    if (disabled || !current) return;
    const original = current;
    let sent = false;
    attempted.current = false;
    setMessage(undefined);
    opener.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const wrapped: InventoryProposal = {
      ...value,
      retryAfterRejection: false,
      onUncertain: () => {
        if (!active.current) return;
        if (sent || readInventoryPending(key)) {
          setPending(true);
          if (sent && value.retrySafely) setRetry(wrapped);
        }
        value.onUncertain?.();
      },
      submit: async () => {
        if (request.current || !active.current || (!sent && readInventoryPending(key)))
          throw Error("Inventory change is blocked");
        const controller = new AbortController();
        request.current = controller;
        const wasRetry = sent;
        let posted = false;
        try {
          const latest = await fresh(controller.signal);
          if (!sent && inventorySnapshot(latest) !== inventorySnapshot(original)) {
            setMessage(
              "The inventory changed during review. Check the refreshed record before proposing another change.",
            );
            refresh();
            throw new ApiError(409, { error: { code: "CONFLICT" } });
          }
          if (!active.current || controller.signal.aborted)
            throw Error("Session changed");
          saveInventoryPending(key);
          sent = true;
          attempted.current = true;
          posted = true;
          const response = await value.submit();
          validateInventoryResult(response, value, original);
          clearInventoryPending(key);
          if (active.current) {
            setPending(false);
            setRetry(null);
          }
        } catch (error) {
          if (posted && error instanceof ApiError && [408, 429].includes(error.status))
            throw new Error(
              "The stock response must be reconciled before another change",
            );
          if (
            active.current &&
            error instanceof ApiError &&
            [401, 403, 404].includes(error.status)
          )
            refresh();
          if (
            posted &&
            !wasRetry &&
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 429].includes(error.status)
          ) {
            clearInventoryPending(key);
            if (active.current) {
              setPending(false);
              setRetry(null);
            }
          }
          throw error;
        } finally {
          if (active.current) request.current = null;
        }
      },
    };
    setProposal(wrapped);
  }
  async function reconcile() {
    if (request.current || checking) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setMessage(undefined);
    try {
      await Promise.all([
        fresh(controller.signal),
        apiRequest(`/staff/inventory/${inventoryId}/history?limit=25`, {
          signal: controller.signal,
        }).then((response) => parseWorkInventoryHistory(response.data)),
        apiRequest(`/staff/inventory/${inventoryId}/reservations?limit=25`, {
          signal: controller.signal,
        }).then((response) => parseWorkInventoryReservations(response.data)),
      ]);
      if (!active.current || controller.signal.aborted) return;
      clearInventoryPending(key);
      setPending(false);
      setRetry(null);
      setReservation(null);
      refresh();
      setMessage(
        "Saved balances, reservations and recent history were reloaded. Review the saved records before another action. Nothing was resent; this does not prove which request changed the stock.",
      );
    } catch (error) {
      if (active.current)
        setMessage(
          error instanceof ApiError
            ? error.message
            : "The saved records could not be checked. The pending change remains locked.",
        );
    } finally {
      if (active.current) {
        request.current = null;
        setChecking(false);
      }
    }
  }
  return (
    <div className="work-services work-inventory-detail">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/admin/inventory">Product inventory</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{current?.product.name ?? "Inventory record"}</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="work-inventory-detail-title" tabIndex={-1}>
            {current?.product.name ?? "Inventory record"}
          </h1>
          {current && (
            <p>
              {current.product.sku} · {current.branch.name}
            </p>
          )}
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/inventory">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to parts inventory
          </Link>
          <button
            className="button secondary"
            disabled={busy || !!proposal || checking}
            onClick={refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh inventory record
          </button>
        </div>
      </header>
      <Feedback message={message} tone="info" />
      {busy && (
        <div className="work-service-state" role="status">
          Checking stock balances…
        </div>
      )}
      {error && (
        <section className="wid-state">
          <h2>Inventory record unavailable</h2>
          <Feedback message={error} />
          {current && (
            <p>
              Previously loaded facts may be out of date. Changes remain blocked until the
              record and current access are refreshed.
            </p>
          )}
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={refresh}
          >
            Retry inventory record
          </button>
        </section>
      )}
      {!busy && !error && !permission && (
        <section className="wid-state">
          <h2>Inventory access unavailable</h2>
          <p>
            Your current staff access and assigned branch must be confirmed before
            managing this record.
          </p>
          <button className="button secondary" onClick={refresh}>
            Retry inventory access
          </button>
        </section>
      )}
      {pending && (
        <section className="wid-pending">
          <h2>Check the saved stock record</h2>
          <p>
            A stock change is still unconfirmed. Other changes remain paused, including
            after reload.
          </p>
          {retry?.retrySafely && (
            <button
              className="button secondary"
              disabled={!!proposal || busy || checking || !permission || !!error}
              onClick={() => setProposal(retry)}
            >
              Resolve pending stock change
            </button>
          )}
          <button
            className="button secondary"
            disabled={!!proposal || busy || checking || !permission || !!error}
            onClick={() => void reconcile()}
          >
            Check saved balances and history
          </button>
          <a href="#inventory-history" className="text-link">
            Review stock history
          </a>
          <p>
            Same-request retry is available only while its original reviewed request
            remains open in this session. Saved-record reconciliation never sends a
            change.
          </p>
        </section>
      )}
      {current && (
        <>
          <section className="wid-summary" aria-label="Stock balances">
            <dl className="totals">
              {(
                [
                  ["On hand", current.quantity],
                  ["Reserved", current.reserved],
                  ["Available", current.available],
                  ["Reorder level", current.reorderLevel],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <dl className="wid-secondary">
              <div>
                <dt>Catalogue price</dt>
                <dd>{formatKobo(current.product.priceKobo)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatBusinessDate(current.updatedAt)}</dd>
              </div>
            </dl>
          </section>
          <p className="wid-guidance">
            Stock movements do not create orders, invoices or payments.
          </p>
          {(!current.branch.isActive ||
            !current.product.isActive ||
            !current.product.category.isActive) && (
            <p className="wid-inactive">
              {!current.branch.isActive ? "Inactive branch. " : ""}
              {!current.product.isActive ? "Inactive part. " : ""}
              {!current.product.category.isActive ? "Inactive category. " : ""}
              {!current.branch.isActive || !current.product.isActive
                ? "New reservations are unavailable. Physical stock movements remain subject to server checks."
                : "Catalogue visibility does not change recorded stock."}
            </p>
          )}
          <div className="wid-actions-grid">
            <InventoryMovementForm
              key={`movement-${formRevision}-${reservation?.id ?? "unreserved"}`}
              inventory={current}
              disabled={disabled}
              onReview={review}
              reservation={reservation}
              onClearReservation={() => setReservation(null)}
            />
            <div className="wid-action-rail">
              {current.branch.isActive && current.product.isActive && (
                <InventoryReservationForm
                  key={`reserve-${formRevision}`}
                  inventory={current}
                  disabled={disabled}
                  onReview={review}
                />
              )}
              <ReorderLevelForm
                key={`reorder-${current.version}`}
                inventory={current}
                disabled={disabled}
                onReview={review}
              />
            </div>
          </div>
          <InventoryReservations
            revision={revision}
            inventoryId={inventoryId}
            disabled={disabled}
            onReview={review}
            onConsume={(value) => {
              if (disabled) return;
              setReservation(value);
              requestAnimationFrame(() => {
                document.getElementById("inventory-movement")?.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? "auto"
                    : "smooth",
                  block: "start",
                });
                document
                  .getElementById("movement-quantity")
                  ?.focus({ preventScroll: true });
              });
            }}
          />
          <InventoryHistory revision={revision} inventoryId={inventoryId} />
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            if (attempted.current) {
              refresh();
              requestAnimationFrame(() =>
                document
                  .getElementById("work-inventory-detail-title")
                  ?.focus({ preventScroll: true }),
              );
            } else requestAnimationFrame(() => opener.current?.focus());
          }}
          onSuccess={() => {
            setPending(false);
            setRetry(null);
            setFormRevision((value) => value + 1);
            setReservation(null);
            setMessage(
              "Inventory change recorded. Review the refreshed balances and history.",
            );
          }}
        />
      )}
    </div>
  );
}
