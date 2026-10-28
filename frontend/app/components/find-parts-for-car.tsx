"use client";

import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import {
  clearVehicleSelection,
  fitmentLabels,
  fitmentOptionsSchema,
  fitmentQualifierKeys,
  parseFitmentModel,
  partsEnquiryHref,
  vehicleSelectionKeys,
  type FitmentOption,
} from "@/lib/parts-fitment";
import { FitmentCataloguePicker } from "./fitment-catalogue-picker";
import { SavedPartsVehicleSelector } from "./saved-parts-vehicle-selector";
import type { UpdateProductQuery } from "../parts/product-filters";

const parseMakes = (value: unknown) => fitmentOptionsSchema.parse(value);
export const usePartsMakeCatalogue = () =>
  useResource("/public/fitment/makes?limit=1", parseMakes);

export function FindPartsForCar({
  query,
  enquiryQuery,
  update,
  makes,
}: {
  query: string;
  enquiryQuery?: string;
  update: UpdateProductQuery;
  makes: ReturnType<typeof usePartsMakeCatalogue>;
}) {
  const unavailable = !makes.loading && !makes.error && makes.data?.items.length === 0;
  return (
    <section className="parts-car-finder" aria-labelledby="parts-car-title">
      <div className="parts-car-heading">
        <div>
          <h3 id="parts-car-title">
            {unavailable ? "Get help choosing a product" : "Find products for my vehicle"}
          </h3>
          <p>
            Find possible matches using your vehicle details. Confirm suitability with our
            team before you order.
          </p>
        </div>
        {!unavailable && (
          <Link href={partsEnquiryHref(new URLSearchParams(enquiryQuery ?? query))}>
            Get help choosing a product
          </Link>
        )}
      </div>
      {makes.loading ? (
        <p role="status">Checking vehicle choices…</p>
      ) : makes.error || makes.refreshError ? (
        <div role="status">
          <p>Vehicle choices could not be checked. Retry or ask our team for help.</p>
          <button className="button secondary" type="button" onClick={makes.refresh}>
            Retry vehicle choices
          </button>
        </div>
      ) : unavailable ? (
        <div className="parts-finder-unavailable" role="status">
          <p>
            Vehicle choices are not available in our parts finder yet. Send the make,
            model, year and part you need so our team can help check suitability.
          </p>
          <Link
            className="button secondary"
            href={partsEnquiryHref(new URLSearchParams(enquiryQuery ?? query))}
          >
            Ask our team to check
          </Link>
        </div>
      ) : (
        <>
          <SavedPartsVehicleSelector
            returnTo={`/parts${enquiryQuery || query ? `?${enquiryQuery ?? query}` : ""}`}
            onUse={(saved) =>
              update((params) => {
                clearVehicleSelection(params);
                for (const [key, value] of saved) params.set(key, value);
              })
            }
          />
          {makes.error && (
            <p role="status">
              Vehicle choices could not be checked.{" "}
              <button type="button" onClick={makes.refresh}>
                Retry vehicle choices
              </button>{" "}
              or request help above.
            </p>
          )}
          <CarSelectionDraft
            key={query}
            query={query}
            enquiryQuery={enquiryQuery}
            update={update}
          />
        </>
      )}
    </section>
  );
}

function CarSelectionDraft({
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
  const [resetNotice, setResetNotice] = useState("");
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
  const enquiry = new URLSearchParams(enquiryQuery ?? query);
  for (const key of vehicleSelectionKeys) {
    enquiry.delete(key);
    if (values[key]?.trim()) enquiry.set(key, values[key].trim());
  }
  return (
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
          setError(
            "Choose your vehicle make and model from the suggestions, then choose a supported model year.",
          );
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
              if (option?.id === effectiveMakeId) return;
              if (values.vehicleModelId)
                setResetNotice(
                  "Vehicle make changed. Choose the matching model and year again; details for the previous vehicle were cleared.",
                );
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
              if (option?.id === values.vehicleModelId) return;
              if (values.year)
                setResetNotice(
                  "Vehicle model changed. Choose a supported year again; details for the previous model were cleared.",
                );
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
      <p className="parts-finder-prerequisite">
        Choose a make, then a model and year. Select a suggestion rather than only typing
        its name.
      </p>
      {resetNotice && <p role="status">{resetNotice}</p>}
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
          All technical details <span>— add only what you know</span>
        </summary>
        <p>
          Different parts need different specifications. These groups help you describe
          the vehicle; unknown details never confirm compatibility.
        </p>
        {[
          {
            title: "Engine and vehicle configuration",
            keys: [
              "engineCode",
              "trim",
              "market",
              "bodyType",
              "transmission",
              "generation",
              "chassisCode",
            ] as const,
          },
          {
            title: "Brakes and position",
            keys: ["position", "brakeSystem", "brakeDiameterMm"] as const,
          },
        ].map((group) => (
          <details className="parts-technical-group" key={group.title}>
            <summary>{group.title}</summary>
            <div className="parts-car-qualifiers">
              {group.keys.map((key) => (
                <div className="product-field" key={key}>
                  <label htmlFor={`parts-car-${key}`}>{fitmentLabels[key]}</label>
                  <input
                    id={`parts-car-${key}`}
                    value={values[key]}
                    maxLength={100}
                    autoComplete="off"
                    onChange={(event) =>
                      setValues((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </details>
        ))}
      </details>
      <Link className="text-link parts-fitment-unknown" href={partsEnquiryHref(enquiry)}>
        I don’t know — help me check
      </Link>
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
  );
}
