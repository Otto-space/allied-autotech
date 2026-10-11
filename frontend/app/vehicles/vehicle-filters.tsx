"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
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
        key.endsWith("Kobo") ? koboToInput(params.get(key)) : (params.get(key) ?? ""),
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
          if (event.key !== "Tab" || !event.currentTarget.matches(":modal")) return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]",
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
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
              <p>Refine your search. All fields are optional.</p>
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
          <div className="vehicle-filter-fields">
            {advancedVehicleKeys.map((key) => (
              <div className="vehicle-field" key={key}>
                <label htmlFor={`filter-${key}`}>{labels[key]}</label>
                {key === "make" || key === "model" ? (
                  <VehicleNameField
                    kind={key}
                    value={values[key]}
                    make={values.make}
                    open={open}
                    onChange={(value) =>
                      setValues((previous) => ({
                        ...previous,
                        [key]: value,
                        ...(key === "make" ? { model: "" } : {}),
                      }))
                    }
                  />
                ) : key in vehicleChoices ? (
                  <div className="vehicle-select">
                    <select
                      id={`filter-${key}`}
                      value={values[key]}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [key]: e.target.value }))
                      }
                    >
                      <option value="">Any</option>
                      {vehicleChoices[
                        key as "bodyType" | "transmission" | "fuelType" | "featured"
                      ].map((option) => (
                        <option key={option} value={option}>
                          {key === "featured"
                            ? option === "true"
                              ? "Featured only"
                              : "Non-featured only"
                            : vehicleLabel(option)}
                        </option>
                      ))}
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
                        : key === "year"
                          ? "numeric"
                          : undefined
                    }
                    maxLength={key === "year" ? 4 : key.endsWith("Kobo") ? 18 : 80}
                    aria-invalid={!!errors[key]}
                    aria-describedby={
                      errors[key]
                        ? `filter-${key}-error`
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
                {["make", "model"].includes(key) && (
                  <small id={`filter-${key}-hint`}>Matches the full {key} name.</small>
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
