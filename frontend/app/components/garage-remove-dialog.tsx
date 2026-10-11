"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { CustomerVehicle } from "@/lib/api/vehicle-schemas";
import { GarageDialog } from "./garage-dialog";

export function GarageRemoveDialog({
  vehicle,
  onClose,
  onRemoved,
  onUncertain,
}: {
  vehicle: CustomerVehicle;
  onClose: () => void;
  onRemoved: () => void;
  onUncertain: () => void;
}) {
  const active = useRef(true),
    sending = useRef(false);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function remove() {
    if (sending.current || uncertain) return;
    sending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/customers/vehicles/${vehicle.id}`, {
        method: "DELETE",
        csrf: true,
        body: {},
      });
      if (active.current) onRemoved();
    } catch (reason) {
      if (!active.current) return;
      const rejected =
        reason instanceof ApiError && reason.status >= 400 && reason.status < 500;
      setError(
        rejected
          ? reason.message
          : "Removal could not be confirmed. Close this dialog and refresh your vehicles to check.",
      );
      if (!rejected) {
        setUncertain(true);
        onUncertain();
      }
    } finally {
      sending.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <GarageDialog title="Remove this vehicle?" busy={busy} onClose={onClose}>
      <div className="garage-dialog-body">
        <p>
          <strong>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </strong>{" "}
          will be removed from your account, including its saved photos. Bookings stay in
          your account.
        </p>
        <dl className="garage-removal-facts">
          <dt>Registration</dt>
          <dd>{vehicle.registrationNumber ?? "Not provided"}</dd>
        </dl>
        {error && (
          <div role="alert" className="garage-notice">
            {error}
          </div>
        )}
      </div>
      <footer className="garage-dialog-footer">
        <button
          data-initial-focus
          className="button secondary"
          disabled={busy}
          onClick={onClose}
        >
          {uncertain ? "Close and review vehicles" : "Keep vehicle"}
        </button>
        <button
          className="button"
          disabled={busy || uncertain}
          aria-busy={busy}
          onClick={() => void remove()}
        >
          {busy ? "Removing…" : "Confirm removal"}
        </button>
      </footer>
    </GarageDialog>
  );
}
