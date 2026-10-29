"use client";

import { useEffect, useRef, useState } from "react";
import { useCatalogueFilterPanel } from "@/lib/use-catalogue-filter-panel";
import { useFilterMatchPreview } from "@/lib/use-filter-match-preview";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import {
  advancedProductKeys,
  validProductText,
  clearProductFamilyFilters,
  normalizeProductQuery,
} from "@/lib/product-discovery";
import { ProductNameField } from "./product-name-field";
import { ProductOptionField } from "./product-option-field";
import { normalizeOilGrade, validOilGrade } from "@/lib/product-family";
import { koboToInput, nairaToKobo } from "@/lib/format/currency-input";

export type UpdateProductQuery = (change: (params: URLSearchParams) => void) => void;

export function ProductSearch({
  value,
  update,
}: {
  value: string;
  update: UpdateProductQuery;
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
      data-no-draft
      className="product-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit(text);
      }}
    >
      <label htmlFor="product-search">Search products</label>
      <input
        id="product-search"
        data-learning-target="parts-search"
        type="search"
        placeholder="Search engine oil, brake pads, a brand or part number"
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
        className="product-search-submit"
        aria-label="Search products"
      >
        <Search size={18} aria-hidden="true" />
      </button>
    </form>
  );
}

const labels: Record<string, string> = {
  family: "Product family",
  oilViscosityGrade: "Viscosity grade",
  packVolumeMl: "Pack volume",
  brand: "Brand",
  make: "Vehicle make (exact name)",
  model: "Vehicle model (exact name)",
  year: "Year",
  featured: "Featured products",
  minPriceKobo: "Minimum price (NGN)",
  maxPriceKobo: "Maximum price (NGN)",
  availability: "Availability",
  condition: "Part condition",
  classification: "OEM / aftermarket",
  productType: "Product type",
};

