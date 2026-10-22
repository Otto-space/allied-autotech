"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw, Star } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { reviewLabels, reviewTargets } from "@/lib/api/review-schemas";
import {
  clearModerationPending,
  forgetModerationDraft,
  markModerationPending,
  moderationPageParams,
  moderationQuery,
  moderationSnapshot,
  parseModerationPage,
  parseModerationRecord,
  readModerationPending,
  validateModerationReceipt,
  type ModerationRecord,
  type ModerationPending,
} from "@/lib/admin/work-review-moderation";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { ReviewModerationForm } from "./review-moderation-form";
import { MutationReview, type MutationProposal } from "./mutation-review";
const statuses = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };
export function StaffReviews() {
  const session = useAccountSession();
  if (!session) return null;
  return session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" ? (
    <ModerationAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <div className="work-inspections work-moderation">
      <h1>Review moderation</h1>
      <Feedback message="Administrator access is required to moderate reviews." />
    </div>
  );
}
function ModerationAccess({ owner, role }: { owner: string; role: string }) {
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
      <div className="work-inspections work-moderation">
        <h1>Review moderation</h1>
        {error ? (
          <Feedback message={error} />
        ) : (
          <p role="status">Checking moderation access…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh moderation access
        </button>
      </div>
    );
  return <ModerationWorkspace owner={owner} role={role} refreshAccess={access.refresh} />;
}
function useModerationRows(path: string | null) {
  const parse = useCallback(
    (value: unknown) =>
      parseModerationPage(value, new URLSearchParams(path?.split("?")[1])),
    [path],
  );
  return useResource(path, parse);
}
function ModerationWorkspace({
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
    query = moderationQuery(new URLSearchParams(search.toString())),
    records = useModerationRows(query.path),
    active = useRef(true),
    request = useRef<AbortController | null>(null);
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [pending, setPending] = useState<ModerationPending | undefined>(() =>
      readModerationPending(owner, role),
    ),
    [message, setMessage] = useState<string>(),
    [tone, setTone] = useState<"error" | "success">("error"),
    [unavailable, setUnavailable] = useState(false),
    [checking, setChecking] = useState(false),
    [generation, setGeneration] = useState(0),
    [observed, setObserved] = useState<ModerationRecord>(),
    [inspected, setInspected] = useState<ModerationRecord>(),
    [saved, setSaved] = useState<ModerationRecord>();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const deny = useCallback(() => {
    setUnavailable(true);
    setObserved(undefined);
    setInspected(undefined);
    setSaved(undefined);
    refreshAccess();
  }, [refreshAccess, setUnavailable, setObserved, setInspected, setSaved]);
  useEffect(() => {
    if (!records.denied) return;
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) deny();
    });
    return () => {
      mounted = false;
    };
  }, [records.denied, deny]);
  const busy = records.loading || records.refreshing || checking,
    error = records.error || records.refreshError,
    rows =
      unavailable || records.denied
        ? undefined
        : records.data?.items
            .map((r) =>
              observed?.id === r.id && observed.version > r.version ? observed : r,
            )
            .filter((r) => r.status === (query.params.get("status") ?? "PENDING")),
    selected = query.params.get("selected"),
    current = rows?.find((r) => r.id === selected),
    disabled = busy || !!error || !!pending || unavailable || query.invalid;
  function navigate(params: URLSearchParams) {
    router.push(`/admin/reviews?${params}`, { scroll: false });
  }
  function identity(signal: AbortSignal) {
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Moderation account changed");
  }
  async function freshAccess(signal: AbortSignal) {
    const p = parseOwnStaffProfile((await apiRequest("/staff/profile", { signal })).data);
    identity(signal);
    if (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
  }
  async function fresh(id: string, signal: AbortSignal) {
    await freshAccess(signal);
    const row = parseModerationRecord(
      (await apiRequest(`/staff/support/reviews/${id}`, { signal })).data,
      id,
    );
    identity(signal);
    return row;
  }
  function notSent() {
    const e = new ApiError(400, { error: { code: "REQUEST_FAILED" } });
    e.message =
      "No decision was sent. Current access, reviewed feedback or recovery storage could not be confirmed. Your fields are kept; refresh and reload affected fields before reviewing again.";
    return e;
  }
  function review(offer: MutationProposal) {
    const change = offer.moderationChange;
    if (disabled || proposal || !current || !change || change.review.id !== current.id)
      return;
    const before = current,
      snapshot = moderationSnapshot(before),
      url = window.location.href;
    let sent = false,
      marker: Exclude<ModerationPending, "unknown"> | undefined;
    setMessage(undefined);
    setTone("error");
    setProposal({
      ...offer,
      retrySafely: false,
      retryAfterRejection: false,
      onUncertain: () => {
        if (sent && active.current)
          setPending(readModerationPending(owner, role) ?? "unknown");
      },
      submit: async () => {
        if (request.current || !active.current) throw notSent();
        const c = new AbortController();
        request.current = c;
        try {
          const latest = await fresh(before.id, c.signal);
          if (latest.version < before.version) throw notSent();
          if (moderationSnapshot(latest) !== snapshot) {
            setObserved(latest);
            records.refresh();
            throw notSent();
          }
          if (latest.status !== "PENDING" || window.location.href !== url)
            throw notSent();
          marker = markModerationPending(owner, role, change);
          sent = true;
          setPending(marker);
          const response = await offer.submit();
          identity(c.signal);
          const receipt = validateModerationReceipt(response, change),
            updated = { ...latest, ...receipt };
          forgetModerationDraft(owner, role, before.id);
          setObserved(updated);
          setSaved(updated);
          try {
            clearModerationPending(owner, role, marker.token);
            setPending(undefined);
          } catch {
            setPending(readModerationPending(owner, role) ?? "unknown");
          }
          setTone("success");
          setMessage(
            "Moderation decision saved. Review the exact saved decision and customer-visible note below.",
          );
          records.refresh();
        } catch (e) {
          const submitted = sent;
          if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
          if (sent && e instanceof ApiError && [408, 429].includes(e.status))
            throw Error("Moderation outcome needs reconciliation");
          if (sent && e instanceof ApiError && e.status >= 400 && e.status < 500) {
            clearModerationPending(owner, role, marker!.token);
            sent = false;
            setPending(undefined);
          }
          if (!sent) {
            setPending(readModerationPending(owner, role));
            if (submitted) throw e;
            throw notSent();
          }
          throw e;
        } finally {
          request.current = null;
        }
      },
    });
  }
  async function loadCurrent() {
    if (request.current || proposal) return;
    const id =
      pending && pending !== "unknown"
        ? pending.reviewId
        : (selected ?? query.params.get("reviewId"));
    if (!id) {
      setTone("error");
      setMessage(
        "Choose the relevant review or enter its exact reference before loading the current record.",
      );
      return;
    }
    const c = new AbortController();
    request.current = c;
    setChecking(true);
    setTone("error");
    setMessage(undefined);
    try {
      const row = await fresh(id, c.signal);
      if (pending) {
        forgetModerationDraft(owner, role, id);
        clearModerationPending(owner, role);
        setPending(undefined);
        setGeneration((v) => v + 1);
      }
      setObserved(row);
      setInspected(row);
      setSaved(undefined);
      setUnavailable(false);
      setTone("success");
      setMessage(
        "Current review loaded. No decision was resent; the original request outcome is not proven. This review's unsaved moderation fields were replaced.",
      );
      records.refresh();
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
      if (active.current)
        setMessage(
          "The current review could not be confirmed. Check access and the review reference, then try again. No decision was resent.",
        );
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
    setTone("error");
    setMessage(undefined);
    try {
      await freshAccess(c.signal);
      setUnavailable(false);
      records.refresh();
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
      if (active.current)
        setMessage("Moderation access could not be confirmed. No decision was resent.");
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  function show(row: ModerationRecord) {
    const p = new URLSearchParams({ status: row.status, reviewId: row.id });
    if (row.status === "PENDING") p.set("selected", row.id);
    navigate(p);
  }
  return (
    <div
      className="work-inspections work-moderation"
      data-moderation-owner={`${owner}:${role}`}
    >
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Review moderation</span>
          </li>
        </ol>
      </nav>
      <header className="wi-header">
        <div>
          <h1>Review moderation</h1>
          <p>
            Review customer feedback before public display. Queue reads are recorded in
            the audit log.
          </p>
        </div>
        <div className="wm-actions">
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={refreshAccess}
          >
            Refresh moderation access
          </button>
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => (unavailable ? void restoreQueue() : records.refresh())}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh moderation queue
          </button>
        </div>
      </header>
      <p className="wm-guidance">
        Approval allows public display. Moderation notes are visible to the customer in
        their account; they are not public review text. Decisions cannot be changed here.
      </p>
      <Feedback message={message} tone={tone} />
      {pending && (
        <section className="wi-state">
          <h2>A moderation decision needs reconciliation</h2>
          <p>
            Load the current review before another decision. This replaces the affected
            review&apos;s unsaved fields without resending or proving the original
            outcome. If the stored reference is unavailable, select the relevant review or
            use its exact reference.
          </p>
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => void loadCurrent()}
          >
            Load current review
          </button>
        </section>
      )}
      <ModerationFilters
        key={`${query.params.get("status")}:${query.params.get("targetType")}:${query.params.get("reviewId")}`}
        params={query.params}
        disabled={busy || !!proposal}
        navigate={navigate}
      />
      {saved && !unavailable && !records.denied && (
        <section className="wi-card wm-saved" aria-labelledby="wm-saved">
          <h2 id="wm-saved">Last confirmed decision</h2>
          <p>
            <strong>{statuses[saved.status]}</strong> ·{" "}
            {saved.title || reviewLabels[saved.targetType]}
          </p>
          <p>
            Review reference: {saved.id} · Version {saved.version}
          </p>
          <p className="preserve-lines">
            Customer-visible note: {saved.moderationNote ?? "No note recorded"}
          </p>
          <p>{formatStockInstant(saved.moderatedAt)}</p>
          <button className="button secondary" onClick={() => setSaved(undefined)}>
            Dismiss saved decision
          </button>
        </section>
      )}
      {query.invalid ? (
        <section className="wi-state">
          <h2>Moderation filters unavailable</h2>
          <p>This link contains unsupported or invalid review filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams({ status: "PENDING" }))}
          >
            Reset moderation filters
          </button>
        </section>
      ) : (
        <>
          {busy && (
            <p className="wi-state" role="status">
              {rows ? "Refreshing moderation queue…" : "Checking review submissions…"}
            </p>
          )}
          {(error || unavailable) && (
            <section className="wi-state">
              <Feedback
                message={
                  error ??
                  "Review data is unavailable under your current administrator access."
                }
              />
              {rows && (
                <p>
                  Previously loaded reviews are shown. Decisions remain disabled until a
                  fresh read succeeds.
                </p>
              )}
              <button
                className="button secondary"
                disabled={busy || !!proposal}
                onClick={() => (unavailable ? void restoreQueue() : records.refresh())}
              >
                Retry moderation queue
              </button>
            </section>
          )}
          {inspected &&
            !unavailable &&
            !records.denied &&
            !rows?.some((r) => r.id === inspected.id) && (
              <section className="wm-current">
                <h2>Current review after refresh</h2>
                <ModerationCard
                  row={inspected}
                  expanded={false}
                  disabled
                  onSelect={() => {}}
                />
                <button
                  className="button secondary"
                  disabled={busy || !!proposal}
                  onClick={() => show(inspected)}
                >
                  Show this review in queue
                </button>
              </section>
            )}
          {rows && (
            <>
              <div className="wm-page">
                <h2>Submitted reviews</h2>
                <p>
                  {rows.length} {rows.length === 1 ? "review" : "reviews"} on this page ·
                  Oldest first
                </p>
              </div>
              {!rows.length && (
                <section className="wi-state">
                  <h3>No reviews match this page and filters</h3>
                  <p>
                    Change filters or return to the first page to inspect other recorded
                    reviews.
                  </p>
                </section>
              )}
              {selected && !current && (
                <div className="wi-state">
                  <p>
                    The selected review is not on this page. A decision may have moved it
                    to another status.
                  </p>
                  <button
                    className="button secondary"
                    disabled={busy || !!proposal}
                    onClick={() => void loadCurrent()}
                  >
                    Load selected review
                  </button>
                </div>
              )}
              <div key={generation} className="wm-reviews">
                {rows.map((row) => (
                  <ModerationCard
                    key={row.id}
                    row={row}
                    expanded={selected === row.id}
                    disabled={disabled}
                    selectingDisabled={busy || !!proposal}
                    onSelect={() => {
                      const p = new URLSearchParams(query.params);
                      if (selected === row.id) p.delete("selected");
                      else p.set("selected", row.id);
                      navigate(p);
                    }}
                    onReview={review}
                  />
                ))}
              </div>
              <nav className="wi-pagination" aria-label="Moderation pages">
                <button
                  className="button secondary"
                  disabled={!query.params.has("cursor") || busy || !!proposal}
                  onClick={() => {
                    const p = moderationPageParams(query.params, undefined, true);
                    p.delete("selected");
                    navigate(p);
                  }}
                >
                  Previous
                </button>
                {query.params.has("cursor") && (
                  <button
                    className="button secondary"
                    disabled={busy || !!proposal}
                    onClick={() => {
                      const p = new URLSearchParams(query.params);
                      p.delete("cursor");
                      p.delete("_trail");
                      p.delete("selected");
                      navigate(p);
                    }}
                  >
                    First page
                  </button>
                )}
                <button
                  className="button secondary"
                  disabled={!records.data?.nextCursor || busy || !!error || !!proposal}
                  onClick={() => {
                    const p = moderationPageParams(
                      query.params,
                      records.data?.nextCursor,
                    );
                    p.delete("selected");
                    navigate(p);
                  }}
                >
                  Next
                </button>
              </nav>
            </>
          )}
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
function ModerationCard({
  row: r,
  expanded,
  disabled,
  selectingDisabled,
  onSelect,
  onReview,
}: {
  row: ModerationRecord;
  expanded: boolean;
  disabled: boolean;
  selectingDisabled?: boolean;
  onSelect: () => void;
  onReview?: (p: MutationProposal) => void;
}) {
  return (
    <article className="wi-card wm-review">
      <header className="wm-review-header">
        <div>
          <h2>{r.title || r.product?.name || r.service?.name || "Customer feedback"}</h2>
          <div className="wm-badges">
            <span
              className="wm-rating"
              role="img"
              aria-label={`${r.rating} out of 5 stars`}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={16}
                  aria-hidden="true"
                  className={n <= r.rating ? "filled" : undefined}
                />
              ))}
              <span aria-hidden="true">{r.rating} / 5</span>
            </span>
            <span>{reviewLabels[r.targetType]}</span>
            <span
              className={`wm-status ${r.status.toLowerCase()}`}
              data-status={r.status}
            >
              {statuses[r.status]}
            </span>
          </div>
        </div>
        {r.status === "PENDING" && onReview && (
          <button
            className="button secondary"
            aria-expanded={expanded}
            disabled={selectingDisabled}
            onClick={onSelect}
          >
            {expanded ? "Hide decision form" : "Review decision"}
          </button>
        )}
      </header>
      <div
        className={`wm-review-body${expanded && r.status === "PENDING" ? " selected" : ""}`}
      >
        <div className="wm-review-details">
          <dl className="wm-facts">
            {[
              { label: "Review reference", value: r.id },
              { label: "Version", value: String(r.version) },
              {
                label: "Submitted by",
                value:
                  `${r.customer.firstName} ${r.customer.lastName}`.trim() || "Customer",
              },
              { label: "Created", value: formatStockInstant(r.createdAt) },
              { label: "Updated", value: formatStockInstant(r.updatedAt) },
              ...(r.moderatedAt
                ? [{ label: "Moderated", value: formatStockInstant(r.moderatedAt) }]
                : []),
            ].map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <h3>Customer feedback</h3>
          <p className="preserve-lines wm-comment">{r.comment}</p>
          <ReviewSource row={r} />
          {r.status !== "PENDING" && (
            <section className="wm-note">
              <h3>Customer-visible moderation note</h3>
              <p className="preserve-lines">{r.moderationNote ?? "No note recorded"}</p>
              <p>This decision is read-only. It cannot be changed through this screen.</p>
            </section>
          )}
        </div>
        {expanded && r.status === "PENDING" && onReview && (
          <section className="wm-decision" aria-label="Moderation decision">
            <h3>Moderation decision</h3>
            <ReviewModerationForm
              review={r}
              disabled={disabled}
              onReview={onReview}
              onSaved={() => {}}
              onUncertain={() => {}}
            />
          </section>
        )}
      </div>
    </article>
  );
}
function ReviewSource({ row: r }: { row: ModerationRecord }) {
  const fields: { label: string; value: React.ReactNode }[] =
    r.targetType === "PRODUCT"
      ? [
          {
            label: "Product",
            value: <Link href={`/admin/products/${r.productId}`}>{r.product?.name}</Link>,
          },
          { label: "Product reference", value: r.productId },
          { label: "Order item reference", value: r.orderItemId },
          {
            label: "Source order reference",
            value: (
              <Link href={`/admin/orders/${r.orderItem?.orderId}`}>
                {r.orderItem?.orderId}
              </Link>
            ),
          },
        ]
      : r.targetType === "SERVICE"
        ? [
            {
              label: "Service",
              value: (
                <Link href={`/admin/services/${r.serviceId}`}>{r.service?.name}</Link>
              ),
            },
            { label: "Service reference", value: r.serviceId },
            {
              label: "Booking reference",
              value: <Link href={`/admin/bookings/${r.bookingId}`}>{r.bookingId}</Link>,
            },
            {
              label: "Completed",
              value: r.booking?.completedAt
                ? formatStockInstant(r.booking.completedAt)
                : "Not recorded",
            },
          ]
        : r.targetType === "ORDER"
          ? [
              { label: "Order", value: r.order?.orderNumber ?? "Not recorded" },
              {
                label: "Order reference",
                value: <Link href={`/admin/orders/${r.orderId}`}>{r.orderId}</Link>,
              },
            ]
          : r.targetType === "VEHICLE_TRANSACTION"
            ? [
                {
                  label: "Vehicle purchase",
                  value: r.vehicleTransaction?.transactionNumber ?? "Not recorded",
                },
                {
                  label: "Purchase reference",
                  value: (
                    <Link href={`/admin/vehicle-sales/${r.vehicleTransactionId}`}>
                      {r.vehicleTransactionId}
                    </Link>
                  ),
                },
              ]
            : [];
  return (
    <section className="wm-source">
      <h3>Supporting source</h3>
      {fields.length ? (
        <dl className="wm-facts">
          {fields.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Overall experience has no linked purchase reference.</p>
      )}
    </section>
  );
}
function ModerationFilters({
  params,
  disabled,
  navigate,
}: {
  params: URLSearchParams;
  disabled: boolean;
  navigate: (p: URLSearchParams) => void;
}) {
  const [error, setError] = useState<string>();
  return (
    <form
      className="wi-filters wm-filters"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        const values = new FormData(e.currentTarget),
          id = String(values.get("reviewId") ?? "").trim();
        if (id && !z.uuid().safeParse(id).success) {
          setError("Enter an exact review UUID or leave the reference empty.");
          e.currentTarget
            .querySelector<HTMLInputElement>("#moderation-reference")
            ?.focus();
          return;
        }
        const p = new URLSearchParams({ status: String(values.get("status")) });
        const type = String(values.get("targetType") ?? "");
        if (type) p.set("targetType", type);
        if (id) p.set("reviewId", id.toLowerCase());
        setError(undefined);
        navigate(p);
      }}
    >
      <fieldset disabled={disabled}>
        <legend className="sr-only">Filter review moderation</legend>
        <div className="field">
          <label htmlFor="moderation-status">Review status</label>
          <select
            id="moderation-status"
            name="status"
            defaultValue={params.get("status") ?? "PENDING"}
          >
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="moderation-target">Review type</label>
          <select
            id="moderation-target"
            name="targetType"
            defaultValue={params.get("targetType") ?? ""}
          >
            <option value="">All types</option>
            {reviewTargets.map((value) => (
              <option key={value} value={value}>
                {reviewLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="moderation-reference">Review reference</label>
          <input
            id="moderation-reference"
            name="reviewId"
            maxLength={36}
            defaultValue={params.get("reviewId") ?? ""}
            aria-invalid={!!error}
            aria-describedby="moderation-reference-error"
          />
          <p id="moderation-reference-error" className="field-error">
            {error}
          </p>
        </div>
        <div className="wm-actions">
          <button className="button">Apply moderation filters</button>
          <button
            className="button secondary"
            type="button"
            onClick={() => navigate(new URLSearchParams({ status: "PENDING" }))}
          >
            Clear filters
          </button>
        </div>
      </fieldset>
    </form>
  );
}
