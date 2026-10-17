"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { workSlotQuery } from "@/lib/work-slot-query";
import { parseWorkSlots } from "@/lib/api/work-slot-schema";
import { WorkSlotFilters } from "./work-slot-filters";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import { type staffSlotSchema } from "@/lib/api/staff-booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { StaffPicker } from "./staff-picker";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { Feedback } from "./feedback";
const slotFormSchema = z.object({
  branchId: z.string().uuid("Choose a branch."),
  serviceId: z.string().uuid("Choose a service."),
  staffId: z.string().uuid("Choose a staff member."),
  startsAt: z.string().min(1, "Choose an appointment time."),
});
type SlotForm = z.infer<typeof slotFormSchema>;
export function StaffBookingSlots() {
  const session = useAccountSession();
  if (!session || !["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return null;
  return (
    <SlotWorkspace
      key={`${session.user.id}:${session.user.role}`}
      admin={session.user.role !== "STAFF"}
    />
  );
}
function SlotWorkspace({ admin }: { admin: boolean }) {
  const profile = useOwnStaffPermissions();
  const search = useSearchParams();
  const { params, api, invalid, path } = workSlotQuery(
    new URLSearchParams(search.toString()),
    admin,
  );
  const slots = useResource(path, parseWorkSlots);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const [formKey, setFormKey] = useState(0);
  const own = profile.data?.staffProfile;
  // Keep an existing draft mounted through a failed permission refresh. The
  // current profile still controls every read and write; a session change remounts.
  const [author, setAuthor] = useState(own);
  if (own && author !== own) setAuthor(own);
  const profileBlocked =
    !admin &&
    (profile.loading ||
      profile.refreshing ||
      !!profile.error ||
      !!profile.refreshError ||
      !own?.branchId);
  const mismatch = slots.data?.items.some(
    (slot) =>
      (api.has("status") && slot.status !== api.get("status")) ||
      (api.has("branchId") && slot.branchId !== api.get("branchId")) ||
      (api.has("serviceId") && slot.serviceId !== api.get("serviceId")) ||
      (api.has("staffId") && slot.staff.id !== api.get("staffId")) ||
      (!admin && own?.branchId && slot.branchId !== own.branchId) ||
      (api.has("startsFrom") &&
        Date.parse(slot.startsAt) < Date.parse(api.get("startsFrom")!)) ||
      (api.has("startsTo") &&
        Date.parse(slot.startsAt) >= Date.parse(api.get("startsTo")!)),
  );
  const error =
    slots.error ||
    (mismatch
      ? "The returned slots do not match your filters. Refresh to check availability."
      : undefined);
  const data =
    !invalid && !slots.loading && !error && (admin || (!!own?.branchId && !profile.error))
      ? slots.data
      : undefined;
  const busy = slots.loading || slots.refreshing;
  const disabled =
    busy ||
    !!error ||
    !!slots.refreshError ||
    invalid ||
    !!proposal ||
    profileBlocked ||
    !data;
  const filters = new URLSearchParams(params);
  filters.delete("cursor");
  filters.delete("_trail");
  const cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  function navigate(next: URLSearchParams, focus = false) {
    window.history.pushState(
      null,
      "",
      `/admin/booking-slots${next.size ? `?${next}` : ""}`,
    );
    if (focus) {
      document.getElementById("slot-records")?.focus({ preventScroll: true });
      document
        .getElementById("slot-records")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }
  function clear() {
    navigate(new URLSearchParams());
    requestAnimationFrame(() => document.getElementById("slot-status-filter")?.focus());
  }
  function refresh() {
    slots.refresh();
    profile.refresh();
  }
  function change(slot: z.infer<typeof staffSlotSchema>) {
    if (disabled || (!admin && slot.staff.id !== own?.id)) return;
    const nextStatus = slot.status === "OPEN" ? "CLOSED" : "OPEN";
    const body: RequestBody<"/staff/booking-slots/{slotId}", "patch"> = {
      expectedVersion: slot.version,
      status: nextStatus,
    };
    setMessage(undefined);
    setProposal({
      title: `${nextStatus === "OPEN" ? "Open" : "Close"} this appointment slot?`,
      description:
        nextStatus === "CLOSED"
          ? "This removes the slot from new customer booking choices. It does not cancel an existing booking; handle any business disruption from that booking's record."
          : "The slot can appear in customer booking choices when it meets the booking policy and availability checks.",
      facts: [
        { label: "Service", value: slot.service.name },
        { label: "Branch", value: slot.branch.name },
        { label: "Staff", value: `${slot.staff.firstName} ${slot.staff.lastName}` },
        { label: "Starts", value: formatBusinessDate(slot.startsAt) },
      ],
      retryAfterRejection: false,
      submit: () =>
        apiRequest(`/staff/booking-slots/${slot.id}`, {
          method: "PATCH",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <div className="work-slots">
      <nav className="work-slot-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Appointment slots</span>
          </li>
        </ol>
      </nav>
      <header className="work-slot-heading">
        <div>
          <h1>Appointment slots</h1>
          <p>
            Set available appointment times for your workshop. Customers can request a
            time that meets the booking rules.
          </p>
        </div>
        <div className="work-slot-actions">
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh slots
          </button>
          {(admin || own?.branchId) && (
            <a className="button" href="#publish-slot">
              Publish slot
            </a>
          )}
        </div>
      </header>
      <WorkSlotFilters
        key={`${filters}:${invalid}`}
        initial={filters.toString()}
        admin={admin}
        ownId={own?.id}
        onApply={navigate}
        onClear={clear}
      />
      {invalid && (
        <div className="work-slot-notice" role="alert">
          <p>
            These slot filters are invalid. Clear them and choose a valid status, date
            range or record.
          </p>
          <button className="button secondary" onClick={clear}>
            Clear invalid filters
          </button>
        </div>
      )}
      {!admin && <Feedback message={profile.error || profile.refreshError} />}
      {!admin && profile.data && !own?.branchId && (
        <Feedback message="A staff profile is required to publish or manage appointment slots. Ask an administrator to complete your staff record." />
      )}
      <Feedback
        message={message}
        tone="success"
        toast="Appointment availability updated."
      />
      {slots.refreshError && data && (
        <p className="work-slot-notice" role="status">
          Slots may be out of date. Refresh before making changes.
        </p>
      )}
      <div className="work-slot-layout">
        <section
          className="work-slot-results"
          aria-labelledby="slot-records"
          aria-busy={busy}
        >
          <div className="work-slot-band">
            <h2 id="slot-records" tabIndex={-1}>
              Appointment records
            </h2>
            <span role="status">
              {data
                ? `${data.items.length} ${data.items.length === 1 ? "slot" : "slots"} on this page`
                : busy
                  ? "Checking appointment slots..."
                  : "Records unavailable"}
            </span>
          </div>
          <p className="work-slot-scope">
            Applied scope:{" "}
            {params.get("status") === "OPEN"
              ? "Open"
              : params.get("status") === "CLOSED"
                ? "Closed"
                : "All statuses"}{" "}
            /{" "}
            {params.has("from") || params.has("to")
              ? `${params.get("from") ?? "Any start"} to ${params.get("to") ?? "Any end"} (Lagos dates)`
              : "Any start date"}
            {params.has("branchId") ? " / Branch filtered" : ""}
            {params.has("serviceId") ? " / Service filtered" : ""}
            {params.has("staffId") ? " / Staff filtered" : ""}
          </p>
          {slots.loading && (
            <div className="work-slot-skeleton" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          )}
          {!slots.loading && error && (
            <div className="work-slot-state">
              <h3>Appointment slots unavailable</h3>
              <Feedback message={error} />
              <button className="button secondary" onClick={refresh}>
                Retry slots
              </button>
            </div>
          )}
          {data && data.items.length > 0 && (
            <table className="work-slot-table">
              <caption className="sr-only">
                Appointment slots. All times are shown in Lagos time.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Service &amp; branch</th>
                  <th scope="col">Appointment</th>
                  <th scope="col">Staff</th>
                  <th scope="col">Status</th>
                  <th scope="col">Availability</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((slot) => (
                  <tr key={slot.id}>
                    <td data-label="Service">
                      <strong>{slot.service.name}</strong>
                      <span className="work-slot-meta">{slot.branch.name}</span>
                    </td>
                    <td data-label="Appointment">
                      <time dateTime={slot.startsAt}>
                        {formatBusinessDate(slot.startsAt)}
                      </time>
                      <span className="work-slot-meta">
                        Ends{" "}
                        <time dateTime={slot.endsAt}>
                          {formatBusinessDate(slot.endsAt)}
                        </time>
                      </span>
                    </td>
                    <td data-label="Staff">
                      {slot.staff.firstName} {slot.staff.lastName}
                    </td>
                    <td data-label="Status">
                      <span className={`work-slot-status ${slot.status.toLowerCase()}`}>
                        {slot.status === "OPEN" ? "Open" : "Closed"}
                      </span>
                    </td>
                    <td data-label="Availability">
                      {admin || slot.staff.id === own?.id ? (
                        <button
                          className="button secondary"
                          disabled={disabled}
                          onClick={() => change(slot)}
                        >
                          {slot.status === "OPEN" ? "Close slot" : "Open slot"}
                        </button>
                      ) : (
                        <span className="work-slot-meta">
                          Assigned staff or administrator manages this slot.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data && data.items.length === 0 && (
            <div className="work-slot-state">
              <CalendarDays size={24} aria-hidden="true" />
              <h3>No appointment slots match this page and filter.</h3>
              <p>
                {filters.size
                  ? "Try a different status, date or scope."
                  : "Publish a future appointment slot to make workshop time available."}
              </p>
              {filters.size > 0 && (
                <button className="button secondary" onClick={clear}>
                  Clear slot filters
                </button>
              )}
              {cursor && (
                <button
                  className="button secondary"
                  onClick={() => navigate(filters, true)}
                >
                  Return to first page
                </button>
              )}
            </div>
          )}
          <footer className="work-slot-footer">
            <p>Earliest appointment first. All times are in Lagos.</p>
            <nav aria-label="Appointment slots pagination">
              <button
                className="button secondary"
                disabled={busy || !cursor || !!error || invalid}
                onClick={() => {
                  const next = new URLSearchParams(filters),
                    previous = trail.at(-1);
                  if (previous && previous !== "start") next.set("cursor", previous);
                  if (trail.length > 1) next.set("_trail", trail.slice(0, -1).join(","));
                  navigate(next, true);
                }}
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Previous
              </button>
              <span>
                {cursor
                  ? trail.length
                    ? `Page ${trail.length + 1}`
                    : "Linked page"
                  : "Page 1"}
              </span>
              <button
                className="button secondary"
                disabled={busy || !!error || invalid || !data?.nextCursor}
                onClick={() => {
                  if (!data?.nextCursor) return;
                  const next = new URLSearchParams(filters);
                  next.set("cursor", data.nextCursor);
                  if (trail.length < 50 && (!cursor || trail.length))
                    next.set("_trail", [...trail, cursor ?? "start"].join(","));
                  navigate(next, true);
                }}
              >
                Next
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </nav>
          </footer>
        </section>
        {(admin || author?.branchId) && (
          <SlotCreateForm
            key={`${formKey}:${admin ? "admin" : author?.id}:${admin ? "all" : author?.branchId}`}
            disabled={disabled}
            own={admin ? undefined : (author ?? undefined)}
            onReview={setProposal}
            onSaved={() => setFormKey((key) => key + 1)}
          />
        )}
      </div>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            slots.refresh();
          }}
          onSuccess={() =>
            setMessage("Slot change recorded. Review the refreshed availability.")
          }
        />
      )}
    </div>
  );
}
function SlotCreateForm({
  disabled,
  onReview,
  onSaved,
  own,
}: {
  disabled: boolean;
  own?: { id: string; branchId: string | null; firstName: string; lastName: string };
  onReview: (proposal: MutationProposal) => void;
  onSaved: () => void;
}) {
  const [uncertain, setUncertain] = useState(false);
  const [branchBlocked, setBranchBlocked] = useState(true);
  const [serviceBlocked, setServiceBlocked] = useState(true);
  const [staffBlocked, setStaffBlocked] = useState(true);
  const form = useForm<SlotForm>({
    resolver: zodResolver(slotFormSchema),
    shouldFocusError: false,
    defaultValues: {
      branchId: own?.branchId ?? "",
      serviceId: "",
      staffId: own?.id ?? "",
      startsAt: "",
    },
  });
  const branchId = useWatch({ control: form.control, name: "branchId" });
  const errors = form.formState.errors;
  function review(values: SlotForm, submittedAt: number) {
    if (disabled || uncertain || branchBlocked || serviceBlocked || staffBlocked) return;
    const startsAt = `${values.startsAt}:00+01:00`;
    if (
      !z.iso.datetime({ offset: true }).safeParse(startsAt).success ||
      new Date(startsAt).getTime() <= submittedAt
    ) {
      form.setError(
        "startsAt",
        { message: "Choose a future appointment time in Lagos time." },
        { shouldFocus: true },
      );
      return;
    }
    const body: RequestBody<"/staff/booking-slots", "post"> = { ...values, startsAt };
    const selected = (id: string) =>
      (document.getElementById(id) as HTMLSelectElement | null)?.selectedOptions[0]
        ?.textContent ?? "Selected record";
    onReview({
      title: "Publish this appointment slot?",
      description:
        "The server uses the service duration to calculate the end time and checks the staff member's branch and existing slot schedule before saving.",
      facts: [
        { label: "Branch", value: selected("new-slot-branch") },
        { label: "Service", value: selected("new-slot-service") },
        { label: "Staff", value: selected("new-slot-staff") },
        { label: "Starts", value: formatBusinessDate(startsAt) },
      ],
      retryAfterRejection: false,
      onUncertain: () => setUncertain(true),
      submit: async () => {
        await apiRequest("/staff/booking-slots", { method: "POST", csrf: true, body });
        onSaved();
      },
    });
  }
  return (
    <section
      className="work-slot-create"
      id="publish-slot"
      aria-labelledby="publish-slot-heading"
    >
      <h2 id="publish-slot-heading" tabIndex={-1}>
        Publish an appointment slot
      </h2>
      <p>
        Choose a branch, service and staff member, then set the start time. The service
        must have a price and duration before you can select it.
      </p>
      <Feedback
        message={
          uncertain
            ? "The save outcome is uncertain. Review the refreshed slot list before creating another slot. This form cannot be resubmitted."
            : undefined
        }
      />
      <form
        data-draft-key="staff-booking-slots:1"
        onSubmit={(event) => {
          const submittedAt = Date.now();
          void form.handleSubmit(
            (values) => review(values, submittedAt),
            (validation) => {
              const first = (
                ["branchId", "serviceId", "staffId", "startsAt"] as const
              ).find((name) => validation[name]);
              if (first) form.setFocus(first);
            },
          )(event);
        }}
        noValidate
      >
        <fieldset disabled={disabled || uncertain}>
          <div className="field">
            <label htmlFor="new-slot-branch">Appointment branch</label>
            <Controller
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <SlotCatalogPicker
                  kind="branch"
                  branchId={own?.branchId ?? undefined}
                  onAvailabilityChange={setBranchBlocked}
                  id="new-slot-branch"
                  error={errors.branchId?.message}
                  inputRef={field.ref}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("staffId", own?.id ?? "");
                  }}
                />
              )}
            />
          </div>
          <div className="field">
            <label htmlFor="new-slot-service">Appointment service</label>
            <Controller
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <SlotCatalogPicker
                  kind="service"
                  onAvailabilityChange={setServiceBlocked}
                  id="new-slot-service"
                  error={errors.serviceId?.message}
                  inputRef={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          {branchId ? (
            <div className="field">
              <label htmlFor="new-slot-staff">Appointment staff member</label>
              <Controller
                control={form.control}
                name="staffId"
                render={({ field }) => (
                  <StaffPicker
                    key={branchId}
                    onAvailabilityChange={setStaffBlocked}
                    id="new-slot-staff"
                    error={errors.staffId?.message}
                    branchId={branchId}
                    name={field.name}
                    initialId={field.value}
                    onSelect={field.onChange}
                    inputRef={field.ref}
                  />
                )}
              />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="new-slot-staff">Appointment staff member</label>
              <select id="new-slot-staff" disabled aria-describedby="new-slot-staff-hint">
                <option>Choose a branch first</option>
              </select>
              <p className="field-hint" id="new-slot-staff-hint">
                Staff choices depend on the appointment branch.
              </p>
            </div>
          )}
          <div className="field">
            <label htmlFor="new-slot-time">Appointment starts (Lagos time)</label>
            <input
              id="new-slot-time"
              type="datetime-local"
              {...form.register("startsAt")}
              aria-invalid={!!errors.startsAt}
              aria-describedby="new-slot-time-hint"
            />
            <p
              id="new-slot-time-hint"
              className={errors.startsAt ? "field-error" : "field-hint"}
              role={errors.startsAt ? "alert" : undefined}
            >
              {errors.startsAt?.message ?? "Port Harcourt local time, UTC+01:00."}
            </p>
          </div>
          <button
            className="button"
            disabled={branchBlocked || serviceBlocked || (!!branchId && staffBlocked)}
          >
            Review new slot
          </button>
        </fieldset>
      </form>
      <p className="work-slot-create-note">
        The service duration determines the end time. Customer availability also depends
        on the booking rules.
      </p>
    </section>
  );
}
