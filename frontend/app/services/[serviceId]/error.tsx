"use client";
import Link from "next/link";
import { ServiceState } from "./service-state";
export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ServiceState title="Service details are temporarily unavailable">
      <p>We couldn’t load this service. Please try again or contact our team for help.</p>
      <div className="actions">
        <button className="button" onClick={retry}>
          Try again
        </button>
        <Link className="button secondary" href="/services">
          Browse services
        </Link>
        <Link className="button secondary" href="/contact">
          Contact our team
        </Link>
      </div>
    </ServiceState>
  );
}
