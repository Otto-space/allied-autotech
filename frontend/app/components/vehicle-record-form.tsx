"use client";
import { VehicleOwnerFields } from "./vehicle-owner-fields";
import { CountryField } from "./country-field";
import { vehicleLabel } from "@/lib/vehicle-discovery";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";

import { vehicleEnums, type StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import {
  recordSchema,
  vehicleRecordBody,
  vehicleDefaults,
  type VehicleRecordValues,
} from "@/lib/forms/vehicle-record";
import type { RequestBody } from "@/lib/api/contracts";
import { formatKobo } from "@/lib/format/money";
import {
  formatStockInstant,
  forgetStockFormDraft,
} from "@/lib/admin/work-vehicle-detail";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

export { WorkVehicleCreate as NewVehicleRecord } from "./work-vehicle-create";

const fields = [
  ["stockNumber", "Stock number", 40],
  ["make", "Make", 80],
  ["model", "Model", 80],
  ["year", "Model year", 4],
  ["trim", "Trim (optional)", 80],
  ["mileageKm", "Mileage (optional, km)", 8],
  ["engineCapacityCc", "Engine capacity (optional, cc)", 5],
  ["features", "Recorded features (optional, comma separated)", 3239],
  ["engineCode", "Engine code (optional)", 40],
  ["cylinders", "Cylinders (optional)", 2],
  ["engineSize", "Engine size (optional)", 40],
  ["color", "Colour (optional)", 40],
  ["doors", "Doors (optional)", 2],
  ["seats", "Seats (optional)", 3],
  ["vin", "VIN (optional)", 17],
  ["chassisNumber", "Chassis number (optional)", 80],
  ["registrationNumber", "Registration number (optional)", 80],
  ["acquisitionPrice", "Acquisition cost (optional, NGN)", 17],
  ["acquiredAt", "Acquired at (optional, Lagos time)", 16],
] as const;
export function VehicleRecordForm({
  vehicle,
  branchId,
  disabled = false,
  onSaved,
  onReview,
}: {
  vehicle?: StaffVehicle;
  branchId?: string;
  disabled?: boolean;
  onSaved?: () => void;
  onReview?: (proposal: MutationProposal) => void;
}) {
  const router = useRouter();
  const session = useAccountSession();
  const includeAcquisition =
    session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string>();
  const createdId = useRef<string | undefined>(undefined);
  const [loadedVersion, setLoadedVersion] = useState(vehicle?.version);
  const changed = vehicle !== undefined && vehicle.version !== loadedVersion;
  const form = useForm<VehicleRecordValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: vehicleDefaults(vehicle, branchId),
  });
  function review(values: VehicleRecordValues) {
    if (disabled || proposal || uncertain || changed) return;
    const fields = vehicleRecordBody(values, includeAcquisition, vehicle);
    const body:
      | RequestBody<"/staff/vehicles", "post">
      | RequestBody<"/staff/vehicles/{vehicleId}", "patch"> = vehicle
      ? { ...fields, expectedVersion: vehicle.version }
      : {
          ...fields,
          branchId: branchId ?? values.branchId,
          stockNumber: values.stockNumber.toUpperCase(),
        };
    setMessage(undefined);
    const offer: MutationProposal = {
      stockChange: vehicle
        ? {
            kind: "record",
            id: vehicle.id,
            expectedVersion: vehicle.version,
            expected: fields,
          }
        : undefined,
      title: vehicle ? "Save this vehicle record?" : "Create this stock record?",
      description:
        "This saves the permitted vehicle details. It does not create or publish a sale listing. Empty optional fields are recorded as not set.",
      facts: [
        { label: "Stock number", value: values.stockNumber.toUpperCase() },
        ...(vehicle ? [{ label: "Workshop branch", value: vehicle.branch.name }] : []),
        ...Object.entries(fields).map(([key, value]) => ({
          label:
            (
              {
                make: "Make",
                model: "Model",
                trim: "Trim",
                year: "Model year",
                mileageKm: "Mileage",
                condition: "Condition",
                transmission: "Transmission",
                fuelType: "Fuel type",
                bodyType: "Body type",
                driveType: "Drive type",
                engineCode: "Engine code",
                cylinders: "Cylinders",
                ownerReportedCondition: "Owner-reported condition",
                ownerReportedIssues: "Owner-reported known issues",
                engineSize: "Engine size",
                manufactureCountryCode: "Final assembly country",
                powertrain: "Powertrain",
                engineCapacityCc: "Engine capacity (cc)",
                features: "Recorded features",
                color: "Colour",
                doors: "Doors",
                seats: "Seats",
                vin: "VIN",
                chassisNumber: "Chassis number",
                registrationNumber: "Registration number",
                acquisitionCostKobo: "Acquisition cost",
                acquiredAt: "Acquired at",
              } as Record<string, string>
            )[key] ?? key,
          value:
            value == null
              ? "Not recorded"
              : key === "acquisitionCostKobo"
                ? formatKobo(String(value))
                : key === "acquiredAt"
                  ? formatStockInstant(String(value))
                  : key === "mileageKm"
                    ? `${Number(value).toLocaleString("en-NG")} km`
                    : Array.isArray(value)
                      ? value.join(", ") || "Not recorded"
                      : [
                            "manufactureCountryCode",
                            "powertrain",
                            "condition",
                            "driveType",
                          ].includes(key)
                        ? vehicleLabel(String(value))
                        : String(value).replaceAll("_", " "),
        })),
      ],
      onConfirmed: () => {
        if (vehicle) setLoadedVersion(vehicle.version + 1);
      },
      onUncertain: vehicle ? undefined : () => setUncertain(true),
      submit: async () => {
        const response = await apiRequest(
          vehicle ? `/staff/vehicles/${vehicle.id}` : "/staff/vehicles",
          { method: vehicle ? "PATCH" : "POST", csrf: true, body },
        );
        if (!vehicle)
          createdId.current = z.object({ id: z.string().uuid() }).parse(response.data).id;
        return response;
      },
    };
    if (onReview) onReview(offer);
    else setProposal(offer);
  }
  return (
    <>
      <Feedback message={message} tone="success" toast="Vehicle record updated." />
      {changed && vehicle && (
        <div className="notice">
          <p>
            This record has a newer version. Your form input has been kept. Reload the
            fields to review the latest record before saving.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              forgetStockFormDraft(
                (
                  document.getElementById(
                    "vehicle-record-make",
                  ) as HTMLInputElement | null
                )?.form ?? null,
              );
              form.reset(vehicleDefaults(vehicle));
              setLoadedVersion(vehicle.version);
            }}
          >
            Reload vehicle fields
          </button>
        </div>
      )}
      {uncertain && (
        <p className="notice" role="status">
          Creation is unconfirmed. Check the stock list for this stock number before
          starting another record. This form will not resend the request.
        </p>
      )}
      <form
        data-draft-key={JSON.stringify(["vehicle-record-form:1", vehicle?.id, branchId])}
        noValidate
        onSubmit={(event) => void form.handleSubmit(review)(event)}
      >
        <fieldset
          className="handover-fields"
          disabled={disabled || !!proposal || uncertain || changed}
        >
          {vehicle ? (
            <p>
              Branch: {vehicle.branch.name}. Branch and stock number cannot be changed
              here.
            </p>
          ) : branchId ? (
            <p>Your assigned branch will be used for this record.</p>
          ) : (
            <div className="field">
              <label htmlFor="vehicle-record-branch">Workshop branch</label>
              <Controller
                name="branchId"
                control={form.control}
                render={({ field }) => (
                  <SlotCatalogPicker
                    kind="branch"
                    id="vehicle-record-branch"
                    value={field.value}
                    onChange={field.onChange}
                    inputRef={field.ref}
                    error={form.formState.errors.branchId?.message}
                  />
                )}
              />
            </div>
          )}
          <div className="record-form-grid">
            {fields
              .filter(([name]) => !vehicle || name !== "stockNumber")
              .filter(([name]) => includeAcquisition || name !== "acquisitionPrice")
              .map(([name, label, maxLength]) => (
                <div className="field" key={name}>
                  <label htmlFor={`vehicle-record-${name}`}>{label}</label>
                  <input
                    id={`vehicle-record-${name}`}
                    {...form.register(name)}
                    maxLength={maxLength}
                    type={name === "acquiredAt" ? "datetime-local" : "text"}
                    inputMode={
                      name === "acquisitionPrice"
                        ? "decimal"
                        : ["year", "mileageKm", "doors", "seats"].includes(name)
                          ? "numeric"
                          : "text"
                    }
                    autoComplete="off"
                    aria-invalid={!!form.formState.errors[name]}
                    aria-describedby={
                      form.formState.errors[name]
                        ? `vehicle-record-${name}-error`
                        : undefined
                    }
                  />
                  {form.formState.errors[name] && (
                    <p
                      className="field-error"
                      role="alert"
                      id={`vehicle-record-${name}-error`}
                    >
                      {form.formState.errors[name]?.message}
                    </p>
                  )}
                </div>
              ))}
            <VehicleOwnerFields form={form} />
            <div className="field">
              <label htmlFor="vehicle-record-country">
                Final assembly country (optional)
              </label>
              <Controller
                name="manufactureCountryCode"
                control={form.control}
                render={({ field, fieldState }) => (
                  <>
                    <CountryField
                      id="vehicle-record-country"
                      value={field.value}
                      onChange={field.onChange}
                      inputRef={field.ref}
                      onBlur={field.onBlur}
                      invalid={!!fieldState.error}
                      describedBy="vehicle-record-country-hint"
                    />
                    {fieldState.error && (
                      <p className="field-error" role="alert">
                        {fieldState.error.message}
                      </p>
                    )}
                  </>
                )}
              />
              <small id="vehicle-record-country-hint">
                Use documented final assembly country. Leave blank when unknown; do not
                infer it from the brand or import route.
              </small>
            </div>
            {Object.entries(vehicleEnums).map(([name, options]) => (
              <Controller
                key={name}
                name={z
                  .enum([
                    "condition",
                    "transmission",
                    "fuelType",
                    "bodyType",
                    "driveType",
                    "powertrain",
                  ])
                  .parse(name)}
                control={form.control}
                render={({ field, fieldState }) => (
                  <div className="field">
                    <label htmlFor={`vehicle-record-${name}`}>
                      {name === "bodyType"
                        ? "Body type"
                        : name === "driveType"
                          ? "Drive type"
                          : name === "fuelType"
                            ? "Fuel type"
                            : name[0].toUpperCase() + name.slice(1)}
                      {name === "condition" ? "" : " (optional)"}
                    </label>
                    <select
                      {...field}
                      id={`vehicle-record-${name}`}
                      aria-invalid={!!fieldState.error}
                      aria-describedby={
                        fieldState.error ? `vehicle-record-${name}-error` : undefined
                      }
                    >
                      {name !== "condition" && <option value="">Not set</option>}
                      {options.map((value) => (
                        <option key={value} value={value}>
                          {vehicleLabel(value)}
                        </option>
                      ))}
                    </select>
                    {fieldState.error && (
                      <p
                        role="alert"
                        className="field-error"
                        id={`vehicle-record-${name}-error`}
                      >
                        {fieldState.error.message}
                      </p>
                    )}
                  </div>
                )}
              />
            ))}
          </div>
          <button className="button">
            {vehicle ? "Review vehicle changes" : "Review new vehicle"}
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            onSaved?.();
          }}
          onSuccess={() => {
            if (createdId.current)
              router.push(`/admin/vehicles/${createdId.current}#vehicle-photos`);
            else setMessage("Vehicle changes recorded. Review the refreshed details.");
          }}
        />
      )}
    </>
  );
}
