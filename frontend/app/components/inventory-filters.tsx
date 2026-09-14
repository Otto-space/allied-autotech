"use client";
import { useState } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
const parseParts = (value: unknown) =>
  z
    .object({
      items: z.array(
        z.object({ id: z.string().uuid(), name: z.string(), sku: z.string() }),
      ),
      nextCursor: z.string().optional(),
    })
    .parse(value);
export function InventoryFilters({
  branchId,
  productId,
  onBranch,
  onProduct,
  onClear,
}: {
  branchId: string;
  productId: string;
  onBranch: (value: string) => void;
  onProduct: (value: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("Selected part");
  const pagination = useCursorPage();
  const parts = useResource(
    `/public/catalog/products?limit=25${query ? `&search=${encodeURIComponent(query)}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseParts,
  );
  return (
    <div className="catalogue-filters">
      <div className="field">
        <label htmlFor="inventory-filter-branch">Active branch filter</label>
        <SlotCatalogPicker
          id="inventory-filter-branch"
          kind="branch"
          value={branchId}
          onChange={onBranch}
        />
        <p className="field-hint">
          Leave blank to include every permitted branch, including inactive records.
        </p>
      </div>
      <div>
        <div className="field">
          <label htmlFor="inventory-filter-search">Find an active catalogue part</label>
          <input
            id="inventory-filter-search"
            type="search"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setQuery(search.trim());
              pagination.reset();
            }}
          >
            Find filter options
          </button>
        </div>
        <div className="field">
          <label htmlFor="inventory-filter-part">Active catalogue part filter</label>
          <select
            id="inventory-filter-part"
            value={productId}
            onChange={(event) => {
              setLabel(event.target.selectedOptions[0]?.textContent ?? "Selected part");
              onProduct(event.target.value);
            }}
          >
            <option value="">All inventory parts</option>
            {productId && !parts.data?.items.some((part) => part.id === productId) && (
              <option value={productId}>{label}</option>
            )}
            {parts.data?.items.map((part) => (
              <option value={part.id} key={part.id}>
                {part.name} · {part.sku}
              </option>
            ))}
          </select>
        </div>
        <Feedback message={parts.error} />
        {parts.error && (
          <button type="button" className="text-link" onClick={parts.refresh}>
            Retry part filters
          </button>
        )}
        {parts.loading && <p role="status">Loading part filters…</p>}
        {!parts.loading && !parts.error && parts.data?.items.length === 0 && (
          <p>No active parts match this search.</p>
        )}
        {(parts.data?.nextCursor || pagination.page > 1) && (
          <CursorPagination
            pagination={pagination}
            nextCursor={parts.data?.nextCursor}
            disabled={parts.loading || !!parts.error}
            label="Inventory filter choices"
          />
        )}
      </div>
      <div>
        <button className="button secondary" type="button" onClick={onClear}>
          Clear inventory filters
        </button>
      </div>
    </div>
  );
}
