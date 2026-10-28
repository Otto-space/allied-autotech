import { TriangleAlert } from "lucide-react";

export function VehicleOwnerDisclosure({
  vehicle,
  compact = false,
}: {
  vehicle: {
    ownerReportedCondition?: string | null;
    ownerReportedIssues?: string | null;
  };
  compact?: boolean;
}) {
  if (compact) {
    if (!vehicle.ownerReportedIssues) return null;
    return (
      <p className="vehicle-owner-issue-preview">
        <TriangleAlert size={17} aria-hidden="true" />
        <span>
          <strong>Owner-reported known issues</strong>: {vehicle.ownerReportedIssues}
        </span>
      </p>
    );
  }
  return (
    <section className="vehicle-owner-disclosure">
      <h3>Owner-reported condition</h3>
      <p>{vehicle.ownerReportedCondition || "No owner condition statement recorded."}</p>
      <h3>
        <TriangleAlert size={18} aria-hidden="true" /> Known issues reported by owner
      </h3>
      <p>
        {vehicle.ownerReportedIssues ||
          "No owner issue statement recorded. This does not establish that the vehicle is fault-free."}
      </p>
      <small>
        These statements are supplied by the owner. They are separate from a recorded
        inspection.
      </small>
    </section>
  );
}
