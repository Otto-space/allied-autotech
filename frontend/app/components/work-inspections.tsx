"use client";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight, Filter, RefreshCw } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { inspectionStatuses } from "@/lib/api/staff-inspection-schemas";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  clearInspectionPending,
  forgetInspectionDrafts,
  inspectionLabels,
  inspectionPageParams,
  inspectionSnapshot,
  markInspectionPending,
  parseWorkInspections,
  readInspectionPending,
  validateInspectionReceipt,
  workInspectionsQuery,
  type WorkInspection,
  type InspectionPending,
} from "@/lib/admin/work-inspections";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { Feedback } from "./feedback";
import { InspectionStatusForm } from "./inspection-status-form";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function WorkInspections() {
  const session = useAccountSession();
  if (!session) return null;
  return ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <InspectionAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <Feedback message="Staff access is required to view inspection records." />
  );
}
function InspectionAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    profile = access.data,
    invalid =
      !!profile &&
      (profile.id !== owner ||
        profile.role !== role ||
        profile.status !== "ACTIVE" ||
        (role === "STAFF" && !profile.staffProfile?.branchId)),
    error =
      access.error ||
      access.refreshError ||
      (invalid
        ? "Current inspection access and branch assignment could not be confirmed."
        : undefined);
  if (!profile || error)
    return (
      <div className="work-inspections">
        <h1>Vehicle inspections</h1>
        {error ? (
          <>
            <Feedback message={error} />
            <button
              className="button secondary"
              disabled={access.loading || access.refreshing}
              onClick={access.refresh}
            >
              Retry inspection access
            </button>
          </>
        ) : (
          <p role="status">Checking inspection access…</p>
        )}
      </div>
    );
  return (
    <InspectionWorkspace
      key={`${owner}:${role}:${role === "STAFF" ? profile.staffProfile?.branchId : "all"}`}
      owner={owner}
      role={role}
      branchId={role === "STAFF" ? profile.staffProfile?.branchId : undefined}
      refreshAccess={access.refresh}
    />
  );
}
function navigate(params: URLSearchParams) {
  window.history.pushState(
    null,
    "",
    `/admin/inspections${params.size ? `?${params}` : ""}`,
  );
}
function useInspectionPage(
  path: string | null,
  branchId: string | null | undefined,
  seen: { current: Map<string, WorkInspection> },
) {
  const parse = useCallback(
    (value: unknown) => {
      const page = parseWorkInspections(
        value,
        branchId,
        new URLSearchParams(path?.split("?")[1]),
      );
      if (
        page.items.some((row) => row.version < (seen.current.get(row.id)?.version ?? 0))
      )
        throw Error("An older inspection page was returned.");
      return page;
    },
    [path, branchId, seen],
  );
  return useResource(path, parse);
}
function InspectionWorkspace({
  owner,
  role,
  branchId,
  refreshAccess,
}: {
  owner: string;
  role: string;
  branchId?: string | null;
  refreshAccess: () => void;
}) {
  const search = useSearchParams(),
    query = workInspectionsQuery(new URLSearchParams(search.toString()), role, branchId);
  const seen = useRef(new Map<string, WorkInspection>()),
    request = useRef<AbortController | null>(null),
    active = useRef(true);
  const [observed, setObserved] = useState<Record<string, WorkInspection>>({}),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [message, setMessage] = useState<string>(),
    [tone, setTone] = useState<"error" | "success">("error"),
    [pending, setPending] = useState<InspectionPending | undefined>(() =>
      readInspectionPending(owner, role),
    ),
    [checking, setChecking] = useState(false),
    [unavailable, setUnavailable] = useState(false),
    [generation, setGeneration] = useState(0);
  const records = useInspectionPage(query.path, branchId, seen);
  useEffect(() => {
    for (const row of records.data?.items ?? []) {
      if (row.version >= (seen.current.get(row.id)?.version ?? 0))
        seen.current.set(row.id, row);
    }
  }, [records.data]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const data = unavailable ? undefined : records.data,
    busy = records.loading || records.refreshing || checking,
    error = records.error || records.refreshError,
    blocked = busy || !!error || !!proposal || !!pending || !data || query.invalid;
  const rows =
    data?.items
      .map((row) =>
        observed[row.id] && observed[row.id].version > row.version
          ? observed[row.id]
          : row,
      )
      .filter(
        (row) => !query.params.has("status") || row.status === query.params.get("status"),
      ) ?? [];
  function adopt(row: WorkInspection) {
    const old = seen.current.get(row.id);
    if (!old || row.version >= old.version) {
      seen.current.set(row.id, row);
      setObserved((current) => ({ ...current, [row.id]: row }));
    }
  }
  async function fresh(signal: AbortSignal) {
    const profile = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Inspection account changed");
    if (
      profile.id !== owner ||
      profile.role !== role ||
      profile.status !== "ACTIVE" ||
      (role === "STAFF" && profile.staffProfile?.branchId !== branchId)
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    const page = parseWorkInspections(
      (await apiRequest(query.path!, { signal })).data,
      branchId,
      query.api,
    );
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Inspection account changed");
    return { page, profile };
  }
  function notSent() {
    const error = new ApiError(400, { error: { code: "REQUEST_FAILED" } });
    error.message =
      "No change was sent. Current access or the reviewed inspection changed. Your draft is kept; refresh and reload the affected fields before reviewing again.";
    return error;
  }
  function review(offer: MutationProposal) {
    const change = offer.inspectionChange,
      before = rows.find((row) => row.id === change?.id);
    if (blocked || !change || !before) return;
    const snapshot = inspectionSnapshot(before);
    let sent = false,
      marker: Exclude<InspectionPending, "unknown"> | undefined;
    setMessage(undefined);
    setTone("error");
    setProposal({
      ...offer,
      retryAfterRejection: false,
      onUncertain: () => {
        if (sent && active.current)
          setPending(readInspectionPending(owner, role) ?? "unknown");
      },
      submit: async () => {
        if (request.current || !active.current) throw notSent();
        const controller = new AbortController();
        request.current = controller;
        try {
          const { page, profile } = await fresh(controller.signal),
            latest = page.items.find((row) => row.id === before.id);
          if (!latest || inspectionSnapshot(latest) !== snapshot) {
            if (latest) adopt(latest);
            throw notSent();
          }
          marker = markInspectionPending(owner, role, before.id, before.version);
          sent = true;
          setPending(marker);
          const result = await offer.submit();
          if (!active.current || draftIdentity() !== `${owner}:${role}`)
            throw Error("Inspection account changed");
          const saved = validateInspectionReceipt(
            result,
            before,
            change.body,
            role === "STAFF" ? profile.staffProfile?.id : undefined,
          );
          adopt(saved);
          try {
            clearInspectionPending(owner, role, marker.token);
            setPending(undefined);
          } catch {
            setPending(readInspectionPending(owner, role) ?? "unknown");
          }
          records.refresh();
        } catch (error) {
          const submitted = sent;
          if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
            setUnavailable(true);
            refreshAccess();
          }
          if (sent && error instanceof ApiError && [408, 429].includes(error.status))
            throw Error("Inspection outcome needs reconciliation");
          if (
            sent &&
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            clearInspectionPending(owner, role, marker!.token);
            sent = false;
            setPending(undefined);
          }
          if (!sent) {
            setPending(readInspectionPending(owner, role));
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
  async function reconcile() {
    if (request.current || proposal || query.invalid) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setTone("error");
    setMessage(undefined);
    try {
      const { page } = await fresh(controller.signal);
      if (pending) {
        forgetInspectionDrafts(owner, role);
        clearInspectionPending(owner, role);
        setPending(undefined);
        setGeneration((v) => v + 1);
      }
      for (const row of page.items) adopt(row);
      setUnavailable(false);
      records.refresh();
      setTone("success");
      setMessage(
        "Current inspection page loaded. No change was resent; the previous request outcome is not proven. Unsaved fields were replaced.",
      );
    } catch {
      setMessage(
        "The current inspection page could not be confirmed. No change was resent. Check access and recovery storage before trying again.",
      );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  const filters = new URLSearchParams(query.params);
  filters.delete("cursor");
  filters.delete("_trail");
  function page(next: boolean) {
    navigate(inspectionPageParams(query.params, data?.nextCursor, !next));
    document.getElementById("wi-title")?.focus({ preventScroll: true });
  }
  return (
    <div className="work-inspections" data-inspection-owner={`${owner}:${role}`}>
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <span aria-current="page">Vehicle inspections</span>
      </nav>
      <header className="wi-header">
        <div>
          <h1 id="wi-title" tabIndex={-1}>
            Vehicle inspections
          </h1>
          <p>
            Schedule requested inspections and record their progress. Times are shown in
            Lagos time.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy || !!proposal || query.invalid}
          onClick={() => (unavailable ? void reconcile() : records.refresh())}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh inspection records
        </button>
      </header>
      {query.invalid ? (
        <section className="wi-state">
          <h2>Inspection filters unavailable</h2>
          <p>This link contains invalid or unavailable inspection filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear inspection filters
          </button>
        </section>
      ) : (
        <>
          <InspectionFilters
            key={filters.toString()}
            params={filters}
            role={role}
            disabled={busy || !!proposal}
          />
          {role === "STAFF" && (
            <p className="wi-scope">Showing inspections for your assigned branch.</p>
          )}
          <Feedback message={message} tone={tone} />
          {pending && (
            <section className="wi-state">
              <h2>An inspection change needs reconciliation</h2>
              <p>
                Loading the current page replaces unsaved inspection fields. It does not
                resend the change or prove the original request outcome.
              </p>
              <button
                className="button secondary"
                disabled={busy || !!proposal}
                onClick={() => void reconcile()}
              >
                Load current inspection page
              </button>
            </section>
          )}
          <section aria-labelledby="wi-records" key={generation}>
            <div className="wi-band">
              <h2 id="wi-records">Inspection records</h2>
              {data && (
                <span>
                  {rows.length} {rows.length === 1 ? "inspection" : "inspections"} on this
                  page
                </span>
              )}
            </div>
            {busy && (
              <p role="status" className="wi-state">
                {data ? "Refreshing inspection records…" : "Checking inspection records…"}
              </p>
            )}
            {error && (
              <div className="wi-state">
                <Feedback message={error} />
                <p>
                  {data
                    ? "Previously loaded inspections are shown. Changes stay disabled until a fresh read succeeds."
                    : "Inspection records could not be loaded."}
                </p>
                <button
                  className="button secondary"
                  disabled={busy || !!proposal}
                  onClick={records.refresh}
                >
                  Retry inspection records
                </button>
              </div>
            )}
            {unavailable && !error && (
              <div className="wi-state">
                <Feedback message="Inspection records are unavailable under your current access." />
                <button
                  className="button secondary"
                  disabled={busy || !!proposal}
                  onClick={() => void reconcile()}
                >
                  Retry inspection records
                </button>
              </div>
            )}
            {!busy && !error && data && !rows.length && (
              <div className="wi-state">
                <h3>
                  {filters.size
                    ? "No inspections match these filters"
                    : "No inspection requests on this page"}
                </h3>
                <p>
                  {query.params.has("cursor")
                    ? "Return to the first page to check current requests."
                    : "New inspection requests will appear here."}
                </p>
              </div>
            )}
            {rows.map((row) => (
              <InspectionCard
                key={row.id}
                row={row}
                disabled={blocked}
                onReview={review}
              />
            ))}
            <nav className="wi-pagination" aria-label="Staff inspections pages">
              <button
                className="button secondary"
                disabled={blocked || !query.params.get("_trail")}
                onClick={() => page(false)}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Previous
              </button>
              <button
                className="button secondary"
                disabled={blocked || !query.params.has("cursor")}
                onClick={() => navigate(filters)}
              >
                First page
              </button>
              <button
                className="button secondary"
                disabled={blocked || !data?.nextCursor}
                onClick={() => page(true)}
              >
                Next
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </nav>
          </section>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            records.refresh();
          }}
          onSuccess={() => {
            setTone("success");
            setMessage("Inspection change recorded. Review the refreshed details.");
          }}
        />
      )}
    </div>
  );
}
function InspectionFilters({
  params,
  role,
  disabled,
}: {
  params: URLSearchParams;
  role: string;
  disabled: boolean;
}) {
  const [status, setStatus] = useState(params.get("status") ?? ""),
    [branch, setBranch] = useState(params.get("branchId") ?? "");
  return (
    <form
      className="wi-filters"
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        if (status) next.set("status", status);
        if (role !== "STAFF" && branch) next.set("branchId", branch);
        navigate(next);
      }}
    >
      <fieldset disabled={disabled}>
        <legend className="sr-only">Inspection filters</legend>
        <div className="field">
          <label htmlFor="staff-inspection-status">Inspection status filter</label>
          <select
            id="staff-inspection-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {inspectionStatuses.map((value) => (
              <option key={value} value={value}>
                {inspectionLabels[value]}
              </option>
            ))}
          </select>
        </div>
        {role !== "STAFF" && (
          <div className="field">
            <label htmlFor="staff-inspection-branch">Branch filter</label>
            <AdminBranchPicker
              id="staff-inspection-branch"
              value={branch}
              onChange={setBranch}
              activeOnly={false}
            />
          </div>
        )}
        <div className="actions">
          <button className="button">
            <Filter size={16} aria-hidden="true" />
            Apply filters
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setStatus("");
              setBranch("");
              navigate(new URLSearchParams());
            }}
          >
            Clear inspection filters
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function InspectionCard({
  row,
  disabled,
  onReview,
}: {
  row: WorkInspection;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const facts = [
    {
      label: "Customer preference",
      value: `${formatStockInstant(row.preferredStartAt)}${row.preferredEndAt ? ` – ${formatStockInstant(row.preferredEndAt)}` : " · No preferred end recorded"}`,
    },
    {
      label: "Scheduled start",
      value: row.scheduledStartAt
        ? formatStockInstant(row.scheduledStartAt)
        : "Not scheduled",
    },
    {
      label: "Scheduled end",
      value: row.scheduledEndAt
        ? formatStockInstant(row.scheduledEndAt)
        : "Not scheduled",
    },
    {
      label: "Assigned staff",
      value: row.assignedStaff
        ? `${row.assignedStaff.firstName} ${row.assignedStaff.lastName}`
        : "Not assigned",
    },
  ];
  return (
    <article className="wi-card" aria-labelledby={`inspection-heading-${row.id}`}>
      <header>
        <div>
          <h3 id={`inspection-heading-${row.id}`}>{row.vehicleListing.title}</h3>
          <p>
            Stock {row.vehicleListing.vehicle.stockNumber} · Customer: {row.customerName}
          </p>
        </div>
        <span className="status" data-status={row.status}>
          {inspectionLabels[row.status]}
        </span>
      </header>
      <WorkflowProgress workflow="inspection" status={row.status} />
      <dl className="wi-reference">
        <div>
          <dt>Reference</dt>
          <dd>{row.id}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{row.version}</dd>
        </div>
        <div>
          <dt>Branch reference</dt>
          <dd>{row.vehicleListing.branchId}</dd>
        </div>
      </dl>
      <dl className="wi-facts">
        {facts.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      {row.notes && (
        <div className="wi-note">
          <strong>Customer notes</strong>
          <p className="preserve-lines">{row.notes}</p>
        </div>
      )}
      {row.cancellationReason && (
        <div className="wi-note">
          <strong>Cancellation reason</strong>
          <p className="preserve-lines">{row.cancellationReason}</p>
        </div>
      )}
      <dl className="wi-lifecycle">
        {[
          { label: "Requested", value: row.createdAt },
          { label: "Confirmed", value: row.confirmedAt },
          { label: "Completed", value: row.completedAt },
          { label: "Cancelled", value: row.cancelledAt },
          { label: "Updated", value: row.updatedAt },
        ]
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{formatStockInstant(f.value)}</dd>
            </div>
          ))}
      </dl>
      <details>
        <summary>Manage inspection progress</summary>
        <InspectionStatusForm inspection={row} disabled={disabled} onReview={onReview} />
      </details>
      {row.conditionReport && (
        <details>
          <summary>Recorded condition report</summary>
          <p>{formatStockInstant(row.conditionReport.inspectedAt)}</p>
          <p className="preserve-lines">{row.conditionReport.summary}</p>
          <dl className="wi-report">
            <div>
              <dt>Odometer</dt>
              <dd>
                {row.conditionReport.odometerKm === null
                  ? "Not recorded"
                  : `${row.conditionReport.odometerKm.toLocaleString("en-NG")} km`}
              </dd>
            </div>
            <div>
              <dt>Condition score</dt>
              <dd>
                {row.conditionReport.conditionScore === null
                  ? "Not recorded"
                  : `${row.conditionReport.conditionScore} / 100`}
              </dd>
            </div>
            {Object.entries(row.conditionReport.findings ?? {}).map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>
                  {value === null
                    ? "Not recorded"
                    : typeof value === "boolean"
                      ? value
                        ? "Yes"
                        : "No"
                      : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {row.status === "COMPLETED" && !row.conditionReport && (
        <p className="wi-guidance">
          To record the findings, find stock {row.vehicleListing.vehicle.stockNumber} in{" "}
          <Link className="text-link" href="/admin/vehicles">
            vehicle stock
          </Link>{" "}
          and link its condition report to this completed inspection.
        </p>
      )}
    </article>
  );
}
