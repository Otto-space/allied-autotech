import Link from "next/link";
import { VehicleState } from "./vehicle-state";
export default function NotFound() {
  return (
    <VehicleState title="This vehicle is unavailable">
      <p>
        We couldn’t find that page. The listing may have changed or may no longer be
        available.
      </p>
      <div className="actions">
        <Link className="button" href="/vehicles">
          Browse vehicles
        </Link>
        <Link className="button secondary" href="/contact">
          Contact our team
        </Link>
      </div>
    </VehicleState>
  );
}
