import { TriangleAlert } from "lucide-react";

export function VehicleOwnerDisclosure({
  vehicle,
  compact = false,
  headingLevel = 3,
}: {
  vehicle: {
    ownerReportedCondition?: string | null;
    ownerReportedIssues?: string | null;
  };
  compact?: boolean;
  headingLevel?: 2 | 3;
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
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="vehicle-owner-disclosure">
      <Heading>Owner-reported condition</Heading>
      <p>{vehicle.ownerReportedCondition || "No owner condition statement recorded."}</p>
      <Heading>
        <TriangleAlert size={18} aria-hidden="true" /> Known issues reported by owner
      </Heading>
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
