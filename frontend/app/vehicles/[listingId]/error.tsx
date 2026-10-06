"use client";
import Link from "next/link";
import { VehicleState } from "./vehicle-state";
export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <VehicleState title="Vehicle details are temporarily unavailable">
      <p>We couldn’t load this listing. Please try again or contact our team for help.</p>
      <div className="actions">
        <button className="button" onClick={retry}>
          Try again
        </button>
        <Link className="button secondary" href="/vehicles">
          Browse vehicles
        </Link>
        <Link className="button secondary" href="/contact">
          Contact our team
        </Link>
      </div>
    </VehicleState>
  );
}
