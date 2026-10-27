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
  clearStockDetailPending,
  forgetStockDetailDrafts,
  formatStockInstant,
  markStockDetailPending,
  mergeStockObservation,
  parseStockDetail,
  readStockDetailPending,
  stockAtLeast,
  stockChangeSnapshot,
  stockDetailPendingKey,
  validateStockChange,
  type StockDetail,
  type StockDetailPending,
} from "@/lib/admin/work-vehicle-detail";
import { stockStatusLabels } from "@/lib/admin/work-vehicle-stock";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { VehicleRecordForm } from "./vehicle-record-form";
import {
  VehicleListingForm,
  VehicleListingPrice,
  VehicleListingStatus,
} from "./vehicle-listing-forms";
import { VehicleEvidence } from "./vehicle-evidence";
const roles = ["STAFF", "ADMIN", "SUPER_ADMIN"];
export function WorkVehicleDetail({ vehicleId }: { vehicleId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  return roles.includes(session.user.role) ? (
    <DetailAccess
      key={`${session.user.id}:${session.user.role}:${vehicleId}`}
      id={vehicleId}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <Feedback message="Staff access is required to view this vehicle." />
  );
}
function DetailAccess({ id, owner, role }: { id: string; owner: string; role: string }) {
  const permission = useOwnStaffPermissions(),
    profile = permission.data,
    invalid =
      !!profile &&
      (profile.id !== owner || profile.role !== role || profile.status !== "ACTIVE");
  if (
    permission.error ||
    permission.refreshError ||
    invalid ||
    !profile ||
    (role === "STAFF" && !profile.staffProfile?.branchId)
  )
    return (
      <div className="work-vehicle-detail" data-stock-owner={`${owner}:${role}`}>
        <h1>Vehicle record</h1>
        {!profile && !permission.error ? (
          <p role="status">Checking vehicle access…</p>
        ) : (
          <>
            <Feedback
              message={
                permission.error ||
                permission.refreshError ||
                "Current vehicle access and branch assignment could not be confirmed."
              }
            />
            <button
              className="button secondary"
              disabled={permission.loading || permission.refreshing}
              onClick={permission.refresh}
            >
              Retry vehicle access
            </button>
          </>
        )}
      </div>
    );
  return (
    <DetailWorkspace
      key={`${id}:${role === "STAFF" ? profile.staffProfile?.branchId : "all"}`}
      id={id}
      owner={owner}
      role={role}
      branchId={role === "STAFF" ? profile.staffProfile?.branchId : undefined}
      refreshAccess={permission.refresh}
    />
  );
}
function DetailWorkspace({
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
  const seen = useRef<StockDetail | undefined>(undefined),
    minimumVersion = useRef(0),
    active = useRef(true),
    request = useRef<AbortController | null>(null),
    knownReply = useRef(false);
  const [observed, setObserved] = useState<StockDetail>(),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [pending, setPending] = useState<StockDetailPending | undefined>(() =>
      readStockDetailPending(stockDetailPendingKey(owner, role, id)),
    ),
    [message, setMessage] = useState<string>(),
    [messageTone, setMessageTone] = useState<"success" | "error">("error"),
    [confirmedReply, setConfirmedReply] = useState(false),
    [checking, setChecking] = useState(false),
    [unavailable, setUnavailable] = useState(false),
    [generation, setGeneration] = useState(0),
    [floor, setFloor] = useState(0);
  const parse = useCallback(
    (value: unknown) => {
      const row = parseStockDetail(value, id, role, branchId);
      if (
        row.version < minimumVersion.current ||
        (seen.current && !stockAtLeast(row, seen.current))
      )
        throw Error(
          "An older vehicle snapshot was returned. Refresh for the current record.",
        );
      return row;
    },
    [id, role, branchId],
  );
  const resource = useResource(`/staff/vehicles/${id}`, parse);
  function adopt(row: StockDetail) {
    const merged = mergeStockObservation(seen.current, row);
    seen.current = merged;
    setObserved(merged);
  }
  useEffect(() => {
    if (resource.data) {
      const merged = mergeStockObservation(seen.current, resource.data);
      seen.current = merged;
    }
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
      unavailable || !candidate
        ? undefined
        : observed && !stockAtLeast(candidate, observed)
          ? observed
          : mergeStockObservation(observed, candidate);
  const awaiting = !!current && current.version < floor,
    error = resource.error || resource.refreshError,
    busy = resource.loading || resource.refreshing || checking;
  const disabled = busy || !!error || !!proposal || !!pending || awaiting || !current;
  function identity(signal: AbortSignal) {
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Vehicle account changed");
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
      (role === "STAFF" && (!branchId || profile.staffProfile?.branchId !== branchId))
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    const row = parseStockDetail(
      (await apiRequest(`/staff/vehicles/${id}`, { signal })).data,
      id,
      role,
      branchId,
    );
    identity(signal);
    return row;
  }
  function notSent() {
    const error = new ApiError(400, { error: { code: "REQUEST_FAILED" } });
    error.message =
      "No change was sent. Current access or the reviewed record changed. Your draft is kept; reload the affected fields before reviewing again.";
    return error;
  }
  function review(offer: MutationProposal) {
    if (disabled || !current || !offer.stockChange) return;
    const change = offer.stockChange,
      baseline = stockChangeSnapshot(current, change),
      before = current;
    let sent = false,
      marker: Exclude<StockDetailPending, "unknown"> | undefined;
    knownReply.current = false;
    setConfirmedReply(false);
    setMessageTone("error");
    setMessage(undefined);
    setProposal({
      ...offer,
      retryAfterRejection: false,
      onUncertain: () => {
        if (!sent) return;
        offer.onUncertain?.();
        if (active.current)
          setPending(
            readStockDetailPending(stockDetailPendingKey(owner, role, id)) ?? "unknown",
          );
      },
      submit: async () => {
        if (request.current || !active.current) throw notSent();
        const controller = new AbortController();
        request.current = controller;
        const wasRetry = sent;
        try {
          const latest = await fresh(controller.signal);
          if (!wasRetry && stockChangeSnapshot(latest, change) !== baseline) {
            adopt(latest);
            throw notSent();
          }
          if (wasRetry) {
            const stored = readStockDetailPending(stockDetailPendingKey(owner, role, id));
            if (
              !offer.retrySafely ||
              typeof stored !== "object" ||
              stored.token !== marker?.token
            )
              throw notSent();
          } else {
            marker = markStockDetailPending(owner, role, id, change.kind, before.version);
            setPending(marker);
            sent = true;
          }
          const result = await offer.submit();
          identity(controller.signal);
          const receipt = validateStockChange(result, change, before, role, branchId);
          if (receipt.kind === "record") adopt(receipt.saved);
          else if (receipt.kind === "listing")
            adopt({
              ...latest,
              listings: [
                ...latest.listings.filter((v) => v.id !== receipt.saved.id),
                receipt.saved,
              ],
            });
          else if (receipt.kind === "document")
            adopt({
              ...latest,
              documents: [
                ...latest.documents.filter((v) => v.id !== receipt.saved.id),
                receipt.saved,
              ],
            });
          else if (receipt.kind === "condition")
            adopt({ ...latest, conditionReports: [receipt.saved] });
          else {
            minimumVersion.current = Math.max(minimumVersion.current, receipt.version);
            setFloor(minimumVersion.current);
          }
          knownReply.current = true;
          setConfirmedReply(true);
          try {
            clearStockDetailPending(owner, role, id, marker!.token);
            setPending(undefined);
          } catch {
            setPending(
              readStockDetailPending(stockDetailPendingKey(owner, role, id)) ?? "unknown",
            );
          }
          resource.refresh();
        } catch (error) {
          const submitted = sent;
          if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
            setUnavailable(true);
            refreshAccess();
          }
          if (sent && error instanceof ApiError && [408, 429].includes(error.status))
            throw Error("The change needs reconciliation.");
          if (
            sent &&
            !wasRetry &&
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            clearStockDetailPending(owner, role, id, marker!.token);
            sent = false;
            setPending(undefined);
          }
          if (!sent) {
            setPending(readStockDetailPending(stockDetailPendingKey(owner, role, id)));
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
    if (request.current || checking || proposal) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setMessageTone("error");
    setMessage(undefined);
    try {
      const row = await fresh(controller.signal);
      if (pending) {
        forgetStockDetailDrafts(owner, role, id);
        clearStockDetailPending(owner, role, id);
        setPending(undefined);
        setGeneration((v) => v + 1);
      }
      seen.current = row;
      minimumVersion.current = row.version;
      setFloor(row.version);
      setObserved(row);
      setUnavailable(false);
      knownReply.current = false;
      setConfirmedReply(false);
      setMessageTone("success");
      resource.refresh();
      setMessage(
        "Current vehicle details loaded. No change was resent; the previous request outcome is not proven. Unsaved fields were replaced.",
      );
    } catch {
      if (active.current)
        setMessage(
          "Current vehicle details could not be confirmed. No change was resent. Check access and recovery storage before trying again.",
        );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  function refresh() {
    if (unavailable) void loadCurrent();
    else resource.refresh();
  }
  const name = current
    ? `${current.year} ${current.make} ${current.model}`
    : "Vehicle record";
  const facts = current
    ? [
        { label: "Condition", value: current.condition },
        {
          label: "Mileage",
          value:
            current.mileageKm === null
              ? "Not recorded"
              : `${current.mileageKm.toLocaleString("en-NG")} km`,
        },
        { label: "Transmission", value: current.transmission },
        { label: "Fuel type", value: current.fuelType },
        { label: "Body type", value: current.bodyType },
        { label: "Drive type", value: current.driveType },
        { label: "Engine size", value: current.engineSize },
        { label: "Colour", value: current.color },
        { label: "Doors", value: current.doors },
        { label: "Seats", value: current.seats },
      ]
    : [];
  const human = (v: unknown) =>
    v === null || v === undefined
      ? "Not recorded"
      : typeof v === "string"
        ? ["CVT", "SUV", "FWD", "RWD", "AWD"].includes(v)
          ? v
          : v === "FOUR_WD"
            ? "4WD"
            : v
                .replaceAll("_", " ")
                .toLowerCase()
                .replace(/^./, (c) => c.toUpperCase())
        : String(v);
  return (
    <div className="work-vehicle-detail" data-stock-owner={`${owner}:${role}`}>
      <nav className="vd-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight aria-hidden="true" />
        <Link href="/admin/vehicles">Vehicle stock</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">{name}</span>
      </nav>
      <header className="vd-header">
        <div>
          <h1>{name}</h1>
          {current && (
            <p>
              {current.stockNumber}
              {current.trim ? ` · ${current.trim}` : ""} · {current.branch.name} (
              {current.branch.code})
            </p>
          )}
        </div>
        <div className="actions">
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh stock record
          </button>
          <Link className="vd-back" href="/admin/vehicles">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to vehicle stock
          </Link>
        </div>
      </header>
      <Feedback message={message} tone={messageTone} />
      {pending && (
        <section className="vd-state">
          <h2>
            {confirmedReply
              ? "The change was confirmed"
              : "A vehicle change needs reconciliation"}
          </h2>
          <p>
            {confirmedReply
              ? "A valid change response was received, but browser recovery state still needs a current read."
              : "The previous outcome is not confirmed. Loading the current vehicle replaces unsaved fields; it does not resend the change or establish the original request outcome."}
          </p>
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => void loadCurrent()}
          >
            Load current vehicle
          </button>
        </section>
      )}
      {error && (
        <div className="vd-state">
          <Feedback message={error} />
          {current && (
            <p>
              Previously loaded vehicle facts are shown. Changes stay disabled until a
              fresh read succeeds.
            </p>
          )}
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={refresh}
          >
            Retry vehicle record
          </button>
        </div>
      )}
      {unavailable && !error && (
        <div className="vd-state">
          <Feedback message="This vehicle is unavailable under your current access." />
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => void loadCurrent()}
          >
            Retry vehicle record
          </button>
        </div>
      )}
      {busy && (
        <p role="status">
          {current ? "Refreshing vehicle record…" : "Checking vehicle record…"}
        </p>
      )}
      {awaiting && (
        <p role="status" className="notice">
          Waiting for the updated stock record. Refresh if this message remains.
        </p>
      )}
      {current && (
        <div key={generation}>
          <nav className="vd-sections" aria-label="Vehicle record sections">
            <a href="#vehicle-record-details">Record details</a>
            <a href="#vehicle-sale-listings">Sale listings</a>
            <a href="#vehicle-photos">Vehicle photos</a>
            <a href="#vehicle-documents-heading">Documents</a>
            <a href="#vehicle-condition-heading">Condition report</a>
          </nav>
          <div className="vd-overview" id="vehicle-record-details">
            <section className="detail-section">
              <h2>Vehicle details</h2>
              <dl className="vd-facts">
                {facts.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>
                      {[
                        "Condition",
                        "Transmission",
                        "Fuel type",
                        "Body type",
                        "Drive type",
                      ].includes(f.label)
                        ? human(f.value)
                        : f.value == null
                          ? "Not recorded"
                          : String(f.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="detail-section">
              <h2>Stock identity</h2>
              <dl className="vd-identity">
                {[
                  { label: "Stock number", value: current.stockNumber },
                  {
                    label: "Branch",
                    value: `${current.branch.name} (${current.branch.code})${current.branch.isActive ? "" : " · Inactive branch"}`,
                  },
                  { label: "VIN", value: current.vin },
                  { label: "Chassis number", value: current.chassisNumber },
                  { label: "Registration number", value: current.registrationNumber },
                  { label: "Version", value: String(current.version) },
                  ...(role !== "STAFF"
                    ? [
                        {
                          label: "Internal acquisition cost",
                          value:
                            current.acquisitionCostKobo == null
                              ? "Not recorded"
                              : formatKobo(current.acquisitionCostKobo),
                        },
                      ]
                    : []),
                  { label: "Acquired at", value: formatStockInstant(current.acquiredAt) },
                  ...(current.createdAt
                    ? [{ label: "Created", value: formatStockInstant(current.createdAt) }]
                    : []),
                  ...(current.updatedAt
                    ? [{ label: "Updated", value: formatStockInstant(current.updatedAt) }]
                    : []),
                ].map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value ?? "Not recorded"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          <details className="detail-section vd-record-editor">
            <summary>Edit vehicle specifications</summary>
            <VehicleRecordForm
              key={current.id}
              vehicle={current}
              disabled={disabled}
              onReview={review}
            />
          </details>
          <section className="detail-section" id="vehicle-sale-listings">
            <h2>Sale listings</h2>
            <p>
              Each listing has its own price, content and publication status. New listings
              start as drafts.
            </p>
            {!current.listings.length && (
              <p>No listings have been created for this vehicle.</p>
            )}
            {current.listings.map((listing) => (
              <section
                className="vd-listing"
                key={listing.id}
                aria-labelledby={`listing-heading-${listing.id}`}
              >
                <div className="vd-listing-header">
                  <h3 id={`listing-heading-${listing.id}`}>{listing.title}</h3>
                  <WorkflowProgress workflow="stock" status={listing.status} />
                  <span className="status" data-status={listing.status}>
                    {stockStatusLabels[listing.status]}
                  </span>
                </div>
                <p className="vd-price">{formatKobo(listing.priceKobo)}</p>
                <dl className="vd-identity">
                  <div>
                    <dt>Listing slug</dt>
                    <dd>{listing.slug}</dd>
                  </div>
                  <div>
                    <dt>Featured</dt>
                    <dd>{listing.featured ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{listing.version}</dd>
                  </div>
                </dl>
                <p className="preserve-lines">
                  {listing.description ?? "No public description recorded."}
                </p>
                {listing.status === "AVAILABLE" && current.branch.isActive && (
                  <Link className="text-link" href={`/vehicles/${listing.id}`}>
                    View public listing
                  </Link>
                )}
                {[
                  { label: "First published", value: listing.publishedAt },
                  { label: "Reserved", value: listing.reservedAt },
                  { label: "Sold", value: listing.soldAt },
                  { label: "Archived", value: listing.archivedAt },
                ]
                  .filter((f) => f.value)
                  .map((f) => (
                    <p className="vd-listing-date" key={f.label}>
                      {f.label} {formatStockInstant(f.value)}
                    </p>
                  ))}
                <details>
                  <summary>Edit listing content</summary>
                  <VehicleListingForm
                    listing={listing}
                    vehicleId={current.id}
                    disabled={disabled}
                    onReview={review}
                  />
                </details>
                <details>
                  <summary>Manage asking price</summary>
                  <VehicleListingPrice
                    listing={listing}
                    disabled={disabled}
                    onReview={review}
                  />
                </details>
                <VehicleListingStatus
                  key={listing.version}
                  listing={listing}
                  disabled={disabled}
                  onReview={review}
                />
              </section>
            ))}
            <details>
              <summary>Create a draft listing</summary>
              <VehicleListingForm
                key={`new-${current.listings.length}`}
                vehicleId={current.id}
                disabled={disabled}
                onReview={review}
              />
            </details>
          </section>
          <VehicleEvidence
            vehicle={current}
            disabled={disabled}
            accessDisabled={busy || !!error || unavailable}
            onReview={review}
            onVersion={(v) => {
              minimumVersion.current = Math.max(minimumVersion.current, v);
              setFloor(minimumVersion.current);
            }}
          />
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
            setMessageTone(knownReply.current ? "success" : "error");
            setMessage(
              knownReply.current
                ? proposal.stockChange?.kind === "record"
                  ? "Vehicle changes recorded. Review the refreshed details."
                  : "Vehicle change recorded. Review the refreshed details."
                : "The vehicle response could not be confirmed.",
            );
          }}
        />
      )}
    </div>
  );
}
