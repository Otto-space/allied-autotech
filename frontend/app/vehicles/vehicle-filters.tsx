"use client";

import { useEffect, useRef, useState } from "react";
import { containDialogFocus } from "@/lib/dialog-focus";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { CountryField } from "../components/country-field";
import { countryCodes, europeanCountryCodes } from "@/lib/reference/countries";
import { VehicleNameField } from "./vehicle-name-field";
import {
  advancedVehicleKeys,
  koboToInput,
  nairaToKobo,
  vehicleChoices,
  vehicleLabel,
} from "@/lib/vehicle-discovery";

export type UpdateVehicleQuery = (change: (params: URLSearchParams) => void) => void;

export function VehicleSearch({
  value,
  update,
}: {
  value: string;
  update: UpdateVehicleQuery;
}) {
  const [text, setText] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setText(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composing = useRef(false);
  useEffect(() => {
    const cancel = () => clearTimeout(timer.current);
    const restore = () => {
      cancel();
      setText(new URLSearchParams(window.location.search).get("search") ?? "");
    };
    window.addEventListener("popstate", restore);
    return () => {
      cancel();
      window.removeEventListener("popstate", restore);
    };
  }, [value]);
  function submit(next: string) {
    clearTimeout(timer.current);
    update((params) => {
      params.delete("search");
      if (next.trim()) params.set("search", next.trim());
    });
  }
  function schedule(next: string) {
    clearTimeout(timer.current);
    if (!composing.current) timer.current = setTimeout(() => submit(next), 400);
  }
  return (
    <form
      data-draft-key="vehicle-filters:1"
      className="vehicle-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit(text);
      }}
    >
      <label htmlFor="vehicle-search">Search vehicles</label>
      <input
        id="vehicle-search"
        type="search"
        placeholder="Make, model or title"
        maxLength={100}
        value={text}
        onCompositionStart={() => {
          composing.current = true;
          clearTimeout(timer.current);
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          schedule(event.currentTarget.value);
        }}
        onChange={(event) => {
          setText(event.target.value);
          schedule(event.target.value);
        }}
      />
      <button
        type="submit"
        className="vehicle-search-submit"
        aria-label="Search vehicles"
      >
        <Search size={18} aria-hidden="true" />
      </button>
    </form>
  );
}

const labels: Record<string, string> = {
  make: "Make (exact name)",
  model: "Model (exact name)",
  year: "Year",
  minPriceKobo: "Minimum price (NGN)",
  maxPriceKobo: "Maximum price (NGN)",
  bodyType: "Body type",
  transmission: "Transmission",
  fuelType: "Fuel type",
  featured: "Featured listings",
  trim: "Trim (exact name)",
  conditions: "Vehicle condition",
  powertrains: "Powertrain Technology",
  manufactureCountryCode: "Final assembly country",
  manufactureRegion: "Final assembly region",
  powertrain: "Powertrain",
  driveType: "Drivetrain",
  minYear: "Year from",
  maxYear: "Year to",
  minMileageKm: "Mileage from (km)",
  maxMileageKm: "Mileage to (km)",
  minEngineCapacityCc: "Engine capacity from (cc)",
  maxEngineCapacityCc: "Engine capacity to (cc)",
  seats: "Seats",
  color: "Colour (exact name)",
  feature: "Recorded feature (exact name)",
  inspected: "Condition report",
};

