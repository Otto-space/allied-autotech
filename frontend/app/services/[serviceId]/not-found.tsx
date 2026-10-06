import Link from "next/link";
import { ServiceState } from "./service-state";
export default function NotFound() {
  return (
    <ServiceState title="This service is unavailable">
      <p>
        We couldn’t find that page. The listing may have changed or may no longer be
        available.
      </p>
      <div className="actions">
        <Link className="button" href="/services">
          Browse services
        </Link>
        <Link className="button secondary" href="/contact">
          Contact our team
        </Link>
      </div>
    </ServiceState>
  );
}
