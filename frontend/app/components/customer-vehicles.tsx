"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import { type CustomerVehicle, parseCustomerVehicles } from "@/lib/api/vehicle-schemas";
import { Feedback } from "./feedback";
type Fields = {
  make: string;
  model: string;
  year: number;
  registrationNumber: string;
  vin: string;
  color: string;
  mileageKm: string;
};
export function CustomerVehicles() {
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const vehicles = useResource(
    `/customers/vehicles?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
    parseCustomerVehicles,
  );
  const [editing, setEditing] = useState<CustomerVehicle | null>(null);
  const [removing, setRemoving] = useState<CustomerVehicle | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useForm<Fields>({
    defaultValues: {
      make: "",
      model: "",
      year: new Date().getFullYear(),
      registrationNumber: "",
      vin: "",
      color: "",
      mileageKm: "",
    },
  });
  function edit(vehicle: CustomerVehicle) {
    setEditing(vehicle);
    form.reset({
      ...vehicle,
      registrationNumber: vehicle.registrationNumber ?? "",
      vin: vehicle.vin ?? "",
      color: vehicle.color ?? "",
      mileageKm: vehicle.mileageKm === null ? "" : String(vehicle.mileageKm),
    });
    form.setFocus("make");
  }
  async function save(values: Fields) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const body: RequestBody<"/customers/vehicles", "post"> = {
        make: values.make.trim(),
        model: values.model.trim(),
        year: values.year,
        registrationNumber: values.registrationNumber.trim() || null,
        vin: values.vin.trim() || null,
        color: values.color.trim() || null,
        mileageKm: values.mileageKm.trim() ? Number(values.mileageKm) : null,
      };
      await apiRequest(
        editing ? `/customers/vehicles/${editing.id}` : "/customers/vehicles",
        { method: editing ? "PATCH" : "POST", csrf: true, body },
      );
      setEditing(null);
      form.reset();
      vehicles.refresh();
      setMessage("Vehicle details saved.");
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "We could not confirm the save. Refresh your vehicles before adding another record.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (busy || !removing) return;
    setBusy(true);
    setError(undefined);
    try {
      await apiRequest(`/customers/vehicles/${removing.id}`, {
        method: "DELETE",
        csrf: true,
        body: {},
      });
      dialog.current?.close();
      vehicles.refresh();
      setMessage("Vehicle removed from your account.");
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "Removal could not be confirmed. Refresh your vehicles to check.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Your vehicles</h1>
      <p className="muted">
        Keep the details you use for workshop visits in your account.
      </p>
      <Feedback message={error ?? vehicles.error} />
      <Feedback
        message={message}
        tone="success"
        toast="Your vehicle records have been updated."
      />
      {vehicles.error && (
        <button className="button secondary" onClick={vehicles.refresh}>
          Retry vehicles
        </button>
      )}
      {vehicles.loading && <p role="status">Loading vehicles…</p>}
      <div className="list">
        {vehicles.data?.items.map((vehicle) => (
          <article className="list-item" key={vehicle.id}>
            <div>
              <h2>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
              <p className="muted">
                {vehicle.registrationNumber ?? "Registration not provided"}
              </p>
            </div>
            <div className="actions">
              <button className="button secondary" onClick={() => edit(vehicle)}>
                Edit details
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setRemoving(vehicle);
                  dialog.current?.showModal();
                }}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      {!vehicles.loading && !vehicles.error && vehicles.data?.items.length === 0 && (
        <div className="empty">No vehicles on this page. Add your vehicle below.</div>
      )}
      <nav className="pagination" aria-label="Your vehicle pages">
        <button
          className="button secondary"
          disabled={!history.length || vehicles.loading}
          onClick={() => {
            setCursor(history.at(-1));
            setHistory((value) => value.slice(0, -1));
          }}
        >
          Previous
        </button>
        <span>Page {history.length + 1}</span>
        <button
          className="button secondary"
          disabled={!vehicles.data?.nextCursor || vehicles.loading}
          onClick={() => {
            setHistory((value) => [...value, cursor]);
            setCursor(vehicles.data?.nextCursor);
          }}
        >
          Next
        </button>
      </nav>
      <section className="checkout-summary">
        <h2>{editing ? "Edit your vehicle" : "Add a vehicle"}</h2>
        <p>Start with the make, model and year. You can add the other details later.</p>
        <form onSubmit={form.handleSubmit(save)}>
          <fieldset className="form-section">
            <legend>Vehicle details</legend>
            <div className="form-row">
              {(["make", "model"] as const).map((name) => (
                <div className="field" key={name}>
                  <label htmlFor={`vehicle-${name}`}>
                    {name === "make" ? "Make" : "Model"}
                  </label>
                  <input
                    id={`vehicle-${name}`}
                    {...form.register(name, {
                      required: "This field is required.",
                      maxLength: 80,
                    })}
                    aria-invalid={!!form.formState.errors[name]}
                    aria-describedby={
                      form.formState.errors[name] ? `vehicle-${name}-error` : undefined
                    }
                  />
                  <span className="field-error" id={`vehicle-${name}-error`}>
                    {form.formState.errors[name]?.message}
                  </span>
                </div>
              ))}
            </div>
            <div className="field">
              <label htmlFor="vehicle-year">Year</label>
              <input
                id="vehicle-year"
                type="number"
                inputMode="numeric"
                min={1886}
                max={new Date().getFullYear() + 1}
                aria-invalid={!!form.formState.errors.year}
                aria-describedby={
                  form.formState.errors.year ? "vehicle-year-error" : undefined
                }
                {...form.register("year", {
                  valueAsNumber: true,
                  required: "Enter the year.",
                  min: { value: 1886, message: "Enter a valid year." },
                  max: {
                    value: new Date().getFullYear() + 1,
                    message: "Enter a valid year.",
                  },
                })}
              />
              <span className="field-error" id="vehicle-year-error">
                {form.formState.errors.year?.message}
              </span>
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>Additional details</legend>
            <p>These details are optional and help our workshop identify your vehicle.</p>
            <div className="form-row">
              <div className="field">
                <label htmlFor="vehicle-registration">Registration (optional)</label>
                <input
                  id="vehicle-registration"
                  maxLength={20}
                  aria-invalid={!!form.formState.errors.registrationNumber}
                  aria-describedby={
                    form.formState.errors.registrationNumber
                      ? "vehicle-registration-error"
                      : undefined
                  }
                  {...form.register("registrationNumber", {
                    validate: (value) =>
                      !value ||
                      /^[A-Z0-9][A-Z0-9 -]{1,19}$/i.test(value) ||
                      "Use 2–20 letters, numbers, spaces or hyphens.",
                  })}
                />
                <span className="field-error" id="vehicle-registration-error">
                  {form.formState.errors.registrationNumber?.message}
                </span>
              </div>
              <div className="field">
                <label htmlFor="vehicle-color">Colour (optional)</label>
                <input id="vehicle-color" maxLength={50} {...form.register("color")} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="vehicle-vin">VIN (optional)</label>
              <input
                id="vehicle-vin"
                maxLength={17}
                aria-invalid={!!form.formState.errors.vin}
                aria-describedby="vehicle-vin-hint vehicle-vin-error"
                {...form.register("vin", {
                  validate: (value) =>
                    !value ||
                    /^[A-HJ-NPR-Z0-9]{17}$/i.test(value) ||
                    "Enter a 17-character VIN without I, O or Q.",
                })}
              />
              <span className="field-hint" id="vehicle-vin-hint">
                The 17-character vehicle identification number on your vehicle or
                registration document.
              </span>
              <span className="field-error" id="vehicle-vin-error">
                {form.formState.errors.vin?.message}
              </span>
            </div>
            <div className="field">
              <label htmlFor="vehicle-mileage">Mileage in km (optional)</label>
              <input
                id="vehicle-mileage"
                type="number"
                inputMode="numeric"
                min={0}
                max={5000000}
                aria-invalid={!!form.formState.errors.mileageKm}
                aria-describedby={
                  form.formState.errors.mileageKm ? "vehicle-mileage-error" : undefined
                }
                {...form.register("mileageKm", {
                  validate: (value) =>
                    !value ||
                    (/^\d+$/.test(value) && Number(value) <= 5000000) ||
                    "Enter a whole number from 0 to 5,000,000.",
                })}
              />
              <span className="field-error" id="vehicle-mileage-error">
                {form.formState.errors.mileageKm?.message}
              </span>
            </div>
          </fieldset>
          <div className="actions">
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Save vehicle"}
            </button>
            {editing && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setEditing(null);
                  form.reset();
                }}
              >
                Cancel editing
              </button>
            )}
          </div>
        </form>
      </section>
      <dialog
        ref={dialog}
        className="support-dialog"
        aria-labelledby="remove-vehicle-title"
      >
        <h2 id="remove-vehicle-title">Remove this vehicle?</h2>
        <p>
          {removing?.make} {removing?.model} will be removed from your account.
        </p>
        <Feedback message={error} />
        <div className="actions">
          <button className="button danger" disabled={busy} onClick={() => void remove()}>
            Confirm removal
          </button>
          <button className="button secondary" onClick={() => dialog.current?.close()}>
            Keep vehicle
          </button>
        </div>
      </dialog>
    </>
  );
}
