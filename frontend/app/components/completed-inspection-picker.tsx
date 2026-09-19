"use client";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffInspections } from "@/lib/api/staff-inspection-schemas";
import type { StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
export function CompletedInspectionPicker({
  vehicle,
  value,
  onChange,
}: {
  vehicle: StaffVehicle;
  value: string;
  onChange: (value: string) => void;
}) {
  const pagination = useCursorPage();
  const inspections = useResource(
    `/staff/vehicle-inspections?status=COMPLETED&branchId=${vehicle.branchId}&limit=50${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseStaffInspections,
  );
  const choices =
    inspections.data?.items.filter(
      (inspection) =>
        !inspection.conditionReport &&
        vehicle.listings.some((listing) => listing.id === inspection.vehicleListing.id),
    ) ?? [];
  return (
    <div className="field">
      <label htmlFor="condition-inspection">Link a completed inspection (optional)</label>
      <select
        id="condition-inspection"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">No linked inspection</option>
        {value && !choices.some((item) => item.id === value) && (
          <option value={value}>Selected inspection</option>
        )}
        {choices.map((item) => (
          <option key={item.id} value={item.id}>
            {item.customerName} —{" "}
            {formatBusinessDate(item.scheduledStartAt ?? item.preferredStartAt)}
          </option>
        ))}
      </select>
      <p className="field-hint">
        Only completed inspections for this vehicle without a linked report are listed.
        Check further pages if needed.
      </p>
      {inspections.loading && <p role="status">Loading completed inspections…</p>}
      <Feedback message={inspections.error} />
      {inspections.error && (
        <button type="button" className="text-link" onClick={inspections.refresh}>
          Retry inspection choices
        </button>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={inspections.data?.nextCursor}
        disabled={inspections.loading || !!inspections.error}
        label="Completed inspection choices"
      />
    </div>
  );
}