export function VehicleFilters({
  query,
  update,
  count,
}: {
  query: string;
  update: UpdateVehicleQuery;
  count: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  function readValues() {
    const params = new URLSearchParams(query);
    return Object.fromEntries(
      advancedVehicleKeys.map((key) => [
        key,
        key.endsWith("Kobo")
          ? koboToInput(params.get(key))
          : key === "conditions"
            ? (params.get("conditions") ?? params.get("condition") ?? "")
            : key === "powertrains"
              ? (params.get("powertrains") ?? params.get("powertrain") ?? "")
              : ["condition", "powertrain"].includes(key)
                ? ""
                : (params.get(key) ?? ""),
      ]),
    );
  }
  const [values, setValues] = useState<Record<string, string>>(readValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previousQuery, setPreviousQuery] = useState(query);
  if (previousQuery !== query) {
    setPreviousQuery(query);
    setValues(readValues());
    setErrors({});
  }
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    function resize() {
      dialog.current?.close();
    }
    media.addEventListener("change", resize);
    const prior = document.body.style.overflow;
    if (open && media.matches) document.body.style.overflow = "hidden";
    return () => {
      media.removeEventListener("change", resize);
      document.body.style.overflow = prior;
    };
  }, [open]);
  function close() {
    dialog.current?.close();
  }
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const min = nairaToKobo(values.minPriceKobo),
      max = nairaToKobo(values.maxPriceKobo);
    for (const [key, amount] of [
      ["minPriceKobo", min],
      ["maxPriceKobo", max],
    ]) {
      if (amount === undefined)
        nextErrors[key!] =
          "Enter a price above zero, up to 99,999,999,999,999.99, with at most two decimal places. Use digits without commas.";
    }
    if (min && max && BigInt(min) > BigInt(max))
      nextErrors.maxPriceKobo = "Maximum price must be at least the minimum price.";
    if (
      values.year &&
      (!/^\d{4}$/.test(values.year) || +values.year < 1886 || +values.year > 2200)
    )
      nextErrors.year = "Enter a year between 1886 and 2200.";
    for (const [key, minimum, maximum] of [
      ["minYear", 1886, 2200],
      ["maxYear", 1886, 2200],
      ["minMileageKm", 0, 10000000],
      ["maxMileageKm", 0, 10000000],
      ["minEngineCapacityCc", 1, 30000],
      ["maxEngineCapacityCc", 1, 30000],
      ["seats", 1, 100],
    ] as const) {
      const value = values[key];
      if (value && (!/^\d{1,8}$/.test(value) || +value < minimum || +value > maximum))
        nextErrors[key] = `Enter a whole number from ${minimum} to ${maximum}.`;
    }
    for (const [minKey, maxKey] of [
      ["minYear", "maxYear"],
      ["minMileageKm", "maxMileageKm"],
      ["minEngineCapacityCc", "maxEngineCapacityCc"],
    ]) {
      if (values[minKey] && values[maxKey] && +values[minKey] > +values[maxKey])
        nextErrors[maxKey] = "Maximum must be at least the minimum.";
    }
    if (values.model && !values.make) nextErrors.make = "Choose a make before a model.";
    if (
      values.year &&
      ((values.minYear && +values.year < +values.minYear) ||
        (values.maxYear && +values.year > +values.maxYear))
    )
      nextErrors.year = "Year conflicts with the selected range.";
    if (values.manufactureCountryCode && !countryCodes.has(values.manufactureCountryCode))
      nextErrors.manufactureCountryCode =
        "Choose a country from the suggestions or clear the field.";
    if (
      values.manufactureRegion &&
      countryCodes.has(values.manufactureCountryCode) &&
      !(europeanCountryCodes as readonly string[]).includes(values.manufactureCountryCode)
    )
      nextErrors.manufactureCountryCode =
        "Choose a European country or clear the region.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(`filter-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    update((params) => {
      for (const key of advancedVehicleKeys) {
        const value =
          key === "minPriceKobo"
            ? min
            : key === "maxPriceKobo"
              ? max
              : values[key].trim();
        params.delete(key);
        if (value) params.set(key, value);
      }
    });
    close();
  }
  return (
    <>
      <button
        ref={trigger}
        className="vehicle-filter-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="vehicle-filter-panel"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          if (window.matchMedia("(max-width: 767px)").matches)
            dialog.current?.showModal();
          else dialog.current?.show();
          setOpen(true);
        }}
      >
        <SlidersHorizontal size={17} aria-hidden="true" /> Filters{" "}
        {count > 0 && <span className="vehicle-filter-count">{count}</span>}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        id="vehicle-filter-panel"
        className="vehicle-filter-panel"
        aria-labelledby="vehicle-filter-heading"
        onKeyDown={(event) => {
          if (event.currentTarget.matches(":modal")) containDialogFocus(event);
        }}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus({ preventScroll: true });
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const r = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < r.left ||
              event.clientX > r.right ||
              event.clientY < r.top ||
              event.clientY > r.bottom
            )
              close();
          }
        }}
      >
        <form data-draft-key="vehicle-filters:2" noValidate onSubmit={apply}>
          <div className="vehicle-filter-header">
            <div>
              <h3 id="vehicle-filter-heading">Filter vehicles</h3>
              <p>
                Choose any details you know, then apply. Blank fields match any value.
              </p>
            </div>
            <button
              type="button"
              className="vehicle-icon-button"
              aria-label="Close filters"
              onClick={close}
            >
              <X size={20} />
            </button>
          </div>
          <div className="vehicle-filter-body">
            <div className="vehicle-origin-presets" aria-label="Final assembly shortcuts">
              <span>Final assembly:</span>
              {[
                ["CN", "China"],
                ["JP", "Japan"],
                ["KR", "South Korea"],
                ["NG", "Nigeria"],
                ["EUROPE", "Europe"],
              ].map(([code, label]) => (
                <button
                  type="button"
                  key={code}
                  aria-pressed={
                    code === "EUROPE"
                      ? values.manufactureRegion === code
                      : values.manufactureCountryCode === code
                  }
                  onClick={() =>
                    setValues((v) => ({
                      ...v,
                      manufactureCountryCode: code === "EUROPE" ? "" : code,
                      manufactureRegion: code === "EUROPE" ? code : "",
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="vehicle-filter-hint">
              Origin means final assembly country. Unknown origin and specifications
              remain unspecified.
            </p>
            {[
              [
                "Vehicle",
                [
                  "make",
                  "model",
                  "trim",
                  "conditions",
                  "manufactureCountryCode",
                  "manufactureRegion",
                ],
              ],
              [
                "Price, year and mileage",
                [
                  "minPriceKobo",
                  "maxPriceKobo",
                  "year",
                  "minYear",
                  "maxYear",
                  "minMileageKm",
                  "maxMileageKm",
                ],
              ],
              [
                "Specifications",
                [
                  "bodyType",
                  "powertrains",
                  "fuelType",
                  "transmission",
                  "driveType",
                  "minEngineCapacityCc",
                  "maxEngineCapacityCc",
                  "seats",
                  "color",
                  "feature",
                  "inspected",
                  "featured",
                ],
              ],
            ].map(([heading, keys]) => (
              <details className="vehicle-filter-group" key={heading as string} open>
                <summary>{heading}</summary>
                <div className="vehicle-filter-fields">
                  {(keys as string[]).map((key) => (
                    <div className="vehicle-field" key={key}>
                      {!["conditions", "powertrains"].includes(key) && (
                        <label htmlFor={`filter-${key}`}>{labels[key]}</label>
                      )}
                      {key === "conditions" || key === "powertrains" ? (
                        <fieldset className="vehicle-multiple-options">
                          <legend>{labels[key]}</legend>
                          <p>Choose any that apply. Leave all unchecked for any.</p>
                          {vehicleChoices[
                            key === "conditions" ? "condition" : "powertrain"
                          ].map((option) => (
                            <label key={option}>
                              <input
                                type="checkbox"
                                checked={values[key].split(",").includes(option)}
                                onChange={(event) =>
                                  setValues((previous) => {
                                    const selected = new Set(
                                      previous[key].split(",").filter(Boolean),
                                    );
                                    if (event.target.checked) selected.add(option);
                                    else selected.delete(option);
                                    return {
                                      ...previous,
                                      [key]: [...selected].join(","),
                                    };
                                  })
                                }
                              />
                              <span>
                                {vehicleLabel(option)}
                                {key === "powertrains" && (
                                  <small>
                                    {
                                      {
                                        BEV: "Runs on battery power.",
                                        HEV: "Combines an engine and electric motor.",
                                        PHEV: "Can charge externally.",
                                        ICE: "Uses petrol or diesel combustion.",
                                      }[option as "BEV" | "HEV" | "PHEV" | "ICE"]
                                    }
                                  </small>
                                )}
                              </span>
                            </label>
                          ))}
                        </fieldset>
                      ) : key === "make" || key === "model" ? (
                        <VehicleNameField
                          kind={key}
                          value={values[key]}
                          make={values.make}
                          open={open}
                          onChange={(value) =>
                            setValues((previous) => ({
                              ...previous,
                              [key]: value,
                              ...(key === "make"
                                ? { model: "", trim: "" }
                                : { trim: "" }),
                            }))
                          }
                        />
                      ) : key === "manufactureCountryCode" ? (
                        <CountryField
                          id={`filter-${key}`}
                          value={values[key]}
                          europeOnly={values.manufactureRegion === "EUROPE"}
                          invalid={!!errors[key]}
                          describedBy={errors[key] ? `filter-${key}-error` : undefined}
                          onChange={(value) => {
                            setValues((v) => ({
                              ...v,
                              [key]: value,
                              ...(countryCodes.has(value) &&
                              !(europeanCountryCodes as readonly string[]).includes(value)
                                ? { manufactureRegion: "" }
                                : {}),
                            }));
                            setErrors((v) => ({ ...v, [key]: "" }));
                          }}
                        />
                      ) : key in vehicleChoices ? (
                        <div className="vehicle-select">
                          <select
                            id={`filter-${key}`}
                            value={values[key]}
                            onChange={(e) =>
                              setValues((v) => ({
                                ...v,
                                [key]: e.target.value,
                                ...(key === "manufactureRegion" &&
                                e.target.value === "EUROPE" &&
                                !(europeanCountryCodes as readonly string[]).includes(
                                  v.manufactureCountryCode,
                                )
                                  ? { manufactureCountryCode: "" }
                                  : {}),
                              }))
                            }
                          >
                            <option value="">Any</option>
                            {vehicleChoices[key as keyof typeof vehicleChoices].map(
                              (option) => (
                                <option key={option} value={option}>
                                  {key === "featured"
                                    ? option === "true"
                                      ? "Featured only"
                                      : "Non-featured only"
                                    : key === "inspected"
                                      ? option === "true"
                                        ? "Report available"
                                        : "No report recorded"
                                      : vehicleLabel(option)}
                                </option>
                              ),
                            )}
                          </select>
                          <ChevronDown size={16} aria-hidden="true" />
                        </div>
                      ) : (
                        <input
                          id={`filter-${key}`}
                          value={values[key]}
                          inputMode={
                            key.endsWith("Kobo")
                              ? "decimal"
                              : [
                                    "year",
                                    "minYear",
                                    "maxYear",
                                    "minMileageKm",
                                    "maxMileageKm",
                                    "minEngineCapacityCc",
                                    "maxEngineCapacityCc",
                                    "seats",
                                  ].includes(key)
                                ? "numeric"
                                : undefined
                          }
                          maxLength={key === "year" ? 4 : key.endsWith("Kobo") ? 18 : 80}
                          aria-invalid={!!errors[key]}
                          aria-describedby={
                            errors[key]
                              ? `filter-${key}-error`
                              : key.endsWith("Kobo")
                                ? `filter-${key}-hint`
                                : ["make", "model"].includes(key)
                                  ? `filter-${key}-hint`
                                  : undefined
                          }
                          onChange={(e) => {
                            setValues((v) => ({ ...v, [key]: e.target.value }));
                            setErrors((v) => ({ ...v, [key]: "" }));
                          }}
                        />
                      )}
                      {key.endsWith("Kobo") && (
                        <small id={`filter-${key}-hint`}>
                          Naira, for example 4500000. Leave blank for no limit.
                        </small>
                      )}
                      {["make", "model"].includes(key) && (
                        <small id={`filter-${key}-hint`}>
                          Matches the full {key} name.
                        </small>
                      )}
                      {errors[key] && (
                        <p
                          id={`filter-${key}-error`}
                          className="vehicle-field-error"
                          role="alert"
                        >
                          {errors[key]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
          <div className="vehicle-filter-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setValues(
                  Object.fromEntries(advancedVehicleKeys.map((key) => [key, ""])),
                );
                setErrors({});
                update((params) => {
                  for (const key of advancedVehicleKeys) params.delete(key);
                  params.delete("search");
                });
              }}
            >
              Clear filters
            </button>
            <button className="button" type="submit">
              Apply filters
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
