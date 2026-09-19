"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffProfile } from "@/lib/api/staff-booking-schemas";
import { vehicleEnums, type StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import {
  recordSchema,
  vehicleRecordBody,
  vehicleDefaults,
  type VehicleRecordValues,
} from "@/lib/forms/vehicle-record";
import type { RequestBody } from "@/lib/api/contracts";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function NewVehicleRecord() {
  const session = useAccountSession();
  const ownBranch = session?.user.role === "STAFF";
  const profile = useResource(ownBranch ? "/staff/profile" : null, parseStaffProfile);
  if (
    ownBranch &&
    (profile.loading || profile.error || !profile.data?.staffProfile?.branchId)
  )
    return (
      <>
        <Feedback message={profile.error} />
        <p>
          {profile.loading
            ? "Checking your assigned branch…"
            : "An assigned staff branch is required to create a stock record."}
        </p>
        <button
          className="button secondary"
          disabled={profile.loading}
          onClick={profile.refresh}
        >
          Refresh staff profile
        </button>
      </>
    );
  return (
    <VehicleRecordForm
      branchId={
        ownBranch ? (profile.data?.staffProfile?.branchId ?? undefined) : undefined
      }
    />
  );
}

const fields = [
  ["stockNumber", "Stock number", 40],
  ["make", "Make", 80],
  ["model", "Model", 80],
  ["year", "Model year", 4],
  ["trim", "Trim (optional)", 80],
  ["mileageKm", "Mileage (optional, km)", 8],
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
}: {
  vehicle?: StaffVehicle;
  branchId?: string;
  disabled?: boolean;
  onSaved?: () => void;
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
    const fields = vehicleRecordBody(values, includeAcquisition);
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
    setProposal({
      title: vehicle ? "Save this vehicle record?" : "Create this stock record?",
      description:
        "This saves the permitted vehicle details. It does not create or publish a sale listing. Empty optional fields are recorded as not set.",
      facts: [
        { label: "Stock number", value: values.stockNumber.toUpperCase() },
        { label: "Vehicle", value: `${values.year} ${values.make} ${values.model}` },
        { label: "Condition", value: values.condition },
        ...(includeAcquisition
          ? [
              {
                label: "Acquisition cost",
                value: fields.acquisitionCostKobo
                  ? formatKobo(fields.acquisitionCostKobo)
                  : "Not recorded",
              },
            ]
          : []),
        {
          label: "Acquired at",
          value: fields.acquiredAt
            ? formatBusinessDate(fields.acquiredAt)
            : "Not recorded",
        },
      ],
      onUncertain: vehicle ? undefined : () => setUncertain(true),
      submit: async () => {
        const response = await apiRequest(
          vehicle ? `/staff/vehicles/${vehicle.id}` : "/staff/vehicles",
          { method: vehicle ? "PATCH" : "POST", csrf: true, body },
        );
        if (!vehicle)
          createdId.current = z.object({ id: z.string().uuid() }).parse(response.data).id;
      },
    });
  }
  return (
    <>
      <Feedback message={message} tone="success" />
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
      <form noValidate onSubmit={form.handleSubmit(review)}>
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
                          {value.replaceAll("_", " ")}
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
            if (createdId.current) router.push(`/admin/vehicles/${createdId.current}`);
            else setMessage("Vehicle changes recorded. Review the refreshed details.");
          }}
        />
      )}
    </>
  );
}
