"use client";
import { useId } from "react";
import { CopyControl } from "./copy-control";
import { bookingReferenceLabel } from "@/lib/booking-appointment";
import "./booking-reference.css";

/** The compact suffix is a display aid; copying preserves the complete source ID. */
export function BookingReference({ id }: { id: string }) {
  const fieldId = useId();
  return (
    <details className="booking-reference">
      <summary>Booking reference {bookingReferenceLabel(id)}</summary>
      <div className="booking-reference-content">
        <label htmlFor={fieldId}>Booking reference</label>
        <textarea id={fieldId} rows={2} readOnly value={id} />
        <CopyControl value={id} label="Copy booking reference" fieldId={fieldId} />
      </div>
    </details>
  );
}
