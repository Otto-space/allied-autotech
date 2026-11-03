import type { BookingRescheduleRequest } from "@/lib/api/booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
const labels = {
  APPROVED: "Approved",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
  SUPERSEDED: "No longer applicable",
  PENDING: "Awaiting approval",
};
export function BookingRescheduleHistory({
  requests,
}: {
  requests?: BookingRescheduleRequest[];
}) {
  const history = requests?.filter((request) => request.status !== "PENDING") ?? [];
  if (!history.length) return null;
  return (
    <details className="booking-detail-history">
      <summary>Reschedule history</summary>
      <ol aria-label="Recent reschedule decisions">
        {history.map((request) => (
          <li key={request.id}>
            <p>
              <strong>{labels[request.status]}</strong> · Requested time:{" "}
              {formatBusinessDate(request.startsAt)}
            </p>
            <p>Request reason: {request.reason}</p>
            {request.decisionReason && <p>Decision: {request.decisionReason}</p>}
            {request.decidedAt && (
              <p>Recorded: {formatBusinessDate(request.decidedAt)}</p>
            )}
          </li>
        ))}
      </ol>
      <p>
        Showing the latest recorded requests. A request does not itself change an
        appointment.
      </p>
    </details>
  );
}
