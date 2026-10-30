"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  fitmentLabels,
  savedVehicleQualifierKeys,
  type FitmentOption,
} from "@/lib/parts-fitment";
import { FitmentCataloguePicker } from "./fitment-catalogue-picker";
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
  showSearchSetup = false,
  onClose,
  onSaved,
  onUncertain,
}: {
  vehicle: CustomerVehicle | null;
  showSearchSetup?: boolean;
  onClose: () => void;
  onSaved: (vehicle: CustomerVehicle) => void;
  onUncertain: () => void;
}) {
  const active = useRef(true),
    sending = useRef(false);
  const searchSetup = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string>();
  const [nickname, setNickname] = useState(vehicle?.nickname || "");
  const [isDefault, setIsDefault] = useState(vehicle?.isDefault || false);
  const [linked, setLinked] = useState(!!vehicle?.vehicleModelId);
  const [make, setMake] = useState<FitmentOption | undefined>(
    vehicle?.vehicleModel?.make,
  );
  const [model, setModel] = useState<FitmentOption | undefined>(
    vehicle?.vehicleModel || undefined,
  );
  const [specifications, setSpecifications] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      savedVehicleQualifierKeys.map((key) => [key, vehicle?.[key] || ""]),
    ),
  );
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
    if (vehicle && !vehicle.updatedAt) {
      setError(
        "Reload the saved vehicle before editing it. Its current revision could not be verified.",
      );
      return;
    }
    if (
      linked &&
      (!make ||
        !model ||
        model.makeId !== make.id ||
        Number(values.year) < model.yearFrom! ||
        Number(values.year) > model.yearTo!)
    ) {
      setError(
        "Choose a make and model from the search lists and check the year, or turn off Shop search setup to save just your vehicle details.",
      );
      if (searchSetup.current) searchSetup.current.open = true;
      document
        .getElementById(
          !make
            ? "garage-catalogue-make"
            : !model
              ? "garage-catalogue-model"
              : "garage-year",
        )
        ?.focus();
      return;
    }
    if (
      [nickname, ...Object.values(specifications)].some((value) =>
        /[\u0000-\u001f\u007f]/.test(value),
      ) ||
      nickname.trim().length > 80 ||
      Object.values(specifications).some((value) => value.length > 100)
    ) {
      setError(
        "Use up to 80 characters for the nickname and 100 printable characters for each vehicle specification.",
      );
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const response = await apiRequest<unknown>(
        vehicle ? `/customers/vehicles/${vehicle.id}` : "/customers/vehicles",
        {
          method: vehicle ? "PATCH" : "POST",
          csrf: true,
          body: {
            ...garageBody(values),
            nickname: nickname.trim() || null,
            isDefault,
            vehicleModelId: linked ? model!.id : null,
            ...Object.fromEntries(
              savedVehicleQualifierKeys.map((key) => [
                key,
                linked ? specifications[key]?.trim() || null : null,
              ]),
            ),
            ...(vehicle?.updatedAt ? { expectedUpdatedAt: vehicle.updatedAt } : {}),
          },
        },
      );
      const saved = garageVehicleSchema.parse(response.data);
      if (vehicle && saved.id !== vehicle.id) throw new Error("Unexpected vehicle");
      if (active.current) onSaved(saved);
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
    const hints: Partial<Record<keyof GarageFields, string>> = {
      make: "The manufacturer, for example Toyota or Honda.",
      model: "The model name, for example Corolla or Accord.",
      year: "Use the model year shown on your vehicle documents.",
      registrationNumber: "Enter the number plate as shown on your vehicle.",
      mileageKm: "Enter the odometer reading in kilometres. Leave blank if unknown.",
    };
    const hint = hints[name];
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
                  : 100
          }
          aria-required={required}
          aria-invalid={!!issue}
          aria-describedby={
            [
              name === "vin" || hint ? `garage-${name}-hint` : "",
              issue ? `garage-${name}-error` : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          data-initial-focus={name === "make" ? "" : undefined}
          readOnly={linked && (name === "make" || name === "model")}
          {...form.register(name, {
            validate: (value) => garageFieldError(name, value),
            onChange: () => {
              if (name === "year" && linked) setSpecifications({});
            },
          })}
        />
        {hint && (
          <p id={`garage-${name}-hint`} className="garage-hint">
            {hint}
          </p>
        )}
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
            <legend>Personalise your saved vehicle</legend>
            <div className="garage-field">
              <label htmlFor="garage-nickname">Nickname (optional)</label>
              <p id="garage-nickname-hint" className="garage-hint">
                A name you recognise, such as Family car. It does not change the vehicle
                model.
              </p>
              <input
                aria-describedby="garage-nickname-hint"
                id="garage-nickname"
                name="nickname"
                value={nickname}
                maxLength={80}
                onChange={(event) => setNickname(event.target.value)}
              />
            </div>
            <label className="garage-default-choice">
              <input
                type="checkbox"
                name="isDefault"
                checked={isDefault}
                onChange={(event) => setIsDefault(event.target.checked)}
              />
              Use as my default vehicle for parts searches
            </label>
          </fieldset>
          <details
            ref={searchSetup}
            className="garage-search-setup"
            open={showSearchSetup || !!vehicle?.vehicleModelId}
          >
            <summary>Use this vehicle in Shop searches (optional)</summary>
            <p>
              The details above are enough to save your vehicle. To reuse it in Shop
              searches, choose the matching make and model from our available search
              lists. You can skip this if your vehicle is not listed.
            </p>
            <fieldset disabled={busy || uncertain} className="garage-fields">
              <legend className="sr-only">Optional Shop search setup</legend>
              <label className="garage-default-choice">
                <input
                  type="checkbox"
                  name="catalogueLinked"
                  checked={linked}
                  onChange={(event) => {
                    setLinked(event.target.checked);
                  }}
                />
                Set up this vehicle for Shop searches
              </label>
              {linked && (
                <>
                  <p className="garage-hint">
                    Selecting from these lists updates Make and Model above. This helps
                    narrow a search; it does not confirm that a part fits your vehicle.
                  </p>
                  <div className="garage-field-grid">
                    <div className="garage-field">
                      <label htmlFor="garage-catalogue-make">
                        Make for Shop searches
                      </label>
                      <FitmentCataloguePicker
                        id="garage-catalogue-make"
                        kind="make"
                        value={make?.id || ""}
                        selected={make}
                        onChange={(value) => {
                          setMake(value);
                          setModel(undefined);
                          setSpecifications({});
                          form.setValue("make", value?.name || "");
                          form.setValue("model", "");
                        }}
                      />
                    </div>
                    <div className="garage-field">
                      <label htmlFor="garage-catalogue-model">
                        Model for Shop searches
                      </label>
                      <FitmentCataloguePicker
                        key={make?.id || "unselected"}
                        id="garage-catalogue-model"
                        kind="model"
                        makeId={make?.id}
                        value={model?.id || ""}
                        selected={model}
                        disabled={!make}
                        onChange={(value) => {
                          setModel(value);
                          setSpecifications({});
                          form.setValue("model", value?.name || "");
                        }}
                      />
                    </div>
                  </div>
                  {model && (
                    <p className="garage-hint">
                      Supported model years: {model.yearFrom}–{model.yearTo}. Update Year
                      above if needed.
                    </p>
                  )}
                  <details>
                    <summary>More details to help check a part (optional)</summary>
                    <p>
                      Leave unknown details blank. Axle or position is chosen for the part
                      you need.
                    </p>
                    <div className="garage-field-grid">
                      {savedVehicleQualifierKeys.map((key) => (
                        <div className="garage-field" key={key}>
                          <label htmlFor={`garage-spec-${key}`}>
                            {fitmentLabels[key]} (optional)
                          </label>
                          <input
                            id={`garage-spec-${key}`}
                            name={key}
                            maxLength={100}
                            value={specifications[key] || ""}
                            onChange={(event) =>
                              setSpecifications((previous) => ({
                                ...previous,
                                [key]: event.target.value,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              )}
              {!linked && vehicle?.vehicleModelId && (
                <p className="garage-hint">
                  Saving with this turned off removes the Shop search link and its extra
                  specifications. Your basic vehicle details stay saved.
                </p>
              )}
            </fieldset>
          </details>
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
