"use client";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, RefreshCw } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import {
  clearSalePending,
  forgetSaleDrafts,
  markSalePending,
  mergeSaleObservation,
  parseSaleDetail,
  readSalePending,
  saleAtLeast,
  saleChangeSnapshot,
  validateSaleChange,
  type SaleDetail,
  type SalePending,
} from "@/lib/admin/work-vehicle-sale-detail";
import { purchaseLabels } from "@/lib/customer-purchase-query";
import { formatKobo } from "@/lib/format/money";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import {
  VehicleNegotiationForm,
  VehicleSaleStatusForm,
  saleTransitions,
} from "./vehicle-sale-forms";
import { VehicleHandoverCreate, VehicleHandoverRecord } from "./vehicle-handover";
export function WorkVehicleSaleDetail({ transactionId }: { transactionId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  return ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <SaleAccess
      key={`${session.user.id}:${session.user.role}:${transactionId}`}
      id={transactionId}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <Feedback message="Staff access is required to view this purchase." />
  );
}
function SaleAccess({ id, owner, role }: { id: string; owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    profile = access.data,
    error =
      access.error ||
      access.refreshError ||
      (profile &&
      (profile.id !== owner ||
        profile.role !== role ||
        profile.status !== "ACTIVE" ||
        (role === "STAFF" && !profile.staffProfile?.branchId))
        ? "Current purchase access and branch assignment could not be confirmed."
        : undefined);
  if (!profile || error)
    return (
      <div className="work-inspections work-sale-detail">
        <h1>Vehicle purchase</h1>
        {error ? (
          <>
            <Feedback message={error} />
            <button
              className="button secondary"
              disabled={access.loading || access.refreshing}
              onClick={access.refresh}
            >
              Retry purchase access
            </button>
          </>
        ) : (
          <p role="status">Checking purchase access…</p>
        )}
      </div>
    );
  return (
    <SaleWorkspace
      key={`${id}:${role === "STAFF" ? profile.staffProfile?.branchId : "all"}`}
      id={id}
      owner={owner}
      role={role}
      branchId={role === "STAFF" ? profile.staffProfile?.branchId : undefined}
      refreshAccess={access.refresh}
    />
  );
}
function SaleWorkspace({
  id,
  owner,
  role,
  branchId,
  refreshAccess,
}: {
  id: string;
  owner: string;
  role: string;
  branchId?: string | null;
  refreshAccess: () => void;
}) {
  const seen = useRef<SaleDetail | undefined>(undefined),
    active = useRef(true),
    request = useRef<AbortController | null>(null);
  const [observed, setObserved] = useState<SaleDetail>(),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [pending, setPending] = useState<SalePending | undefined>(() =>
      readSalePending(owner, role, id),
    ),
    [message, setMessage] = useState<string>(),
    [tone, setTone] = useState<"error" | "success">("error"),
    [checking, setChecking] = useState(false),
    [unavailable, setUnavailable] = useState(false),
    [generation, setGeneration] = useState(0);
  const parse = useCallback(
    (value: unknown) => {
      const row = parseSaleDetail(value, id, role, branchId);
      if (seen.current && !saleAtLeast(row, seen.current))
        throw Error("An older purchase snapshot was returned.");
      return row;
    },
    [id, role, branchId],
  );
  const resource = useResource(`/staff/vehicle-transactions/${id}`, parse);
  useEffect(() => {
    if (resource.data) seen.current = mergeSaleObservation(seen.current, resource.data);
  }, [resource.data]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const candidate = resource.data,
    current =
      unavailable || !candidate ? undefined : mergeSaleObservation(observed, candidate),
    busy = resource.loading || resource.refreshing || checking,
    error = resource.error || resource.refreshError,
    disabled = busy || !!error || !!pending || !!proposal || !current;
  function identity(signal: AbortSignal) {
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Purchase account changed");
  }
  function adopt(row: SaleDetail) {
    const merged = mergeSaleObservation(seen.current, row);
    seen.current = merged;
    setObserved(merged);
  }
  async function fresh(signal: AbortSignal) {
    const profile = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    identity(signal);
    if (
      profile.id !== owner ||
      profile.role !== role ||
      profile.status !== "ACTIVE" ||
      (role === "STAFF" && profile.staffProfile?.branchId !== branchId)
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    const row = parseSaleDetail(
      (await apiRequest(`/staff/vehicle-transactions/${id}`, { signal })).data,
      id,
      role,
      branchId,
    );
    identity(signal);
    if (seen.current && !saleAtLeast(row, seen.current))
      throw Error("An older purchase snapshot was returned");
    return row;
  }
  function notSent() {
    const error = new ApiError(400, { error: { code: "REQUEST_FAILED" } });
    error.message =
      "No change was sent. Current access, reviewed facts or recovery storage could not be confirmed. Your draft is kept; refresh and reload the affected fields before reviewing again.";
    return error;
  }
  function review(offer: MutationProposal) {
    const change = offer.saleChange;
    if (disabled || !current || !change) return;
    const before = current,
      snapshot = saleChangeSnapshot(before, change);
    let sent = false,
      marker: Exclude<SalePending, "unknown"> | undefined;
    setMessage(undefined);
    setTone("error");
    setProposal({
      ...offer,
      retrySafely: false,
      retryAfterRejection: false,
      onUncertain: () => {
        if (!sent) return;
        offer.onUncertain?.();
        if (active.current) setPending(readSalePending(owner, role, id) ?? "unknown");
      },
      submit: async () => {
        if (request.current || !active.current) throw notSent();
        const controller = new AbortController();
        request.current = controller;
        try {
          const latest = await fresh(controller.signal);
          if (saleChangeSnapshot(latest, change) !== snapshot) {
            adopt(latest);
            throw notSent();
          }
          marker = markSalePending(owner, role, id, change.kind, before.version);
          sent = true;
          setPending(marker);
          const response = await offer.submit();
          identity(controller.signal);
          const saved = validateSaleChange(response, change, before, role, branchId);
          adopt(saved);
          try {
            clearSalePending(owner, role, id, marker.token);
            setPending(undefined);
          } catch {
            setPending(readSalePending(owner, role, id) ?? "unknown");
          }
          resource.refresh();
        } catch (error) {
          const submitted = sent;
          if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
            setUnavailable(true);
            refreshAccess();
          }
          if (sent && error instanceof ApiError && [408, 429].includes(error.status))
            throw Error("Purchase outcome needs reconciliation");
          if (
            sent &&
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            clearSalePending(owner, role, id, marker!.token);
            sent = false;
            setPending(undefined);
          }
          if (!sent) {
            setPending(readSalePending(owner, role, id));
            if (submitted) throw error;
            throw notSent();
          }
          throw error;
        } finally {
          request.current = null;
        }
      },
    });
  }
  async function loadCurrent() {
    if (request.current || proposal) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setTone("error");
    setMessage(undefined);
    try {
      const row = await fresh(controller.signal);
      if (pending) {
        forgetSaleDrafts(owner, role, id);
        clearSalePending(owner, role, id);
        setPending(undefined);
        setGeneration((v) => v + 1);
      }
      adopt(row);
      setUnavailable(false);
      resource.refresh();
      setTone("success");
      setMessage(
        pending
          ? "Current purchase details loaded. No change was resent; the previous request outcome is not proven. Unsaved fields were replaced."
          : "Current purchase details loaded. No change was resent.",
      );
    } catch {
      if (active.current)
        setMessage(
          "Current purchase details could not be confirmed. No change was resent. Check access and recovery storage before trying again.",
        );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  return (
    <div
      className="work-inspections work-sale-detail"
      data-sale-owner={`${owner}:${role}`}
      data-sale-path={`/admin/vehicle-sales/${id}`}
    >
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <Link href="/admin/vehicle-sales">Vehicle sales</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <span aria-current="page">
          {current?.transactionNumber ?? "Vehicle purchase"}
        </span>
      </nav>
      <header className="wi-header">
        <div>
          <h1>{current?.vehicleListing.title ?? "Vehicle purchase"}</h1>
          {current && (
            <p>
              {current.transactionNumber} · Customer: {current.customerName}
            </p>
          )}
          {current && (
            <span className="status" data-status={current.status}>
              {purchaseLabels[current.status]}
            </span>
          )}
        </div>
        <div className="wsd-actions">
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => (unavailable ? void loadCurrent() : resource.refresh())}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh vehicle purchase
          </button>
          <Link className="button secondary" href="/admin/vehicle-sales">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to vehicle sales
          </Link>
        </div>
      </header>
      <Feedback message={message} tone={tone} />
      {pending && (
        <section className="wi-state">
          <h2>A purchase change needs reconciliation</h2>
          <p>
            Loading the current purchase replaces unsaved fields. It does not resend the
            change or establish the original request outcome.
          </p>
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => void loadCurrent()}
          >
            Load current purchase
          </button>
        </section>
      )}
      {busy && (
        <p className="wi-state" role="status">
          {current ? "Refreshing purchase details…" : "Checking purchase details…"}
        </p>
      )}
      {error && (
        <section className="wi-state">
          <Feedback message={error} />
          {current && (
            <p>
              Previously loaded purchase facts are shown. Changes stay disabled until a
              fresh read succeeds.
            </p>
          )}
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={resource.refresh}
          >
            Retry vehicle purchase
          </button>
        </section>
      )}
      {unavailable && !error && (
        <section className="wi-state">
          <Feedback message="This purchase is unavailable under your current access." />
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => void loadCurrent()}
          >
            Retry vehicle purchase
          </button>
        </section>
      )}
      {current && (
        <div key={generation}>
          <WorkflowProgress workflow="vehicle" status={current.status} />
          <nav className="wsd-sections" aria-label="Purchase sections">
            <a href="#purchase-facts">Purchase facts</a>
            <a href="#purchase-negotiation">Negotiation</a>
            <a href="#purchase-progress">Purchase progress</a>
            <a href="#purchase-history">History</a>
            <a href="#purchase-handover">Handover</a>
          </nav>
          <div className="wsd-overview">
            <section className="wi-card" id="purchase-facts">
              <h2>Purchase facts</h2>
              <dl className="wsd-facts">
                <div>
                  <dt>Stock number</dt>
                  <dd>
                    <Link
                      className="text-link"
                      href={`/admin/vehicles/${current.vehicleListing.vehicle.id}`}
                    >
                      {current.vehicleListing.vehicle.stockNumber}
                    </Link>
                  </dd>
                </div>
                {[
                  { label: "Customer", value: current.customerName },
                  {
                    label: "Customer profile reference",
                    value: current.customerId ?? "No linked account",
                  },
                  { label: "Branch reference", value: current.vehicleListing.branchId },
                  { label: "Sale version", value: String(current.version) },
                  { label: "Created", value: formatStockInstant(current.createdAt) },
                  { label: "Updated", value: formatStockInstant(current.updatedAt) },
                ].map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
              {current.customerId === null && (
                <p className="notice">
                  This enquiry has no linked customer account. Account-based reservation
                  and invoicing require a customer profile.
                </p>
              )}
            </section>
            <section className="wi-card">
              <h2>Recorded amounts</h2>
              <dl className="wsd-facts">
                {[
                  { label: "Asking price", value: current.askingPriceKobo },
                  { label: "Agreed price", value: current.agreedPriceKobo },
                  {
                    label: "Reservation amount requested",
                    value: current.reservationRequiredKobo,
                  },
                ].map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>
                      {f.value === null
                        ? f.label === "Agreed price"
                          ? "Not agreed"
                          : "Not set"
                        : formatKobo(f.value)}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt>Full payment</dt>
                  <dd>
                    {current.paidAt
                      ? `Recorded ${formatStockInstant(current.paidAt)}`
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Recorded reservation deadline</dt>
                  <dd>{formatStockInstant(current.reservationExpiresAt)}</dd>
                </div>
              </dl>
              {current.status === "NEGOTIATING" && (
                <p className="wsd-guidance">
                  Reservation requires the customer’s acceptance of published terms.
                </p>
              )}
              {[
                { label: "Terms accepted", value: current.termsAcceptedAt },
                { label: "Paid hold starts", value: current.paidHoldStartsAt },
                { label: "Paid hold expires", value: current.paidHoldExpiresAt },
                { label: "Paid", value: current.paidAt },
                { label: "Handover pending", value: current.handoverPendingAt },
                { label: "Completed", value: current.completedAt },
                { label: "Cancelled", value: current.cancelledAt },
                { label: "Expired", value: current.expiredAt },
              ]
                .filter((f) => f.value)
                .map((f) => (
                  <p className="wsd-lifecycle" key={f.label}>
                    {f.label}: {formatStockInstant(f.value)}
                  </p>
                ))}
              {current.termsVersion && (
                <p className="wsd-lifecycle">
                  Recorded terms version: {current.termsVersion}
                </p>
              )}
              {current.cancellationReason && (
                <p className="preserve-lines">
                  Cancellation reason: {current.cancellationReason}
                </p>
              )}
            </section>
          </div>
          <div className="wsd-operations">
            <div id="purchase-negotiation">
              {["ENQUIRY", "INSPECTION_COMPLETED", "NEGOTIATING"].includes(
                current.status,
              ) ? (
                <VehicleNegotiationForm
                  sale={current}
                  disabled={disabled}
                  onReview={review}
                />
              ) : (
                <section className="detail-section">
                  <h2>Negotiated price</h2>
                  <p>Negotiation is closed for this purchase status.</p>
                </section>
              )}
            </div>
            <div id="purchase-progress">
              {saleTransitions[current.status].length ? (
                <VehicleSaleStatusForm
                  sale={current}
                  disabled={disabled}
                  onReview={review}
                />
              ) : (
                <section className="detail-section">
                  <h2>Purchase progress</h2>
                  <p>This purchase has no manual status transition available.</p>
                </section>
              )}
            </div>
          </div>
          <section className="wi-card" id="purchase-history">
            <h2>Purchase history</h2>
            {current.statusHistory.length ? (
              <ol className="wsd-history">
                {[...current.statusHistory].reverse().map((entry) => (
                  <li key={entry.id}>
                    <strong>{purchaseLabels[entry.toStatus]}</strong>
                    <p className="wsd-lifecycle">
                      {formatStockInstant(entry.createdAt)}
                      {entry.fromStatus
                        ? ` · From ${purchaseLabels[entry.fromStatus]}`
                        : ""}
                    </p>
                    {entry.reason && <p className="preserve-lines">{entry.reason}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No progress entries are recorded.</p>
            )}
          </section>
          <div id="purchase-handover">
            {current.status === "PAID" && !current.handover ? (
              <VehicleHandoverCreate
                sale={current}
                disabled={disabled}
                onReview={review}
              />
            ) : current.handover ? (
              <VehicleHandoverRecord
                key={current.handover.id}
                sale={current}
                disabled={disabled}
                accessDisabled={busy || !!error || unavailable}
                onReview={review}
              />
            ) : (
              <section className="detail-section">
                <h2>Handover</h2>
                <p>A handover can be created after this purchase is paid.</p>
              </section>
            )}
          </div>
        </div>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            resource.refresh();
          }}
          onSuccess={() => {
            setTone("success");
            setMessage(
              "Purchase change recorded. Review the refreshed details and history.",
            );
          }}
        />
      )}
    </div>
  );
}
