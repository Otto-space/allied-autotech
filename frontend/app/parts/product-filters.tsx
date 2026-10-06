"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { advancedProductKeys, validProductText } from "@/lib/product-discovery";

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
      data-draft-key="product-filters:1"
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
        type="search"
        placeholder="Name, brand or part number"
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

const labels = {
  brand: "Brand (exact name)",
  make: "Vehicle make (exact name)",
  model: "Vehicle model (exact name)",
  year: "Year",
  featured: "Featured products",
};

export function ProductFilters({
  query,
  count,
  update,
  clear,
}: {
  query: string;
  count: number;
  clear: () => void;
  update: UpdateProductQuery;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  function readValues() {
    const params = new URLSearchParams(query);
    return Object.fromEntries(
      advancedProductKeys.map((key) => [key, params.get(key) ?? ""]),
    );
  }
  const [values, setValues] = useState<Record<string, string>>(readValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previous, setPrevious] = useState(query);
  if (previous !== query) {
    setPrevious(query);
    setValues(readValues());
    setErrors({});
  }
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const resize = () => dialog.current?.close();
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
          if (window.matchMedia("(max-width: 767px)").matches)
            dialog.current?.showModal();
          else dialog.current?.show();
          setOpen(true);
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
        aria-labelledby="product-filter-heading"
        onClose={() => {
          setOpen(false);
          trigger.current?.focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
          if (event.key !== "Tab" || !event.currentTarget.matches(":modal")) return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            close();
        }}
      >
        <form
          data-draft-key="product-filters:2"
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
                +values.year > 2100)
            )
              nextErrors.year = "Enter a year between 1886 and 2100.";
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
                if (values[key].trim()) params.set(key, values[key].trim());
              }
            });
            close();
          }}
        >
          <div className="product-filter-header">
            <div>
              <h3 id="product-filter-heading">Filter products</h3>
              <p>Refine your search. All fields are optional.</p>
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
            {advancedProductKeys.map((key) => (
              <div className="product-field" key={key}>
                <label htmlFor={`product-filter-${key}`}>{labels[key]}</label>
                {key === "featured" ? (
                  <div className="product-select">
                    <select
                      id={`product-filter-${key}`}
                      value={values[key]}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [key]: e.target.value }))
                      }
                    >
                      <option value="">Any</option>
                      <option value="true">Featured only</option>
                      <option value="false">Non-featured only</option>
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </div>
                ) : (
                  <input
                    id={`product-filter-${key}`}
                    value={values[key]}
                    maxLength={key === "year" ? 4 : 100}
                    inputMode={key === "year" ? "numeric" : undefined}
                    aria-invalid={!!errors[key]}
                    aria-describedby={
                      errors[key]
                        ? `product-filter-${key}-error`
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
                {key === "year" && (
                  <small id="product-year-hint">
                    Enter a year between 1886 and 2100.
                  </small>
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
            ))}
            <p className="product-fitment-note">
              Compatibility follows the listed fitment details. Check the product
              specifications before purchase.
            </p>
          </div>
          <div className="product-filter-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setValues(
                  Object.fromEntries(advancedProductKeys.map((key) => [key, ""])),
                );
                setErrors({});
                clear();
              }}
            >
              Clear filters
            </button>
            <button type="submit" className="button">
              Apply filters
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
