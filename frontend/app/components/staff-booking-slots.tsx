"use client";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import {
  parseStaffSlots,
  parseStaffProfile,
  type staffSlotSchema,
} from "@/lib/api/staff-booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
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
  const profile = useResource("/staff/profile", parseStaffProfile);
  const pagination = useCursorPage();
  const [status, setStatus] = useState("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const [formKey, setFormKey] = useState(0);
  const slots = useResource(
    `/staff/booking-slots?limit=25${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseStaffSlots,
  );
  const disabled = slots.loading || !!slots.error || !!proposal;
  function change(slot: z.infer<typeof staffSlotSchema>) {
    if (disabled) return;
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
      submit: () =>
        apiRequest(`/staff/booking-slots/${slot.id}`, {
          method: "PATCH",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <>
      <h1>Appointment slots</h1>
      <p className="lead">
        Publish service availability and manage open slots within your permitted branches.
        Customer booking windows and availability remain controlled by the server.
      </p>
      <Feedback message={slots.error} />
      <Feedback message={profile.error} />
      <Feedback message={message} tone="success" />
      <div className="field">
        <label htmlFor="slot-status-filter">Slot status</label>
        <select
          id="slot-status-filter"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>
      <button
        className="button secondary"
        disabled={slots.loading || !!proposal}
        onClick={() => {
          slots.refresh();
          profile.refresh();
        }}
      >
        Refresh slots
      </button>
      {slots.loading && <p role="status">Checking appointment slots…</p>}
      <div
        className="table-region"
        role="region"
        aria-label="Appointment slots"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Service & branch</th>
              <th>Appointment</th>
              <th>Staff</th>
              <th>Status</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {slots.data?.items.map((slot) => (
              <tr key={slot.id}>
                <td>
                  {slot.service.name}
                  <p className="muted">{slot.branch.name}</p>
                </td>
                <td>
                  {formatBusinessDate(slot.startsAt)}
                  <p className="muted">Ends {formatBusinessDate(slot.endsAt)}</p>
                </td>
                <td>
                  {slot.staff.firstName} {slot.staff.lastName}
                </td>
                <td>{slot.status}</td>
                <td>
                  {session?.user.role !== "STAFF" ||
                  slot.staff.id === profile.data?.staffProfile?.id ? (
                    <button
                      className="button secondary"
                      disabled={disabled}
                      onClick={() => change(slot)}
                    >
                      {slot.status === "OPEN" ? "Close slot" : "Open slot"}
                    </button>
                  ) : (
                    <span className="muted">
                      Assigned staff or administrator manages this slot.
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!slots.loading && !slots.error && slots.data?.items.length === 0 && (
        <p className="empty">No appointment slots match this page and filter.</p>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={slots.data?.nextCursor}
        disabled={disabled}
        label="Appointment slots"
      />
      <SlotCreateForm
        key={formKey}
        disabled={
          disabled || profile.loading || !!profile.error || !profile.data?.staffProfile
        }
        onReview={setProposal}
        onSaved={() => setFormKey((key) => key + 1)}
      />
      {profile.data && !profile.data.staffProfile && (
        <Feedback message="A staff profile is required to publish or manage appointment slots. Ask an administrator to complete your staff record." />
      )}
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
    </>
  );
}
function SlotCreateForm({
  disabled,
  onReview,
  onSaved,
}: {
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
  onSaved: () => void;
}) {
  const [uncertain, setUncertain] = useState(false);
  const form = useForm<SlotForm>({
    resolver: zodResolver(slotFormSchema),
    shouldFocusError: false,
    defaultValues: { branchId: "", serviceId: "", staffId: "", startsAt: "" },
  });
  const branchId = useWatch({ control: form.control, name: "branchId" });
  const errors = form.formState.errors;
  function review(values: SlotForm, submittedAt: number) {
    if (disabled || uncertain) return;
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
      onUncertain: () => setUncertain(true),
      submit: async () => {
        await apiRequest("/staff/booking-slots", { method: "POST", csrf: true, body });
        onSaved();
      },
    });
  }
  return (
    <section className="detail-section">
      <h2>Publish an appointment slot</h2>
      <p>
        Choose an active branch, a service with a fixed price and duration, and an
        available staff member.
      </p>
      <Feedback
        message={
          uncertain
            ? "The save outcome is uncertain. Review the refreshed slot list before creating another slot. This form cannot be resubmitted."
            : undefined
        }
      />
      <form
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
                  id="new-slot-branch"
                  error={errors.branchId?.message}
                  inputRef={field.ref}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("staffId", "");
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
                  id="new-slot-service"
                  error={errors.serviceId?.message}
                  inputRef={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          {branchId && (
            <div className="field">
              <label htmlFor="new-slot-staff">Appointment staff member</label>
              <Controller
                control={form.control}
                name="staffId"
                render={({ field }) => (
                  <StaffPicker
                    key={branchId}
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
          <button className="button">Review new slot</button>
        </fieldset>
      </form>
    </section>
  );
}
