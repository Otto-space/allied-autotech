"use client";

import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import {
  clearVehicleSelection,
  fitmentLabels,
  fitmentQualifierKeys,
  parseFitmentModel,
  partsEnquiryHref,
  vehicleSelectionKeys,
  type FitmentOption,
} from "@/lib/parts-fitment";
import { FitmentCataloguePicker } from "./fitment-catalogue-picker";
import type { UpdateProductQuery } from "../parts/product-filters";

export function FindPartsForCar({
  query,
  enquiryQuery,
  update,
}: {
  query: string;
  enquiryQuery?: string;
  update: UpdateProductQuery;
}) {
  const initial = new URLSearchParams(query);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(vehicleSelectionKeys.map((key) => [key, initial.get(key) ?? ""])),
  );
  const [makeOption, setMakeOption] = useState<FitmentOption>();
  const [modelOption, setModelOption] = useState<FitmentOption>();
  const [error, setError] = useState("");
  const model = useResource(
    values.vehicleModelId ? `/public/fitment/models/${values.vehicleModelId}` : null,
    parseFitmentModel,
  );
  const selectedModel = model.data?.id === values.vehicleModelId ? model.data : undefined;
  const effectiveMakeId = values.vehicleMakeId || selectedModel?.makeId || "";
  const selectedMake =
    makeOption?.id === values.vehicleMakeId
      ? makeOption
      : selectedModel?.make.id === effectiveMakeId
        ? selectedModel.make
        : undefined;
  const years = selectedModel
    ? Array.from(
        { length: selectedModel.yearTo - selectedModel.yearFrom + 1 },
        (_, index) => String(selectedModel.yearTo - index),
      )
    : [];
  function clearDraft(option?: FitmentOption) {
    setValues((previous) => ({
      ...Object.fromEntries(vehicleSelectionKeys.map((key) => [key, ""])),
      vehicleMakeId: option?.id ?? previous.vehicleMakeId,
    }));
  }
  return (
    <section className="parts-car-finder" aria-labelledby="parts-car-title">
      <div className="parts-car-heading">
        <div>
          <h3 id="parts-car-title">Find parts for my car</h3>
          <p>
            Choose your vehicle, then a parts category below. Make, model and year
            identify candidates; technical details confirm fitment.
          </p>
        </div>
        <Link href={partsEnquiryHref(new URLSearchParams(enquiryQuery ?? query))}>
          Request the right part
        </Link>
      </div>
      <form
        data-no-draft
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !effectiveMakeId ||
            !values.vehicleModelId ||
            !selectedModel ||
            selectedModel.makeId !== effectiveMakeId ||
            !years.includes(values.year)
          ) {
            setError("Choose a catalogue make, model and supported year.");
            document
              .getElementById(
                !values.vehicleMakeId
                  ? "parts-car-make"
                  : !values.vehicleModelId
                    ? "parts-car-model"
                    : "parts-car-year",
              )
              ?.focus();
            return;
          }
          if (
            fitmentQualifierKeys.some(
              (key) =>
                values[key].length > 100 ||
                [...values[key]].some((char) => (char.codePointAt(0) ?? 0) < 32),
            )
          ) {
            setError("Use up to 100 printable characters for each vehicle detail.");
            return;
          }
          setError("");
          update((params) => {
            clearVehicleSelection(params);
            for (const key of vehicleSelectionKeys)
              if (values[key].trim()) params.set(key, values[key].trim());
            params.set("vehicleMakeId", effectiveMakeId);
          });
        }}
      >
        <div className="parts-car-fields">
          <div className="product-field">
            <label htmlFor="parts-car-make">Vehicle make</label>
            <FitmentCataloguePicker
              id="parts-car-make"
              kind="make"
              value={effectiveMakeId}
              selected={selectedMake}
              invalid={!!error && !values.vehicleMakeId}
              onChange={(option) => {
                setMakeOption(option);
                setModelOption(undefined);
                clearDraft(option);
                setValues((previous) => ({
                  ...previous,
                  vehicleMakeId: option?.id ?? "",
                }));
                setError("");
              }}
            />
          </div>
          <div className="product-field">
            <label htmlFor="parts-car-model">Vehicle model</label>
            <FitmentCataloguePicker
              key={effectiveMakeId}
              id="parts-car-model"
              kind="model"
              makeId={effectiveMakeId}
              value={values.vehicleModelId}
              selected={
                modelOption?.id === values.vehicleModelId ? modelOption : selectedModel
              }
              disabled={!effectiveMakeId}
              invalid={!!error && !values.vehicleModelId}
              onChange={(option) => {
                setModelOption(option);
                setValues((previous) => ({
                  ...previous,
                  vehicleModelId: option?.id ?? "",
                  year: "",
                  ...Object.fromEntries(fitmentQualifierKeys.map((key) => [key, ""])),
                }));
                setError("");
              }}
            />
          </div>
          <div className="product-field">
            <label htmlFor="parts-car-year">Model year</label>
            <select
              id="parts-car-year"
              value={values.year}
              disabled={!selectedModel}
              aria-invalid={!!error && !years.includes(values.year)}
              onChange={(event) =>
                setValues((previous) => ({ ...previous, year: event.target.value }))
              }
            >
              <option value="">Choose year</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <small>Use the vehicle&apos;s model year.</small>
          </div>
          <button
            className="button"
            type="submit"
            disabled={!!model.error || model.loading}
          >
            Find matching parts
          </button>
        </div>
        {model.error && (
          <p role="alert">
            The selected model could not be loaded.{" "}
            <button type="button" onClick={model.refresh}>
              Retry model
            </button>
          </p>
        )}
        {error && (
          <p className="product-field-error" role="alert">
            {error}
          </p>
        )}
        <details className="parts-car-details">
          <summary>
            More vehicle details <span>(optional, required for some parts)</span>
          </summary>
          <p>
            Unknown details are never treated as confirmation. For brakes, confirm the
            axle and brake hardware; include engine, trim and market where applicable.
          </p>
          <div className="parts-car-qualifiers">
            {fitmentQualifierKeys.map((key) => (
              <div className="product-field" key={key}>
                <label htmlFor={`parts-car-${key}`}>{fitmentLabels[key]}</label>
                <input
                  id={`parts-car-${key}`}
                  value={values[key]}
                  maxLength={100}
                  autoComplete="off"
                  onChange={(event) =>
                    setValues((previous) => ({ ...previous, [key]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </details>
        {initial.has("vehicleModelId") && (
          <div className="parts-selected-car">
            <p>
              Checking{" "}
              {selectedModel
                ? `${selectedModel.make.name} ${selectedModel.name}`
                : "selected vehicle"}{" "}
              · {initial.get("year")}. Availability is for collection only.
            </p>
            <button type="button" onClick={() => update(clearVehicleSelection)}>
              Clear selected vehicle
            </button>
            <label>
              <input
                type="checkbox"
                checked={values.fitment === "verified"}
                onChange={(event) => {
                  const value = event.target.checked ? "verified" : "candidates";
                  setValues((previous) => ({ ...previous, fitment: value }));
                  if (
                    selectedModel &&
                    selectedModel.makeId === effectiveMakeId &&
                    years.includes(values.year)
                  )
                    update((params) => {
                      clearVehicleSelection(params);
                      for (const key of vehicleSelectionKeys) {
                        const chosen = key === "fitment" ? value : values[key].trim();
                        if (chosen) params.set(key, chosen);
                      }
                      params.set("vehicleMakeId", effectiveMakeId);
                    });
                }}
              />{" "}
              Show verified matches only
            </label>
          </div>
        )}
      </form>
    </section>
  );
}
