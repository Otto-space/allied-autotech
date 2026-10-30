"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseWorkBookingList } from "@/lib/api/work-booking-list-schema";
import { parseStaffProfile, parseStaffProfiles } from "@/lib/api/staff-booking-schemas";
import { workBookingQuery } from "@/lib/work-booking-query";
import { bookingStatuses, bookingLabel } from "@/lib/customer-booking-query";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";

export function StaffBookings() {
  const session = useAccountSession();
  if (!session || !["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return null;
  return (
    <BookingList
      key={`${session.user.id}:${session.user.role}`}
      admin={session.user.role !== "STAFF"}
    />
  );
}
function BookingList({ admin }: { admin: boolean }) {
  const search = useSearchParams();
  const { params, api, path, invalid } = workBookingQuery(
    new URLSearchParams(search.toString()),
    admin,
  );
  const bookings = useResource(path, parseWorkBookingList);
  const cursor = params.get("cursor");
  const trail = params.get("_trail")?.split(",") ?? [];
  const filters = new URLSearchParams(params);
  filters.delete("cursor");
  filters.delete("_trail");
  const filtered = filters.size > 0;
  const scopeMismatch = bookings.data?.items.some(
    (record) =>
      (api.has("status") && record.status !== api.get("status")) ||
      (api.has("branchId") && record.branch?.id !== api.get("branchId")) ||
      (api.has("assignedStaffId") &&
        record.assignedStaff?.id !== api.get("assignedStaffId")) ||
      (api.has("scheduledFrom") &&
        (!record.scheduledAt ||
          Date.parse(record.scheduledAt) < Date.parse(api.get("scheduledFrom")!))) ||
      (api.has("scheduledTo") &&
        (!record.scheduledAt ||
          Date.parse(record.scheduledAt) >= Date.parse(api.get("scheduledTo")!))),
  );
  const error =
    bookings.error ||
    (scopeMismatch
      ? "The returned records do not match your filters. Refresh to check the list."
      : undefined);
  const data = !invalid && !bookings.loading && !error ? bookings.data : undefined;
  const busy = bookings.loading || bookings.refreshing;
  function navigate(next: URLSearchParams, focus = false) {
    window.history.pushState(null, "", `/admin/bookings${next.size ? `?${next}` : ""}`);
    if (focus) {
      document.getElementById("work-booking-results")?.focus({ preventScroll: true });
      document
        .getElementById("work-booking-results")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }
  function clear() {
    navigate(new URLSearchParams());
    requestAnimationFrame(() => document.getElementById("staff-booking-status")?.focus());
  }
  function firstPage() {
    navigate(filters, true);
  }
  const dateSummary =
    params.has("from") || params.has("to")
      ? `${params.get("from") ?? "Any start"} to ${params.get("to") ?? "Any end"} · Lagos dates`
      : "Any appointment date";
  return (
    <div className="work-bookings">
      <nav className="work-booking-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Workshop bookings</span>
          </li>
        </ol>
      </nav>
      <header className="work-booking-heading">
        <div>
          <h1>Workshop bookings</h1>
          <p>
            Manage appointments, quotations and work orders within your permitted
            branches.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy || invalid}
          onClick={bookings.refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {busy ? "Updating bookings…" : "Refresh bookings"}
        </button>
      </header>
      <BookingFilters
        key={`${filters}:${invalid}`}
        initial={filters.toString()}
        admin={admin}
        onApply={navigate}
        onClear={clear}
      />
      {invalid && (
        <div className="work-booking-notice" role="alert">
          <p>
            These booking filters are invalid. Clear them and choose a valid status, date
            range or record.
          </p>
          <button className="button secondary" onClick={clear}>
            Clear invalid filters
          </button>
        </div>
      )}
      {bookings.refreshError && data && (
        <p className="work-booking-notice" role="status">
          Bookings may be out of date. Refresh to check the current records.
        </p>
      )}
      <section
        className="work-booking-results"
        aria-labelledby="work-booking-results"
        aria-busy={busy}
      >
        <div className="work-booking-band">
          <div>
            <h2 id="work-booking-results" tabIndex={-1}>
              Booking records
            </h2>
            <span role="status">
              {data
                ? `${data.items.length} ${data.items.length === 1 ? "booking" : "bookings"} on this page`
                : busy
                  ? "Checking workshop bookings…"
                  : "Records unavailable"}
            </span>
          </div>
          <p>
            {bookingLabel(params.get("status") ?? "ALL_STATUSES")} · {dateSummary}
            {params.has("branchId") ? " · Branch filtered" : ""}
            {params.has("assignedStaffId") ? " · Staff filtered" : ""}
          </p>
        </div>
        {bookings.loading && (
          <div className="work-booking-skeleton" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {!bookings.loading && error && (
          <div className="work-booking-state">
            <h3>Bookings unavailable</h3>
            <Feedback message={error} />
            <button className="button secondary" onClick={bookings.refresh}>
              Retry bookings
            </button>
          </div>
        )}
        {data && data.items.length > 0 && (
          <table className="work-booking-table">
            <caption className="sr-only">
              Workshop booking records. Appointments are shown in Lagos time.
            </caption>
            <thead>
              <tr>
                <th scope="col">Service &amp; appointment</th>
                <th scope="col">Branch</th>
                <th scope="col">Status</th>
                <th scope="col">Assigned staff</th>
                <th scope="col">Vehicle</th>
                <th scope="col">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((booking) => (
                <tr key={booking.id}>
                  <td className="work-booking-service">
                    <Link href={`/admin/bookings/${booking.id}`} prefetch={false}>
                      <strong>{booking.service?.name ?? "Vehicle concern"}</strong>
                      <span>{formatBusinessDate(booking.scheduledAt)}</span>
                      <span className="work-booking-ref">Ref {booking.id.slice(-8)}</span>
                    </Link>
                  </td>
                  <td data-label="Branch">{booking.branch?.name ?? "Not assigned"}</td>
                  <td className="work-booking-status" data-label="Status">
                    <span>{bookingLabel(booking.status)}</span>
                  </td>
                  <td data-label="Assigned staff">
                    {booking.assignedStaff
                      ? `${booking.assignedStaff.firstName} ${booking.assignedStaff.lastName}`
                      : "Not assigned"}
                  </td>
                  <td data-label="Vehicle">
                    <div>
                      {booking.vehicle ? (
                        <>
                          {booking.vehicle.year} {booking.vehicle.make}{" "}
                          {booking.vehicle.model}
                          {booking.vehicle.registrationNumber && (
                            <p>{booking.vehicle.registrationNumber}</p>
                          )}
                        </>
                      ) : (
                        "Not linked"
                      )}
                    </div>
                  </td>
                  <td className="work-booking-action">
                    <Link
                      href={`/admin/bookings/${booking.id}`}
                      prefetch={false}
                      aria-label={`View booking: ${booking.service?.name ?? "Vehicle concern"}`}
                    >
                      <span>View booking</span>
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.items.length === 0 && (
          <div className="work-booking-state">
            <CalendarDays size={28} aria-hidden="true" />
            <h3>
              {cursor
                ? "No bookings on this page"
                : filtered
                  ? "No bookings match these filters"
                  : "No workshop bookings yet"}
            </h3>
            <p>
              {cursor
                ? "Return to the first page to check the current list."
                : filtered
                  ? "Try another status or appointment date."
                  : "Booking requests will appear here when they are received."}
            </p>
            {cursor ? (
              <button className="button secondary" onClick={firstPage}>
                First page
              </button>
            ) : filtered ? (
              <button className="button secondary" onClick={clear}>
                Clear booking filters
              </button>
            ) : null}
          </div>
        )}
        <footer className="work-booking-footer">
          <p>Appointments follow the workshop record order.</p>
          <nav aria-label="Workshop bookings pages">
            <button
              className="button secondary"
              disabled={!trail.length || busy || invalid}
              onClick={() => {
                const next = new URLSearchParams(params);
                const previous = trail.at(-1)!;
                if (previous === "start") next.delete("cursor");
                else next.set("cursor", previous);
                const remaining = trail.slice(0, -1);
                if (remaining.length) next.set("_trail", remaining.join(","));
                else next.delete("_trail");
                navigate(next, true);
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Previous
            </button>
            <span>
              {cursor && !trail.length ? "Later page" : `Page ${trail.length + 1}`}
            </span>
            <button
              className="button secondary"
              disabled={!data?.nextCursor || busy}
              onClick={() => {
                if (!data?.nextCursor) return;
                const next = new URLSearchParams(params);
                next.set("cursor", data.nextCursor);
                if ((!cursor || trail.length) && trail.length < 50)
                  next.set("_trail", [...trail, cursor ?? "start"].join(","));
                else next.delete("_trail");
                navigate(next, true);
              }}
            >
              Next
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            {cursor && !trail.length && (
              <button className="text-link" onClick={firstPage}>
                First page
              </button>
            )}
          </nav>
        </footer>
      </section>
    </div>
  );
}

function BookingFilters({
  initial,
  admin,
  onApply,
  onClear,
}: {
  initial: string;
  admin: boolean;
  onApply: (params: URLSearchParams) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(new URLSearchParams(initial)),
  );
  const [expanded, setExpanded] = useState(!!draft.branchId || !!draft.assignedStaffId);
  const [error, setError] = useState<string>();
  const profile = useResource(
    !admin && expanded ? "/staff/profile" : null,
    parseStaffProfile,
  );
  function update(key: string, value: string) {
    setDraft((old) => ({ ...old, [key]: value }));
    setError(undefined);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = workBookingQuery(
      new URLSearchParams(Object.entries(draft).filter(([, value]) => !!value)),
      admin,
    );
    if (query.invalid) {
      setError("Choose valid dates in order, covering no more than 366 days.");
      document.getElementById("work-booking-to")?.focus();
      return;
    }
    onApply(query.params);
  }
  return (
    <form className="work-booking-filters" onSubmit={submit}>
      <div className="work-booking-filter-grid">
        <div className="field">
          <label htmlFor="staff-booking-status">Booking status</label>
          <select
            id="staff-booking-status"
            value={draft.status ?? ""}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {bookingStatuses.map((value) => (
              <option key={value} value={value}>
                {bookingLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="work-booking-from">Appointment from</label>
          <input
            type="date"
            id="work-booking-from"
            min="1000-01-01"
            max="9998-12-31"
            value={draft.from ?? ""}
            onChange={(e) => update("from", e.target.value)}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? "work-booking-date-error work-booking-date-hint"
                : "work-booking-date-hint"
            }
          />
        </div>
        <div className="field">
          <label htmlFor="work-booking-to">Appointment to</label>
          <input
            type="date"
            id="work-booking-to"
            min="1000-01-01"
            max="9998-12-31"
            value={draft.to ?? ""}
            onChange={(e) => update("to", e.target.value)}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? "work-booking-date-error work-booking-date-hint"
                : "work-booking-date-hint"
            }
          />
        </div>
        <div className="work-booking-filter-actions">
          <button type="submit" className="button">
            Apply filters
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setDraft({});
              setError(undefined);
              onClear();
            }}
          >
            Clear filters
          </button>
        </div>
      </div>
      <p id="work-booking-date-hint">Inclusive dates · Lagos time · Up to 366 days</p>
      {error && (
        <p id="work-booking-date-error" className="field-error" role="alert">
          {error}
        </p>
      )}
      <details open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)}>
        <summary>Branch &amp; staff filters</summary>
        {expanded && (
          <div className="work-booking-scope">
            {admin ? (
              <>
                <div className="field">
                  <label htmlFor="work-booking-branch">Branch</label>
                  <AdminBranchPicker
                    id="work-booking-branch"
                    activeOnly={false}
                    value={draft.branchId ?? ""}
                    onChange={(value) => {
                      setDraft((old) => ({
                        ...old,
                        branchId: value,
                        assignedStaffId: "",
                      }));
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="work-booking-staff">Assigned staff</label>
                  <BookingStaffFilter
                    key={draft.branchId ?? "all"}
                    branchId={draft.branchId}
                    value={draft.assignedStaffId ?? ""}
                    onChange={(value) => update("assignedStaffId", value)}
                  />
                </div>
              </>
            ) : (
              <div>
                <p>Bookings are limited to your assigned active branch.</p>
                <label className="work-booking-own">
                  <input
                    type="checkbox"
                    checked={
                      !!profile.data?.staffProfile &&
                      draft.assignedStaffId === profile.data.staffProfile.id
                    }
                    disabled={
                      profile.loading ||
                      profile.refreshing ||
                      !!profile.error ||
                      !!profile.refreshError ||
                      !profile.data?.staffProfile
                    }
                    onChange={(e) =>
                      update(
                        "assignedStaffId",
                        e.target.checked ? profile.data!.staffProfile!.id : "",
                      )
                    }
                  />
                  Only bookings assigned to me
                </label>
                <Feedback message={profile.error} />
                {profile.loading && <p role="status">Loading your staff profile…</p>}
                {profile.refreshError && (
                  <p role="status">
                    Your staff profile may be out of date. Refresh it before changing this
                    filter.
                  </p>
                )}
                {!profile.loading &&
                  !profile.error &&
                  profile.data &&
                  !profile.data.staffProfile && (
                    <p>A staff profile is needed to filter your own assignments.</p>
                  )}
                {profile.data?.staffProfile &&
                  draft.assignedStaffId &&
                  draft.assignedStaffId !== profile.data.staffProfile.id && (
                    <p>
                      A different staff assignment is selected. Clear filters to show all
                      permitted bookings, or select your own assignments.
                    </p>
                  )}
                {(profile.error || profile.refreshError) && (
                  <button type="button" className="text-link" onClick={profile.refresh}>
                    Retry staff profile
                  </button>
                )}
              </div>
            )}
            <button className="button secondary work-booking-scope-apply" type="submit">
              Apply branch &amp; staff filters
            </button>
          </div>
        )}
      </details>
    </form>
  );
}

function BookingStaffFilter({
  branchId,
  value,
  onChange,
}: {
  branchId?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pagination = useCursorPage();
  const [selectedLabel, setSelectedLabel] = useState("Selected staff member");
  const staff = useResource(
    `/admin/staff?limit=50${branchId ? `&branchId=${branchId}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseStaffProfiles,
  );
  const choices =
    !staff.error && !staff.loading
      ? (staff.data?.items.flatMap((item) =>
          item.staffProfile ? [{ ...item.staffProfile, status: item.status }] : [],
        ) ?? [])
      : [];
  return (
    <>
      <select
        id="work-booking-staff"
        value={value}
        onChange={(e) => {
          setSelectedLabel(
            e.target.selectedOptions[0]?.textContent ?? "Selected staff member",
          );
          onChange(e.target.value);
        }}
      >
        <option value="">All staff</option>
        {value && !choices.some((item) => item.id === value) && (
          <option value={value}>{selectedLabel}</option>
        )}
        {choices.map((item) => (
          <option key={item.id} value={item.id}>
            {item.firstName} {item.lastName}
            {item.status !== "ACTIVE" ? ` (${bookingLabel(item.status)})` : ""}
          </option>
        ))}
      </select>
      {staff.loading && <p role="status">Loading staff choices…</p>}
      <Feedback message={staff.error} />
      {staff.error && (
        <button type="button" className="text-link" onClick={staff.refresh}>
          Retry staff choices
        </button>
      )}
      {staff.refreshError && <p role="status">Staff choices may be out of date.</p>}
      {!staff.loading && !staff.error && !choices.length && (
        <p>No staff choices on this page.</p>
      )}
      {(staff.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={staff.data?.nextCursor}
          disabled={staff.loading || staff.refreshing || !!staff.error}
          label="Staff choices"
        />
      )}
    </>
  );
}
