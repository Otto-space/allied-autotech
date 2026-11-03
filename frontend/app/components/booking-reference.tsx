"use client";
import { useId } from "react";
import { CopyControl } from "./copy-control";
import { bookingReferenceLabel } from "@/lib/booking-appointment";
import "./booking-reference.css";

/** The compact suffix is a display aid; copying preserves the complete source ID. */
export function BookingReference({
  id,
  label = "Booking reference",
}: {
  id: string;
  label?: string;
}) {
  const fieldId = useId();
  return (
    <details className="booking-reference">
      <summary>
        {label} {bookingReferenceLabel(id)}
      </summary>
      <div className="booking-reference-content">
        <label htmlFor={fieldId}>{label}</label>
        <textarea id={fieldId} rows={2} readOnly value={id} />
        <CopyControl value={id} label={`Copy ${label.toLowerCase()}`} fieldId={fieldId} />
      </div>
    </details>
  );
}
