"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { CustomerVehicle } from "@/lib/api/vehicle-schemas";
import {
  garageBody,
  garageFieldError,
  garageVehicleSchema,
  type GarageFields,
} from "@/lib/customer-garage";
import { GarageDialog } from "./garage-dialog";

export function GarageVehicleEditor({
  vehicle,
  onClose,
  onSaved,
  onUncertain,
}: {
  vehicle: CustomerVehicle | null;
  onClose: () => void;
  onSaved: () => void;
  onUncertain: () => void;
}) {
  const active = useRef(true),
    sending = useRef(false);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string>();
  const form = useForm<GarageFields>({
    defaultValues: {
      make: vehicle?.make ?? "",
      model: vehicle?.model ?? "",
      year: String(vehicle?.year ?? new Date().getUTCFullYear()),
      registrationNumber: vehicle?.registrationNumber ?? "",
      color: vehicle?.color ?? "",
      vin: vehicle?.vin ?? "",
      mileageKm: vehicle?.mileageKm == null ? "" : String(vehicle.mileageKm),
    },
  });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function save(values: GarageFields) {
    if (sending.current || uncertain) return;
    sending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const response = await apiRequest<unknown>(
        vehicle ? `/customers/vehicles/${vehicle.id}` : "/customers/vehicles",
        {
          method: vehicle ? "PATCH" : "POST",
          csrf: true,
          body: garageBody(values),
        },
      );
      const saved = garageVehicleSchema.parse(response.data);
      if (vehicle && saved.id !== vehicle.id) throw new Error("Unexpected vehicle");
      if (active.current) onSaved();
    } catch (reason) {
      if (!active.current) return;
      const rejected =
        reason instanceof ApiError && reason.status >= 400 && reason.status < 500;
      if (rejected) setError(reason.message);
      else {
        setUncertain(true);
        setError(
          "We couldn't confirm the save. Close this form and refresh your vehicles before trying again.",
        );
        onUncertain();
      }
    } finally {
      sending.current = false;
      if (active.current) setBusy(false);
    }
  }
  function field(name: keyof GarageFields, label: string, required = false) {
    const issue = form.formState.errors[name];
    return (
      <div
        className={`garage-field${name === "vin" ? " garage-field-wide" : ""}`}
        key={name}
      >
        <label htmlFor={`garage-${name}`}>
          {label} <span>({required ? "required" : "optional"})</span>
        </label>
        <input
          id={`garage-${name}`}
          type={name === "year" || name === "mileageKm" ? "number" : "text"}
          inputMode={name === "year" || name === "mileageKm" ? "numeric" : undefined}
          min={name === "year" ? 1886 : name === "mileageKm" ? 0 : undefined}
          max={
            name === "year"
              ? new Date().getUTCFullYear() + 1
              : name === "mileageKm"
                ? 5000000
                : undefined
          }
          maxLength={
            name === "vin"
              ? 17
              : name === "registrationNumber"
                ? 20
                : name === "color"
                  ? 50
                  : 80
          }
          aria-required={required}
          aria-invalid={!!issue}
          aria-describedby={
            [name === "vin" ? "garage-vin-hint" : "", issue ? `garage-${name}-error` : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
          data-initial-focus={name === "make" ? "" : undefined}
          {...form.register(name, { validate: (value) => garageFieldError(name, value) })}
        />
        {name === "vin" && (
          <p id="garage-vin-hint" className="garage-hint">
            The 17-character vehicle identification number on your vehicle or registration
            document.
          </p>
        )}
        {issue && (
          <p className="garage-field-error" id={`garage-${name}-error`}>
            {issue.message}
          </p>
        )}
      </div>
    );
  }
  return (
    <GarageDialog
      title={vehicle ? "Edit your vehicle" : "Add a vehicle"}
      busy={busy}
      onClose={onClose}
    >
      <form
        noValidate
        data-draft-key={JSON.stringify(["customer-vehicles:1", vehicle?.id ?? "create"])}
        onSubmit={(event) => void form.handleSubmit(save)(event)}
      >
        <div className="garage-dialog-body">
          <p>Start with the make, model and year. You can add the other details later.</p>
          {Object.keys(form.formState.errors).length > 0 && (
            <div role="alert" className="garage-notice">
              Check the highlighted vehicle details.
            </div>
          )}
          {error && (
            <div role="alert" className="garage-notice">
              {error}
            </div>
          )}
          <fieldset disabled={busy || uncertain} className="garage-fields">
            <legend>Vehicle details</legend>
            <div className="garage-field-grid">
              {field("make", "Make", true)}
              {field("model", "Model", true)}
              {field("year", "Year", true)}
            </div>
          </fieldset>
          <fieldset disabled={busy || uncertain} className="garage-fields">
            <legend>Additional details</legend>
            <p>These details are optional and help our workshop identify your vehicle.</p>
            <div className="garage-field-grid">
              {field("registrationNumber", "Registration")}
              {field("color", "Colour")}
              {field("vin", "VIN")}
              {field("mileageKm", "Mileage in km")}
            </div>
          </fieldset>
        </div>
        <footer className="garage-dialog-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            {uncertain ? "Close and review vehicles" : "Cancel"}
          </button>
          <button className="button" disabled={busy || uncertain} aria-busy={busy}>
            {busy ? "Saving…" : "Save vehicle"}
          </button>
        </footer>
      </form>
    </GarageDialog>
  );
}