export function ProductFilters({
  query,
  count,
  update,
  scope,
  totalMatches,
}: {
  query: string;
  scope: string;
  count: number;
  totalMatches?: number;
  update: UpdateProductQuery;
}) {
  const panel = useCatalogueFilterPanel();
  const { dialog, trigger, open, close } = panel;
  function readValues() {
    const params = new URLSearchParams(query);
    return Object.fromEntries(
      advancedProductKeys.map((key) => [
        key,
        key === "minPriceKobo" || key === "maxPriceKobo"
          ? koboToInput(params.get(key) ?? "")
          : (params.get(key) ?? ""),
      ]),
    );
  }
  const [values, setValues] = useState<Record<string, string>>(readValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previous, setPrevious] = useState(query);
  const optionScope = new URLSearchParams(scope);
  if ((optionScope.get("family") ?? "") !== values.family)
    clearProductFamilyFilters(optionScope);
  if (values.family) optionScope.set("family", values.family);
  else optionScope.delete("family");
  if (values.family === "ENGINE_OIL") {
    optionScope.delete("condition");
    optionScope.delete("classification");
  } else {
    optionScope.delete("oilViscosityGrade");
    optionScope.delete("packVolumeMl");
  }
  if (previous !== query) {
    setPrevious(query);
    setValues(readValues());
    setErrors({});
  }
  const draft = new URLSearchParams(scope);
  let validDraft = true;
  for (const key of advancedProductKeys) {
    draft.delete(key);
    if (!values[key].trim()) continue;
    try {
      draft.set(
        key,
        key.endsWith("Kobo")
          ? nairaToKobo(values[key])
          : key === "oilViscosityGrade"
            ? normalizeOilGrade(values[key])
            : values[key].trim(),
      );
    } catch {
      validDraft = false;
    }
  }
  const normalized = normalizeProductQuery(draft);
  validDraft = validDraft && !normalized.invalid;
  const draftQuery = normalized.params;
  const appliedQuery = normalizeProductQuery(new URLSearchParams(scope)).params;
  for (const params of [draftQuery, appliedQuery]) {
    for (const key of ["cursor", "_trail", "sort"]) params.delete(key);
    params.set("limit", "1");
  }
  const changed = draftQuery.toString() !== appliedQuery.toString();
  const preview = useFilterMatchPreview(
    open && validDraft && changed
      ? `/public/catalog/products/discovery?${draftQuery}`
      : null,
  );
  const matches = changed ? preview.count : totalMatches;
  function renderField(key: (typeof advancedProductKeys)[number]) {
    return (
      <div className="product-field" key={key}>
        <label htmlFor={`product-filter-${key}`}>{labels[key]}</label>
        {key === "family" ||
        key === "brand" ||
        key === "productType" ||
        key === "oilViscosityGrade" ||
        key === "packVolumeMl" ? (
          <ProductOptionField
            field={key}
            value={values[key]}
            scope={optionScope.toString()}
            open={open}
            error={errors[key]}
            onChange={(value) => {
              setValues((previous) => ({
                ...previous,
                [key]: value,
                ...(key === "family"
                  ? {
                      condition: "",
                      classification: "",
                      oilViscosityGrade: "",
                      packVolumeMl: "",
                      productType: "",
                    }
                  : {}),
              }));
              setErrors({});
            }}
          />
        ) : key === "condition" || key === "classification" ? (
          <select
            id={`product-filter-${key}`}
            value={values[key]}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                [key]: event.target.value,
              }))
            }
          >
            <option value="">Any</option>
            {(key === "condition"
              ? [
                  ["NEW", "New"],
                  ["USED", "Used"],
                  ["REFURBISHED", "Refurbished"],
                ]
              : [
                  ["GENUINE_OEM", "Genuine OEM"],
                  ["AFTERMARKET", "Aftermarket"],
                ]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : key === "featured" || key === "availability" ? (
          <div className="product-select">
            <select
              id={`product-filter-${key}`}
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            >
              <option value="">Any</option>
              {key === "featured" ? (
                <>
                  <option value="true">Featured only</option>
                  <option value="false">Non-featured only</option>
                </>
              ) : (
                <>
                  <option value="in_stock">In stock</option>
                  <option value="out_of_stock">Out of stock</option>
                </>
              )}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        ) : key === "make" || key === "model" ? (
          <ProductNameField
            kind={key}
            error={errors[key]}
            value={values[key]}
            make={values.make}
            open={open}
            onChange={(value) => {
              setValues((v) => ({
                ...v,
                [key]: value,
                ...(key === "make" ? { model: "" } : {}),
              }));
              setErrors((v) => ({ ...v, [key]: "" }));
            }}
          />
        ) : (
          <input
            id={`product-filter-${key}`}
            value={values[key]}
            maxLength={key === "year" ? 4 : 20}
            inputMode={key === "year" ? "numeric" : "decimal"}
            aria-invalid={!!errors[key]}
            aria-describedby={
              errors[key]
                ? `product-filter-${key}-error`
                : key.endsWith("Kobo")
                  ? `product-filter-${key}-hint`
                  : key === "year"
                    ? "product-year-hint"
                    : undefined
            }
            onChange={(e) => {
              setValues((v) => ({ ...v, [key]: e.target.value }));
              setErrors((v) => ({ ...v, [key]: "" }));
            }}
          />
        )}
        {key.endsWith("Kobo") && (
          <small id={`product-filter-${key}-hint`}>
            Naira, for example 25000 or 25000.50. Leave blank for no limit.
          </small>
        )}
        {key === "year" && (
          <small id="product-year-hint">Enter a year between 1886 and 2200.</small>
        )}
        {errors[key] && (
          <p
            className="product-field-error"
            role="alert"
            id={`product-filter-${key}-error`}
          >
            {errors[key]}
          </p>
        )}
      </div>
    );
  }
  return (
    <>
      <button
        ref={trigger}
        className="product-filter-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="product-filter-panel"
        onClick={() => {
          if (open) return close();
          setValues(readValues());
          setErrors({});
          panel.show();
        }}
      >
        <SlidersHorizontal size={17} aria-hidden="true" /> Filters{" "}
        {count > 0 && <span className="product-filter-count">{count}</span>}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        id="product-filter-panel"
        className="product-filter-panel"
        data-layout-ready={panel.ready}
        role={panel.desktop ? "region" : undefined}
        aria-labelledby="product-filter-heading"
        onClose={panel.onClose}
        onKeyDown={panel.onKeyDown}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            panel.applied();
        }}
      >
        <form
          data-no-draft
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const nextErrors: Record<string, string> = {};
            for (const key of ["brand", "make", "model"])
              if (!validProductText(values[key].trim()))
                nextErrors[key] = "Use up to 100 characters without control characters.";
            if (
              values.year.trim() &&
              (!/^\d{4}$/.test(values.year.trim()) ||
                +values.year < 1886 ||
                +values.year > 2200)
            )
              nextErrors.year = "Enter a year between 1886 and 2200.";
            const amounts: Record<string, string> = {};
            if (values.oilViscosityGrade && !validOilGrade(values.oilViscosityGrade))
              nextErrors.oilViscosityGrade = "Choose a recorded viscosity grade.";
            if (values.packVolumeMl && !/^[1-9][0-9]{0,6}$/.test(values.packVolumeMl))
              nextErrors.packVolumeMl = "Choose a recorded pack volume.";
            for (const key of ["minPriceKobo", "maxPriceKobo"]) {
              if (!values[key].trim()) continue;
              try {
                const amount = nairaToKobo(values[key]);
                if (BigInt(amount) > BigInt("9999999999999999"))
                  throw new Error("Amount too large");
                amounts[key] = amount;
              } catch {
                nextErrors[key] = "Enter a valid amount with up to two decimal places.";
              }
            }
            if (
              amounts.minPriceKobo &&
              amounts.maxPriceKobo &&
              BigInt(amounts.minPriceKobo) > BigInt(amounts.maxPriceKobo)
            )
              nextErrors.maxPriceKobo = "Must not be below the minimum price.";
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length) {
              document
                .getElementById(`product-filter-${Object.keys(nextErrors)[0]}`)
                ?.focus();
              return;
            }
            update((params) => {
              for (const key of advancedProductKeys) {
                params.delete(key);
                if (values[key].trim())
                  params.set(
                    key,
                    amounts[key] ??
                      (key === "oilViscosityGrade"
                        ? normalizeOilGrade(values[key])
                        : values[key].trim()),
                  );
              }
            });
            close();
          }}
        >
          <div className="product-filter-header">
            <div>
              <h3 id="product-filter-heading">Filter products</h3>
              <p>
                Choose any details you know, then apply. Blank fields match any value.
              </p>
            </div>
            <button
              type="button"
              className="product-icon-button"
              aria-label="Close filters"
              onClick={close}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="product-filter-fields">
            <fieldset
              className="product-filter-range"
              aria-describedby="product-budget-hint"
            >
              <legend>Budget (NGN)</legend>
              <div className="product-budget-fields">
                {(["minPriceKobo", "maxPriceKobo"] as const).map((key) => (
                  <div className="product-field" key={key}>
                    <label htmlFor={`product-filter-${key}`}>
                      {key === "minPriceKobo" ? "Minimum" : "Maximum"}
                    </label>
                    <div className="product-money-input">
                      <span aria-hidden="true">₦</span>
                      <input
                        id={`product-filter-${key}`}
                        value={values[key]}
                        maxLength={20}
                        inputMode="decimal"
                        aria-invalid={!!errors[key]}
                        aria-describedby={`product-budget-hint${errors[key] ? ` product-filter-${key}-error` : ""}`}
                        onChange={(event) => {
                          setValues((v) => ({ ...v, [key]: event.target.value }));
                          setErrors((v) => ({ ...v, [key]: "" }));
                        }}
                      />
                    </div>
                    {errors[key] && (
                      <p
                        className="product-field-error"
                        id={`product-filter-${key}-error`}
                      >
                        {errors[key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <small id="product-budget-hint">
                Enter naira; leave either limit blank when it is not needed.
              </small>
            </fieldset>
            {advancedProductKeys
              .filter(
                (key): boolean =>
                  !["make", "model", "year", "minPriceKobo", "maxPriceKobo"].includes(
                    key,
                  ),
              )
              .filter((key) =>
                ["oilViscosityGrade", "packVolumeMl"].includes(key)
                  ? values.family === "ENGINE_OIL"
                  : ["condition", "classification"].includes(key)
                    ? values.family === "REPLACEMENT_PART" ||
                      (!values.family && !!values[key])
                    : true,
              )

              .filter((key) => !["productType", "featured"].includes(key))
              .map(renderField)}
            <details
              className="product-technical"
              open={!!(values.productType || values.featured)}
            >
              <summary>Technical details</summary>
              <div>{(["productType", "featured"] as const).map(renderField)}</div>
            </details>
            <p className="product-fitment-note">
              {values.family === "ENGINE_OIL"
                ? "Grades and pack volumes describe the recorded product. They do not establish manufacturer approval or vehicle suitability."
                : "Vehicle details can help identify candidates. Reviewed technical evidence is required to confirm compatibility; unknown specifications never confirm fitment."}
            </p>
          </div>
          <div className="product-filter-actions">
            <p className="catalogue-match-preview" role="status" aria-live="polite">
              {!validDraft
                ? "Review the entered filter values."
                : preview.pending
                  ? "Checking matches…"
                  : preview.error
                    ? "Count unavailable. You can still apply filters."
                    : matches === undefined
                      ? "Apply to check matching products."
                      : `${matches.toLocaleString("en-NG")} matching product${matches === 1 ? "" : "s"}`}
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setValues(
                  Object.fromEntries(advancedProductKeys.map((key) => [key, ""])),
                );
                setErrors({});
              }}
            >
              Reset draft
            </button>
            <button type="submit" className="button" data-scroll-target="product-results">
              Apply filters
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
