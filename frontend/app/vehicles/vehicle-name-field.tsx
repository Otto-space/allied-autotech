"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";

const parseOptions = (value: unknown) =>
  z
    .object({
      items: z
        .array(
          z.object({
            value: z.string().min(1).max(80),
            label: z.string().min(1).max(80),
          }),
        )
        .max(20),
      nextCursor: z
        .string()
        .min(80)
        .max(1024)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
    })
    .parse(value);

export function VehicleNameField({
  kind,
  value,
  make,
  open,
  onChange,
}: {
  kind: "make" | "model";
  value: string;
  make?: string;
  open: boolean;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState(value.trim());
  useEffect(() => {
    const timer = setTimeout(() => setSearch(value.trim()), 250);
    return () => clearTimeout(timer);
  }, [value]);
  const query = new URLSearchParams({ field: kind, limit: "20" });
  if (kind === "model" && make?.trim()) query.set("make", make.trim());
  if (search) query.set("search", search);
  const binding = query.toString();
  const [position, setPosition] = useState<{
    binding: string;
    cursors: (string | undefined)[];
  }>({ binding, cursors: [undefined] });
  if (position.binding !== binding) setPosition({ binding, cursors: [undefined] });
  const cursors = position.binding === binding ? position.cursors : [undefined];
  const cursor = cursors.at(-1);
  if (cursor) query.set("cursor", cursor);
  const pending = value.trim() !== search;
  const enabled = open && !pending && (kind === "make" || !!make?.trim());
  const resource = useResource(
    enabled ? `/public/vehicles/facets?${query}` : null,
    parseOptions,
  );
  const busy = pending || resource.loading || resource.refreshing;
  const usable = enabled && !busy && !resource.error && !resource.refreshError;
  return (
    <>
      <input
        id={`filter-${kind}`}
        value={value}
        maxLength={80}
        list={`filter-${kind}-options`}
        aria-describedby={`filter-${kind}-hint filter-${kind}-options-state`}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={`filter-${kind}-options`}>
        {usable &&
          resource.data?.items.map((item) => (
            <option key={item.value} value={item.label} />
          ))}
      </datalist>
      <div className="vehicle-option-state" id={`filter-${kind}-options-state`}>
        {kind === "model" && !make?.trim() ? (
          <small>Enter a make to see model suggestions.</small>
        ) : busy ? (
          <small>Loading suggestions…</small>
        ) : resource.error || resource.refreshError ? (
          <>
            <small>Suggestions are unavailable. You can still enter the full name.</small>
            <button type="button" onClick={resource.refresh}>
              Retry {kind} suggestions
            </button>
            {cursor && (
              <button
                type="button"
                onClick={() => setPosition({ binding, cursors: [undefined] })}
              >
                First {kind} options
              </button>
            )}
          </>
        ) : usable && resource.data ? (
          <>
            <small>
              {resource.data.items.length
                ? `${resource.data.items.length} suggestion${resource.data.items.length === 1 ? "" : "s"} on this page. Choose a suggestion or enter the full name.`
                : "No matching suggestions. You can still enter the full name."}
            </small>
            {(cursor || resource.data.nextCursor) && (
              <div className="vehicle-option-pages">
                <button
                  type="button"
                  disabled={!cursor}
                  onClick={() => setPosition({ binding, cursors: cursors.slice(0, -1) })}
                >
                  Previous {kind} options
                </button>
                <button
                  type="button"
                  disabled={!resource.data.nextCursor}
                  onClick={() => {
                    if (resource.data?.nextCursor)
                      setPosition({
                        binding,
                        cursors: [...cursors, resource.data.nextCursor],
                      });
                  }}
                >
                  More {kind} options
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
