"use client";
import { useEffect, useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseProductFacets } from "@/lib/api/commerce-schemas";
export function ProductOptionField({
  field,
  value,
  scope,
  open,
  onChange,
  error,
}: {
  field: "brand" | "family" | "productType" | "oilViscosityGrade" | "packVolumeMl";
  value: string;
  scope: string;
  open: boolean;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [prefix, setPrefix] = useState(field === "brand" ? value.trim() : "");
  useEffect(() => {
    const timer = setTimeout(() => setPrefix(field === "brand" ? value.trim() : ""), 250);
    return () => clearTimeout(timer);
  }, [field, value]);
  const query = new URLSearchParams({ field, scope, limit: "20" });
  if (prefix) query.set("search", prefix);
  const binding = query.toString();
  const [position, setPosition] = useState<{
    binding: string;
    cursors: (string | undefined)[];
  }>({ binding, cursors: [undefined] });
  if (position.binding !== binding) setPosition({ binding, cursors: [undefined] });
  const cursors = position.binding === binding ? position.cursors : [undefined],
    cursor = cursors.at(-1);
  if (cursor) query.set("cursor", cursor);
  const resource = useResource(
    open ? `/public/catalog/products/options?${query}` : null,
    parseProductFacets,
  );
  const available = !resource.loading && !resource.error && !resource.refreshError;
  const options = available ? (resource.data?.items ?? []) : [];
  const describedBy = `product-option-${field}-state${error ? ` product-filter-${field}-error` : ""}`;
  return (
    <>
      {field === "brand" ? (
        <>
          <input
            id={`product-filter-${field}`}
            value={value}
            maxLength={100}
            list="product-brand-choices"
            aria-invalid={!!error}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
          />
          <datalist id="product-brand-choices">
            {options.map((option) => (
              <option key={option.value} value={option.label} />
            ))}
          </datalist>
        </>
      ) : (
        <select
          id={`product-filter-${field}`}
          value={value}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Any</option>
          {value && !options.some((option) => option.value === value) && (
            <option value={value}>Selected: {value.replaceAll("_", " ")}</option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      <div className="product-option-state" id={`product-option-${field}-state`}>
        {resource.loading ? (
          <small>Loading recorded choices…</small>
        ) : resource.error || resource.refreshError ? (
          <>
            <small>Recorded choices could not be loaded.</small>
            <button type="button" onClick={resource.refresh}>
              Retry choices
            </button>
          </>
        ) : options.length === 0 ? (
          <small>No recorded choices for the current applied search.</small>
        ) : field === "brand" ? (
          <small>Choose a suggestion or enter the full brand name.</small>
        ) : null}
        {cursor && (
          <button
            type="button"
            onClick={() => setPosition({ binding, cursors: cursors.slice(0, -1) })}
          >
            Previous choices
          </button>
        )}
        {available && resource.data?.nextCursor && (
          <button
            type="button"
            onClick={() =>
              setPosition({ binding, cursors: [...cursors, resource.data!.nextCursor] })
            }
          >
            More choices
          </button>
        )}
      </div>
    </>
  );
}
