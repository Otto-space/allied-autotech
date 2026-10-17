"use client";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { SlidersHorizontal } from "lucide-react";
import { workSlotQuery } from "@/lib/work-slot-query";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffProfiles } from "@/lib/api/staff-booking-schemas";
import { AdminBranchPicker } from "./admin-branch-picker";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
const parseServices = (value: unknown) =>
  z
    .object({
      items: z.array(
        z.object({ id: z.uuid(), name: z.string(), isActive: z.boolean().optional() }),
      ),
      nextCursor: z.uuid().optional(),
    })
    .parse(value);
export function WorkSlotFilters({
  initial,
  admin,
  ownId,
  onApply,
  onClear,
}: {
  initial: string;
  admin: boolean;
  ownId?: string;
  onApply: (params: URLSearchParams) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(() => new URLSearchParams(initial));
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(() =>
    ["branchId", "serviceId", "staffId"].some((key) => draft.has(key)),
  );
  function set(key: string, value: string) {
    setDraft((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key === "branchId") next.delete("staffId");
      return next;
    });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = workSlotQuery(draft, admin);
    if (next.invalid) {
      setError("Choose valid dates with the end on or after the start.");
      document.getElementById("slot-from")?.focus();
      return;
    }
    setError("");
    onApply(next.params);
  }
  return (
    <form className="work-slot-filters" onSubmit={submit} noValidate>
      <div className="work-slot-filter-main">
        <div className="field">
          <label htmlFor="slot-status-filter">Slot status</label>
          <select
            id="slot-status-filter"
            value={draft.get("status") ?? ""}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="slot-from">Starts from</label>
          <input
            id="slot-from"
            type="date"
            value={draft.get("from") ?? ""}
            onChange={(e) => set("from", e.target.value)}
            aria-invalid={!!error}
            aria-describedby="slot-dates-hint"
          />
        </div>
        <div className="field">
          <label htmlFor="slot-to">Starts to</label>
          <input
            id="slot-to"
            type="date"
            value={draft.get("to") ?? ""}
            onChange={(e) => set("to", e.target.value)}
            aria-invalid={!!error}
            aria-describedby="slot-dates-hint"
          />
        </div>
        <button className="button">Apply filters</button>
        <button className="button secondary" type="button" onClick={onClear}>
          Clear filters
        </button>
      </div>
      <p
        id="slot-dates-hint"
        className={error ? "field-error" : "field-hint"}
        role={error ? "alert" : undefined}
      >
        {error || "Inclusive dates / Lagos time."}
      </p>
      <details open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)}>
        <summary>
          <SlidersHorizontal size={16} aria-hidden="true" />
          Branch, service &amp; staff filters
        </summary>
        {expanded && (
          <div className="work-slot-filter-extra">
            {admin && (
              <div className="field">
                <label htmlFor="slot-filter-branch">Branch</label>
                <AdminBranchPicker
                  id="slot-filter-branch"
                  activeOnly={false}
                  value={draft.get("branchId") ?? ""}
                  onChange={(value) => set("branchId", value)}
                />
              </div>
            )}
            <FilterChoice
              kind="service"
              admin={admin}
              value={draft.get("serviceId") ?? ""}
              onChange={(value) => set("serviceId", value)}
            />
            {admin ? (
              <FilterChoice
                key={draft.get("branchId") ?? "all"}
                kind="staff"
                admin
                branchId={draft.get("branchId") ?? ""}
                value={draft.get("staffId") ?? ""}
                onChange={(value) => set("staffId", value)}
              />
            ) : (
              <div className="field">
                <label className="work-slot-own">
                  <input
                    type="checkbox"
                    checked={!!ownId && draft.get("staffId") === ownId}
                    disabled={!ownId}
                    onChange={(e) => set("staffId", e.target.checked ? ownId! : "")}
                  />
                  Only slots assigned to me
                </label>
                <p className="field-hint">
                  Your branch is set by your staff profile. Service choices include active
                  services.
                </p>
                {draft.has("staffId") && draft.get("staffId") !== ownId && (
                  <p className="field-hint">
                    This link filters another staff record in your permitted branch. Clear
                    filters to see all branch slots.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </details>
    </form>
  );
}
function FilterChoice({
  kind,
  admin,
  branchId = "",
  value,
  onChange,
}: {
  kind: "service" | "staff";
  admin: boolean;
  branchId?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pagination = useCursorPage();
  const [label, setLabel] = useState("Selected record");
  const services = useResource(
    kind === "service"
      ? `/${admin ? "admin" : "public"}/services?limit=50${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`
      : null,
    parseServices,
  );
  const staff = useResource(
    kind === "staff"
      ? `/admin/staff?limit=50${branchId ? `&branchId=${branchId}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`
      : null,
    parseStaffProfiles,
  );
  const resource = kind === "service" ? services : staff;
  const choices =
    kind === "service"
      ? (services.data?.items ?? []).map((item) => ({
          id: item.id,
          label: `${item.name}${item.isActive === false ? " (inactive)" : ""}`,
        }))
      : (staff.data?.items ?? []).flatMap((item) =>
          item.staffProfile
            ? [
                {
                  id: item.staffProfile.id,
                  label: `${item.staffProfile.firstName} ${item.staffProfile.lastName}${item.status !== "ACTIVE" ? " (inactive)" : ""}`,
                },
              ]
            : [],
        );
  const unavailable =
    resource.loading ||
    resource.refreshing ||
    !!resource.error ||
    !!resource.refreshError;
  return (
    <div className="field">
      <label htmlFor={`slot-filter-${kind}`}>
        {kind === "service" ? (admin ? "Service" : "Active service") : "Staff"}
      </label>
      <select
        id={`slot-filter-${kind}`}
        value={value}
        disabled={unavailable}
        onChange={(e) => {
          setLabel(e.target.selectedOptions[0].textContent ?? "Selected record");
          onChange(e.target.value);
        }}
      >
        <option value="">
          All{" "}
          {kind === "service"
            ? admin
              ? "services (including inactive)"
              : "active services"
            : "staff (including inactive)"}
        </option>
        {value && !choices.some((item) => item.id === value) && (
          <option value={value}>{label}</option>
        )}
        {choices.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      {resource.loading && <p role="status">Loading {kind} filters…</p>}
      <Feedback message={resource.error || resource.refreshError} />
      {(resource.error || resource.refreshError) && (
        <button type="button" className="text-link" onClick={resource.refresh}>
          Retry {kind} filters
        </button>
      )}
      {(resource.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={resource.data?.nextCursor}
          disabled={unavailable}
          label={`${kind} filters`}
        />
      )}
    </div>
  );
}
