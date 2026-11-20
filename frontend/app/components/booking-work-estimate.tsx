"use client";
import { useId } from "react";
import type { BookingWorkEstimate as Estimate } from "@/lib/api/booking-work-review-schemas";
import { formatBusinessDate } from "@/lib/format/date";
export function BookingWorkEstimate({
  estimate,
  status,
}: {
  estimate?: Estimate | null;
  status: string;
}) {
  const title = useId();
  if (!estimate || !["CONFIRMED", "IN_PROGRESS"].includes(status)) return null;
  return (
    <section className="card booking-work-estimate" aria-labelledby={title}>
      <h2 id={title}>Updated work estimate</h2>
      <p>
        At {formatBusinessDate(estimate.reviewedAt)}, the workshop estimated about{" "}
        {estimate.remainingMinutes}{" "}
        {estimate.remainingMinutes === 1 ? "minute" : "minutes"} of work remaining.
      </p>
      <p>
        The scope and time may change. This is not a promised completion or
        vehicle-collection time.
      </p>
    </section>
  );
}
